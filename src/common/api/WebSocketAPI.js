/**
 * Class used to facilitate connection to a WebSocket and
 * also to manage properly messages send to the WebSocket.
 * This class must not contain any specific implementation.
 */
class WebSocketAPI {
  constructor() {
    this.defineProperties();
  }

  defineProperties() {
    Object.defineProperties(this, {
      closed: {
        get: () =>
          !!(
            this.websocket &&
            this.websocket.readyState === this.websocket.CLOSED
          ),
      },
      closing: {
        get: () =>
          !!(
            this.websocket &&
            this.websocket.readyState === this.websocket.CLOSING
          ),
      },
      connecting: {
        get: () =>
          !!(
            this.websocket &&
            this.websocket.readyState === this.websocket.CONNECTING
          ),
      },
      open: {
        get: () =>
          !!(
            this.websocket && this.websocket.readyState === this.websocket.OPEN
          ),
      },
      /**
       * Array of message to send on open.
       * @type {Array<string>}
       * @private
       */
      messagesOnOpen: {
        value: [],
        writable: true,
      },
      /**
       * Array of subscriptions.
       * @type {Array<subscription>}
       * @private
       */
      subscriptions: {
        value: [],
        writable: true,
      },

      /**
       * List of channels subscribed.
       * @type {Array<subscription>}
       * @private
       */
      subscribed: {
        value: {},
        writable: true,
      },
    });
  }

  /**
   * Get the websocket request string.
   *
   * @param {string} method Request mehtod {GET, SUB}.
   * @param {Object} params Request parameters.
   * @param {string} params.channel Channel name
   * @param {string} [params.args] Request arguments
   * @param {Number} [params.id] Request identifier
   * @return {string} request string
   * @private
   */
  static getRequestString(method, params) {
    let reqStr = `${method} ${params.channel}`;
    reqStr += params.args ? ` ${params.args}` : '';
    reqStr += params.id ? ` ${params.id}` : '';
    return reqStr.trim();
  }

  /**
   * (Re)connect the websocket.
   *
   * @param {strin} url Websocket url.
   * @param {function} onOpen Callback called when the websocket connection is opened and before subscriptions of previous subscriptions.
   * @private
   */
  connect(url, onOpen = () => {}) {
    if (this.websocket && !this.closed) {
      this.websocket.close();
    }

    /** @ignore */
    this.websocket = new WebSocket(url);

    if (!this.open) {
      this.websocket.addEventListener('open', () => {
        onOpen();
        this.subscribePreviousSubscriptions();
      });
    } else {
      onOpen();
      this.subscribePreviousSubscriptions();
    }
  }

  /**
   * Close the websocket definitively.
   *
   * @private
   */
  close() {
    if (this.websocket) {
      this.websocket.onclose = null;
      this.websocket.close();
      this.websocket = null;
      this.messagesOnOpen = [];
    }
  }

  /**
   * Sends a message to the websocket.
   *
   * @param {message} message Message to send.
   * @private
   */
  send(message) {
    if (!this.websocket) {
      return;
    }
    const send = () => {
      this.websocket.send(message);
    };
    if (!this.open) {
      // This 'if' avoid sending 2 identical BBOX message on open,
      if (!this.messagesOnOpen.includes(message)) {
        this.messagesOnOpen.push(message);
        this.websocket.addEventListener('open', () => {
          this.messagesOnOpen = [];
          send();
        });
        this.websocket.addEventListener('close', () => {
          this.messagesOnOpen = [];
        });
      }
    } else if (!this.messagesOnOpen.includes(message)) {
      send();
    }
  }

  addEvents(onMessage, onError) {
    if (this.websocket) {
      this.websocket.addEventListener('message', onMessage);

      if (onError) {
        this.websocket.addEventListener('error', onError);
        this.websocket.addEventListener('close', onError);
      }
    }
  }

  removeEvents(onMessage, onError) {
    if (this.websocket) {
      this.websocket.removeEventListener('message', onMessage);

      if (onError) {
        this.websocket.removeEventListener('error', onError);
        this.websocket.removeEventListener('close', onError);
      }
    }
  }

  /**
   * Listen to websocket messages.
   *
   * @param {Object} params Parameters for the websocket get request
   * @param {function} cb callback on listen
   * @param {function} errorCb Callback on error
   * @return {{onMessage: function, errorCb: function}} Object with onMessage and error callbacks
   * @private
   */
  listen(params, cb, errorCb) {
    // Remove the previous identical callback
    this.unlisten(params, cb, errorCb);

    // We wrap the message callback to be sure we only propagate the message if it is for the right channel.
    const onMessage = (evt) => {
      let data = {};
      try {
        data = JSON.parse(evt.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('WebSocket: unable to parse JSON data', err, evt.data);
      }
      let source = params.channel;
      source += params.args ? ` ${params.args}` : '';

      // Buffer channel message return a list of other channels to propagate to proper callbacks.
      const contents = data.source === 'buffer' ? data.content : [data];
      contents.forEach((content) => {
        // Because of backend optimization, the last content is null.
        if (
          content?.source === source &&
          (!params.id || params.id === data.client_reference)
        ) {
          cb(content);
        }
      });
    };

    this.addEvents(onMessage, errorCb);

    return { onMessageCb: onMessage, onErrorCb: errorCb };
  }

  /**
   * Unlisten websocket messages.
   *
   * @param {Object} params Parameters for the websocket get request.
   * @param {function} cb Callback used when listen.
   * @private
   */
  unlisten(params, cb) {
    [...(this.subscriptions || []), ...(this.requests || [])]
      .filter(
        (s) => s.params.channel === params.channel && (!cb || s.cb === cb),
      )
      .forEach(({ onMessageCb, onErrorCb }) => {
        this.removeEvents(onMessageCb, onErrorCb);
      });
  }

  /**
   * Sends a get request to the websocket.
   * The callback is called only once, when the response is received or when the call returns an error.
   *
   * @param {Object} params Parameters for the websocket get request
   * @param {function} onMessage callback on message event
   * @param {function} onError Callback on error and close event
   * @private
   */
  get(params, cb, errorCb) {
    const requestString = WebSocketAPI.getRequestString('GET', params);
    this.send(requestString);

    // We wrap the callbacks to make sure they are called only once.
    const once =
      (callback) =>
      (...args) => {
        callback(...args);
        const index = this.requests.findIndex(
          (request) =>
            requestString === request.requestString && cb === request.cb,
        );
        const { onMessageCb, onErrorCb } = this.requests[index];
        this.removeEvents(onMessageCb, onErrorCb);
        this.requests.splice(index, 1);
      };

    const { onMessageCb, onErrorCb } = this.listen(
      params,
      once(cb),
      once(errorCb),
    );

    // Store requests and callbacks to be able to remove them.
    if (!this.requests) {
      this.requests = [];
    }
    const index = this.requests.findIndex(
      (request) => requestString === request.requestString && cb === request.cb,
    );
    const newReq = {
      params,
      requestString,
      cb,
      errorCb,
      onMessageCb,
      onErrorCb,
    };
    if (index > -1) {
      this.requests[index] = newReq;
    } else {
      this.requests.push(newReq);
    }
  }

  /**
   * Subscribe to a given channel.
   *
   * @param {Object} params Parameters for the websocket get request
   * @param {function} cb callback on listen
   * @param {function} errorCb Callback on error
   * @param {boolean} quiet if false, no GET or SUB requests are send, only the callback is registered.
   * @private
   */
  subscribe(params, cb, errorCb, quiet = false) {
    const { onMessageCb, onErrorCb } = this.listen(params, cb, errorCb);
    const reqStr = WebSocketAPI.getRequestString('', params);

    const index = this.subscriptions.findIndex(
      (subcr) => params.channel === subcr.params.channel && cb === subcr.cb,
    );
    const newSubscr = { params, cb, errorCb, onMessageCb, onErrorCb, quiet };
    if (index > -1) {
      this.subscriptions[index] = newSubscr;
    } else {
      this.subscriptions.push(newSubscr);
    }

    if (!this.subscribed[reqStr]) {
      if (!newSubscr.quiet) {
        this.send(`GET ${reqStr}`);
        this.send(`SUB ${reqStr}`);
      }
      this.subscribed[reqStr] = true;
    }
  }

  /**
   * Unsubscribe from a channel.
   * @param {string} source source to unsubscribe from
   * @param {function} cb Callback function to unsubscribe. If null all subscriptions for the channel will be unsubscribed.
   * @private
   */
  unsubscribe(source, cb) {
    const toRemove = this.subscriptions.filter(
      (s) => s.params.channel === source && (!cb || s.cb === cb),
    );

    toRemove.forEach(({ onMessageCb, onErrorCb }) => {
      this.removeEvents(onMessageCb, onErrorCb);
    });

    this.subscriptions = this.subscriptions.filter(
      (s) => s.params.channel !== source || (cb && s.cb !== cb),
    );

    // If there is no more subscriptions to this channel, and the removed subscriptions didn't register quietly,
    // we DEL it.
    if (
      source &&
      this.subscribed[source] &&
      !this.subscriptions.find((s) => s.params.channel === source) &&
      toRemove.find((subscr) => !subscr.quiet)
    ) {
      this.send(`DEL ${source}`);
      this.subscribed[source] = false;
    }
  }

  /**
   * After an auto reconnection we need to re-subscribe to the channels.
   */
  subscribePreviousSubscriptions() {
    // Before to subscribe previous subscriptions we make sure they
    // are all defined as unsubscribed, because this code is asynchrone
    // and a subscription could have been added in between.
    Object.keys(this.subscribed).forEach((key) => {
      this.subscribed[key] = false;
    });

    // Subscribe all previous subscriptions.
    [...this.subscriptions].forEach((s) => {
      this.subscribe(s.params, s.cb, s.errorCb, s.quiet);
    });
  }
}

export default WebSocketAPI;

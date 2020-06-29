/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */

/**
 * TokenLayerInterface.
 *
 * @classproperty {string} tokenUsername - username to access the renew service.
 * @classproperty {string} tokenPassword - Password To acces the renew service.
 * @classproperty {string} tokenUrl - Url of the service.
 * @classproperty {number} tokenExpiration - Duartion in minutes before renewing the token. Default 60 minutes.
 * @classproperty {function} onTokenUpdate - Function called on each renew of the token.
 */
export class TokenLayerInterface {
  /**
   * Starts updating of the token.
   * @param {ol/Map~Map|mapboxgl.Map} map - The map where the layer is displayed.
   */
  // eslint-disable-next-line no-unused-vars
  init(map) {}

  /**
   * Stops updating the token.
   */
  terminate() {}

  /**
   * Start requesting a new token every 60 minutes. See tokenExpiration property.
   */
  startTokenUpdate() {}

  /**
   * Stop requesting a new token.
   */
  stopTokenUpdate() {}
}

/**
 * Mixin for TokenLayerInterface.
 *
 * @param {Class} Base  A class to extend with {TokenLayerInterface} functionnalities.
 * @return {Class}  A class that implements <TokenLayerInterface> class and extends Base;
 */
const TokenLayerMixin = (Base) =>
  class extends Base {
    defineProperties(options) {
      const {
        tokenUsername,
        tokenPassword,
        tokenUrl,
        tokenExpiration,
        onTokenUpdate,
      } = options;
      super.defineProperties(options);
      Object.defineProperties(this, {
        tokenUsername: { value: tokenUsername },
        tokenPassword: { value: tokenPassword },
        tokenUrl: { value: tokenUrl },
        tokenExpiration: { value: tokenExpiration || 60 },
        onTokenUpdate: { value: onTokenUpdate, writable: true },
      });
    }

    init(map) {
      if (!map) {
        return;
      }
      super.init(map);
      this.startTokenUpdate();
    }

    terminate() {
      this.stopTokenUpdate();
      super.terminate();
    }

    startTokenUpdate() {
      this.stopTokenUpdate();
      fetch(`${this.tokenUrl}`, {
        method: 'post',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `username=${this.tokenUsername}&password=${this.tokenPassword}&expiration=${this.tokenExpiration}`,
      })
        .then((response) => {
          return response.text().then((text) => {
            if (!response.ok || /Invalid/.test(text)) {
              // When user/pass is wrong
              throw new Error(text);
            }
            return text;
          });
        })
        .then((token) => {
          this.onTokenUpdate(token, this);
          /** @ignore */
          this.timeout = setTimeout(
            () => this.startTokenUpdate(),
            this.tokenExpiration * 60 * 1000 - 10000, // 10 seconds before expiration
          );
        });
    }

    stopTokenUpdate() {
      clearTimeout(this.timeout);
    }
  };

export default TokenLayerMixin;

/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import { buffer, containsCoordinate } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import Tracker from '../Tracker';
import { timeSteps } from '../trackerConfig';

/**
 * TrackerLayerInterface.
 *
 * @classproperty {boolean} isTrackerLayer - Property for duck typing since `instanceof` is not working when the instance was created on different bundles.
 * @classproperty {boolean} isHoverActive - Activate/deactivate pointer hover effect.
 * @classproperty {function} style - Style of the vehicle.
 * @classproperty {FilterFunction} filter - Time speed.
 * @classproperty {function} sort - Set the filter for tracker features.
 * @classproperty {boolean} live - If true, the layer will always use Date.now() to render trajectories. Default to true.
 * @classproperty {boolean} useRequestAnimationFrame - If true, encapsulates the renderTrajectories calls in a requestAnimationFrame. Experimental.
 */
export class TrackerLayerInterface {
  /**
   * Initalize the Tracker.
   * @param {ol/Map~Map} map
   * @param {Object} options
   * @param {number} [options.width] Canvas's width.
   * @param {number} [options.height] Canvas's height.
   * @param {function} [options.getPixelFromCoordinate] Convert an EPSG:3857 coordinate to a canvas pixel (origin top-left).
   */
  // eslint-disable-next-line no-unused-vars
  init(map, options) {}

  /**
   * Destroy the Tracker.
   */
  terminate() {}

  /**
   * Start the clock.
   *
   * @param {Array<number>} size Map's size: [width, height].
   * @param {number} zoom Map's zoom level.
   * @param {number} resolution Map's resolution.
   */
  // eslint-disable-next-line no-unused-vars
  start(size, zoom, resolution) {}

  /**
   * Stop the time.
   * @private
   * @param {number} zoom
   */
  // eslint-disable-next-line no-unused-vars
  startUpdateTime(zoom) {}

  /**
   * Stop the clock.
   */
  stop() {}

  /**
   * Set the current time, it triggers a rendering of the trajectories.
   *
   * @param {Date} time The date to render.
   * @param {number[2]} size Size of the canvas to render.
   * @param {number} resolution Map's resolution to render.
   * @param {boolean} [mustRender=true] If false bypass the rendering of vehicles.
   */
  // eslint-disable-next-line no-unused-vars
  setCurrTime(time, size, resolution, mustRender = true) {}

  /**
   * Get vehicle.
   * @param {function} filterFc A function use to filter results.
   */
  // eslint-disable-next-line no-unused-vars
  getVehicle(filterFc) {}

  /**
   * Returns the list of vehicles which are at the given coordinates.
   * Returns an empty array when no vehicle is located at the given
   * coordinates.
   *
   * @param {number[2]} coordinate A coordinate ([x,y]).
   * @param {number} [resolution=1] The resolution of the map.
   * @param {number} [nb=Infinity] nb The max number of vehicles to return.
   * @returns {Array<ol/Feature~Feature>} Array of vehicles.
   */
  // eslint-disable-next-line no-unused-vars
  getVehiclesAtCoordinate(coordinate, resolution = 1, nb = Infinity) {}

  /**
   * Get the duration before the next update depending on zoom level.
   * @private
   * @param {number} zoom
   */
  // eslint-disable-next-line no-unused-vars
  getRefreshTimeInMs(zoom) {}

  /**
   * Define a default style of the vehicle.s
   * Draw a blue circle with the id of the props parameter.
   *
   * @param {Object} props Properties
   * @private
   */
  // eslint-disable-next-line no-unused-vars
  defaultStyle(props) {}
}

/**
 * Mixin for TrackeLayerInterface.
 *
 * @param {Class} Base  A class to extend with {TrackerLayerInterface} functionnalities.
 * @return {Class}  A class that implements <TrackerLayerInterface> class and extends Base;
 * @private
 */
const TrackerLayerMixin = (Base) =>
  class extends Base {
    /**
     * Define layer's properties.
     *
     * @ignore
     */
    defineProperties(options) {
      const { isHoverActive, style, speed } = {
        isHoverActive: true,
        ...options,
      };

      // Tracker options use to build the tracker.
      const {
        pixelRatio,
        interpolate,
        hoverVehicleId,
        selectedVehicleId,
        filter,
        sort,
      } = options;
      const initTrackerOptions = {
        pixelRatio: pixelRatio || window.devicePixelRatio || 1,
        interpolate,
        hoverVehicleId,
        selectedVehicleId,
        filter,
        sort,
        style,
      };
      Object.keys(initTrackerOptions).forEach(
        (key) =>
          initTrackerOptions[key] === undefined &&
          delete initTrackerOptions[key],
      );

      let cuurSpeed = speed || 1;

      super.defineProperties(options);

      Object.defineProperties(this, {
        isTrackerLayer: { value: true },

        /**
         * Active on hover effect.
         */
        isHoverActive: {
          value: !!isHoverActive,
          writable: true,
        },

        /**
         * Style function used to render a vehicle.
         */
        style: {
          value: style || this.defaultStyle,
        },

        /**
         * Speed of the wheel of time.
         * If live property is true. The speed is ignored.
         */
        speed: {
          get: () => cuurSpeed,
          set: (newSpeed) => {
            cuurSpeed = newSpeed;
            this.start();
          },
        },

        /**
         * Function to filter which vehicles to display.
         */
        filter: {
          get: () =>
            this.tracker ? this.tracker.filter : this.initTrackerOptions.filter,
          set: (newFilter) => {
            if (this.tracker) {
              this.tracker.filter = newFilter;
            } else {
              this.initTrackerOptions.filter = newFilter;
            }
          },
        },

        /**
         * Function to sort the vehicles to display.
         */
        sort: {
          get: () =>
            this.tracker ? this.tracker.sort : this.initTrackerOptions.sort,
          set: (newSort) => {
            if (this.tracker) {
              this.tracker.sort = newSort;
            } else {
              this.initTrackerOptions.sort = newSort;
            }
          },
        },

        /**
         * The tracker that renders the trajectories.
         */
        tracker: { value: null, writable: true },

        /**
         * Canvas cache object for trajectories drawn.
         */
        styleCache: { value: {} },

        /**
         * If true. The layer will always use Date.now() on the next tick to render the trajectories.
         * When true, setCurrTime will have no effect.
         */
        live: {
          value: true,
          writable: true,
        },

        /**
         * Time used to display the trajectories.
         * If live property is true. This function does nothing execpt rerender the trajectories using Date.now().
         */
        currTime: {
          value: new Date(),
          writable: true,
        },

        /**
         * Keep track of the last update of the interval.
         * Useful when the speed increase.
         */
        lastUpdateTime: {
          value: new Date(),
          writable: true,
        },

        /**
         * Keep track of which trajectories are currently drawn.
         */
        renderedTrajectories: {
          get: () => this.tracker?.renderedTrajectories || [],
        },

        /**
         * Id of the hovered vehicle.
         */
        hoverVehicleId: {
          get: () => {
            return this.tracker
              ? this.tracker.hoverVehicleId
              : this.initTrackerOptions.hoverVehicleId;
          },
          set: (newHoverVehicleId) => {
            if (this.tracker) {
              this.tracker.hoverVehicleId = newHoverVehicleId;
            } else {
              this.initTrackerOptions.hoverVehicleId = newHoverVehicleId;
            }
          },
        },

        /**
         * Id of the selected vehicle.
         */
        selectedVehicleId: {
          get: () =>
            this.tracker
              ? this.tracker.selectedVehicleId
              : this.initTrackerOptions.selectedVehicleId,
          set: (newSelectedVehicleId) => {
            if (this.tracker) {
              this.tracker.selectedVehicleId = newSelectedVehicleId;
            } else {
              this.initTrackerOptions.selectedVehicleId = newSelectedVehicleId;
            }
          },
        },

        /**
         * Pixel ratio use for the rendering. Default to window.devicePixelRatio.
         */
        pixelRatio: {
          get: () =>
            this.tracker
              ? this.tracker.pixelRatio
              : this.initTrackerOptions.pixelRatio,
          set: (newPixelRatio) => {
            if (this.tracker) {
              this.tracker.pixelRatio = newPixelRatio;
            } else {
              this.initTrackerOptions.pixelRatio = newPixelRatio;
            }
          },
        },

        /**
         * Options used by the constructor of the Tracker class.
         */
        initTrackerOptions: {
          value: initTrackerOptions,
          writable: false,
        },

        /**
         * If true, encapsulates the renderTrajectories calls in a requestAnimationFrame.
         */
        useRequestAnimationFrame: {
          default: false,
          writable: true,
        },
      });
    }

    /**
     * Initalize the Tracker.
     * @param {ol/Map~Map} map
     * @param {Object} options
     * @param {number} [options.width] Canvas's width.
     * @param {number} [options.height] Canvas's height.
     * @param {bool} [options.interpolate] Convert an EPSG:3857 coordinate to a canvas pixel (origin top-left).
     * @param {string} [options.hoverVehicleId] Id of the trajectory which is hovered.
     * @param {string} [options.selectedVehicleId] Id of the trajectory which is selected.
     * @param {number} [options.iconScale] Scale the vehicle icons with this value.
     * @param {function} [options.getPixelFromCoordinate] Convert an EPSG:3857 coordinate to a canvas pixel (origin top-left).
     * @param {function} [options.filter] Function use to filter the features displayed.
     * @param {function} [options.sort] Function use to sort the features displayed.
     * @param {function} [options.style] Function use to style the features displayed.
     */
    init(map, options = {}) {
      super.init(map);

      this.tracker = new Tracker({
        style: (props, r) => this.style(props, r),
        ...this.initTrackerOptions,
        ...options,
      });

      if (this.visible) {
        this.start();
      }

      this.visibilityRef = this.on('change:visible', (evt) => {
        if (evt.target.visible) {
          this.start();
        } else {
          this.stop();
        }
      });
    }

    /**
     * Destroy the Tracker.
     */
    terminate() {
      this.stop();
      unByKey(this.visibilityRef);
      if (this.tracker) {
        this.tracker.destroy();
        this.tracker = null;
      }
      super.terminate();
    }

    /**
     * Start the clock.
     *
     * @param {Array<Number>} size Map's size: [width, height].
     * @param {number} zoom Map's zoom level.
     * @param {number} resolution Map's resolution.
     */
    start(size, zoom, resolution) {
      this.stop();
      this.tracker.setVisible(true);
      this.renderTrajectories(size, resolution);
      this.startUpdateTime(zoom);
    }

    /**
     * Start the time.
     * @private
     * @param {number} zoom
     */
    startUpdateTime(zoom) {
      this.stopUpdateTime();
      this.updateTimeInterval = setInterval(() => {
        const newTime =
          this.currTime.getTime() +
          (new Date() - this.lastUpdateTime) * this.speed;
        this.setCurrTime(newTime);
      }, this.getRefreshTimeInMs(zoom));
    }

    /**
     * Stop the clock.
     */
    stop() {
      this.stopUpdateTime();
      if (this.tracker) {
        this.tracker.setVisible(false);
        this.tracker.clear();
      }
    }

    /**
     * Stop the time.
     * @private
     */
    stopUpdateTime() {
      if (this.updateTimeInterval) {
        clearInterval(this.updateTimeInterval);
      }
    }

    /**
     * Launch renderTrajectories. it avoids duplicating code in renderTrajectories methhod.
     * @private
     */
    renderTrajectoriesInternal(size, resolution, noInterpolate) {
      if (!this.tracker) {
        return;
      }

      const renderTime = this.live ? Date.now() : this.currTime;
      this.tracker.renderTrajectories(
        renderTime,
        size,
        resolution,
        noInterpolate,
      );
    }

    /**
     * Render the trajectories requesting an animation frame and cancelling the previous one
     * @private
     */
    renderTrajectories(size, resolution, noInterpolate) {
      if (this.requestId) {
        cancelAnimationFrame(this.requestId);
      }

      if (this.useRequestAnimationFrame) {
        this.requestId = requestAnimationFrame(() => {
          this.renderTrajectoriesInternal(size, resolution, noInterpolate);
        });
      } else {
        this.renderTrajectoriesInternal(size, resolution, noInterpolate);
      }
    }

    /**
     * Set the current time, it triggers a rendering of the trajectories.
     * If live is true. This function will have no effect.
     * @param {dateString | value} time
     * @param {Array<number>} size
     * @param {number} resolution
     * @param {boolean} [mustRender=true]
     */
    setCurrTime(time, size, resolution, mustRender = true) {
      this.currTime = new Date(time);
      this.lastUpdateTime = this.currTime;
      if (mustRender) {
        this.renderTrajectories(size, resolution);
      }
    }

    /**
     * Get vehicle.
     * @param {function} filterFc A function use to filter results.
     * @returns {Array<Object>} Array of vehicle.
     */
    getVehicle(filterFc) {
      return this.tracker.getTrajectories().filter(filterFc);
    }

    /**
     * Returns an array of vehicles located at the given coordinates and resolution.
     *
     * @param {number[2]} coordinate A coordinate ([x,y]).
     * @param {number} [resolution=1] The resolution of the map.
     * @param {number} [nb=Infinity] The max number of vehicles to return.
     * @returns {Array<ol/Feature~Feature>} Array of vehicle.
     */
    getVehiclesAtCoordinate(coordinate, resolution = 1, nb = Infinity) {
      const ext = buffer([...coordinate, ...coordinate], 10 * resolution);
      const trajectories = this.tracker.getTrajectories();
      const vehicles = [];
      for (let i = 0; i < trajectories.length; i += 1) {
        if (
          trajectories[i].coordinate &&
          containsCoordinate(ext, trajectories[i].coordinate)
        ) {
          vehicles.push(trajectories[i]);
        }
        if (vehicles.length === nb) {
          break;
        }
      }

      return vehicles;
    }

    /**
     * Get the duration before the next update depending on zoom level.
     * @private
     * @param {number} zoom
     */
    getRefreshTimeInMs(zoom) {
      const roundedZoom = Math.round(zoom);
      const timeStep = timeSteps[roundedZoom] || 25;
      const nextTick = Math.max(25, timeStep / this.speed);
      return nextTick;
    }

    /**
     * Define a default style of the vehicle.s
     * Draw a blue circle with the id of the props parameter.
     *
     * @param {Object} props Properties
     * @private
     */
    defaultStyle(props) {
      const { id: text } = props;
      if (this.styleCache[text]) {
        return this.styleCache[text];
      }
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 15;
      const ctx = canvas.getContext('2d');
      ctx.arc(8, 8, 5, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#8ED6FF';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'black';
      ctx.stroke();
      ctx.font = 'bold 12px arial';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.strokeText(text, 20, 10);
      ctx.fillStyle = 'black';
      ctx.fillText(text, 20, 10);
      this.styleCache[text] = canvas;
      return this.styleCache[text];
    }
  };

export default TrackerLayerMixin;

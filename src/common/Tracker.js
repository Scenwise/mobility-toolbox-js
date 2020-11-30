import { unByKey } from 'ol/Observable';
import GeomType from 'ol/geom/GeometryType';

/**
 * Tracker. This class draw trajectories on a canvas.
 * @class
 * @param {Object} options
 * @private
 */
export default class Tracker {
  /**
   * @private
   */
  constructor(options) {
    const opts = {
      interpolate: true,
      ...options,
    };

    /**
     * Array of trajectories.
     * @type {Array<trajectory>}
     */
    this.trajectories = [];

    /**
     * Array of trajectories that are currently drawn.
     * @type {Array<key>}
     */
    this.renderedTrajectories = [];

    /**
     * Array of ol events key, returned by on() or once().
     * @type {Array<key>}
     */
    this.interpolate = !!opts.interpolate;

    /**
     * Function to Convert coordinate to canvas pixel.
     * @type {function}
     */
    this.getPixelFromCoordinate = opts.getPixelFromCoordinate;

    /**
     * Id of the trajectory which is hovered.
     * @type {string}
     */
    this.hoverVehicleId = null;

    // we draw directly on the canvas since openlayers is too slow.
    /**
     * HTML <canvas> element.
     * @type {Canvas}
     */
    this.canvas = opts.canvas || document.createElement('canvas');
    this.canvas.width = opts.width;
    this.canvas.height = opts.height;
    this.canvas.setAttribute(
      'style',
      [
        'position: absolute',
        'top: 0',
        'bottom: 0',
        'right: 0',
        'left: 0',
        'pointer-events: none',
        'visibility: visible',
        'margin-top: inherit', // for scrolling behavior.
      ].join(';'),
    );
    /**
     * 2d drawing context on the canvas.
     * @type {CanvasRenderingContext2D}
     */
    this.canvasContext = this.canvas.getContext('2d');
  }

  /**
   * Set visibility of the canvas.
   * @param {boolean} visible The visibility of the layer
   */
  setVisible(visible) {
    if (this.canvas) {
      this.canvas.style.visibility = visible ? 'visible' : 'hidden';
    }
  }

  /**
   * Define the trajectories.
   * @param {array<ol/Feature~Feature>} trajectories
   */
  setTrajectories(trajectories = []) {
    if (this.sort) {
      trajectories.sort(this.sort);
    }

    this.trajectories = trajectories;
  }

  /**
   * Return the trajectories.
   * @returns {array<trajectory>} trajectories
   */
  getTrajectories() {
    return this.trajectories || [];
  }

  /**
   * Return rendered trajectories.
   * Use this to avoid race conditions while rendering.
   * @returns {array<trajectory>} trajectories
   */
  getRenderedTrajectories() {
    return this.renderedTrajectories;
  }

  /**
   * Clear the canvas.
   * @private
   */
  clear() {
    if (this.canvasContext) {
      this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Set the filter for tracker features.
   * @param {function} filter Filter function.
   */
  setFilter(filter) {
    /**
     * Current filter function.
     * @type {function}
     */
    this.filter = filter;
  }

  /**
   * Set the sort for tracker features.
   * @param {function} sort Sort function.
   */
  setSort(sort) {
    /**
     * The sort function for tracker features.
     * @type {function}
     */
    this.sort = sort;
  }

  /**
   * Set the id of the trajectory which is hovered.
   * @param {string} id Id of a vehicle.
   * @private
   */
  setHoverVehicleId(id) {
    if (id !== this.hoverVehicleId) {
      this.hoverVehicleId = id;
    }
  }

  /**
   * Set the tracker style.
   * @param {function} s OpenLayers style function.
   */
  setStyle(s) {
    /**
     * Style function.
     * @type {function}
     */
    this.style = s;
  }

  /**
   * Draw all the trajectories available to the canvas.
   * @param {Date} currTime The date to render.
   * @param {number[2]} size Size ([width, height]) of the canvas to render.
   * @param {number} resolution Which resolution of the map to render.
   * @private
   */
  renderTrajectories(currTime = Date.now(), size = [], resolution) {
    const [width, height] = size;
    if (
      width &&
      height &&
      (this.canvas.width !== width || this.canvas.height !== height)
    ) {
      [this.canvas.width, this.canvas.height] = [width, height];
    }
    /**
     * Current resolution.
     * @type {number}
     */
    this.currResolution = resolution || this.currResolution;
    let hoverVehicleImg;
    let hoverVehiclePx;

    let cleared = false;
    for (let i = (this.trajectories || []).length - 1; i >= 0; i -= 1) {
      const traj = this.trajectories[i];

      // We simplify the traj object
      const { geometry, timeIntervals, timeOffset } = traj;

      if (this.filter && !this.filter(traj)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      let coord = null;
      let rotation;

      if (timeIntervals && timeIntervals.length > 1) {
        const now = currTime - (timeOffset || 0);
        let start;
        let end;
        let startFrac;
        let endFrac;
        let timeFrac;

        // Search th time interval.
        for (let j = 0; j < timeIntervals.length - 1; j += 1) {
          // Rotation only available in tralis layer.
          [start, startFrac, rotation] = timeIntervals[j];
          [end, endFrac] = timeIntervals[j + 1];

          if (start <= now && now <= end) {
            break;
          } else {
            start = null;
            end = null;
          }
        }
        // The geometry can also be a Point
        if (geometry.getType() === GeomType.POINT) {
          coord = geometry.getCoordinate();
        } else if (geometry.getType() === GeomType.LINE_STRING) {
          if (start && end) {
            // interpolate position inside the time interval.
            timeFrac = this.interpolate
              ? Math.min((now - start) / (end - start), 1)
              : 0;

            const geomFrac = this.interpolate
              ? timeFrac * (endFrac - startFrac) + startFrac
              : 0;

            coord = geometry.getCoordinateAt(geomFrac);

            // We set the rotation and the timeFraction of the trajectory (used by tralis).
            this.trajectories[i].rotation = rotation;
            this.trajectories[i].endFraction = timeFrac;

            // It happens that the now date was some ms before the first timeIntervals we have.
          } else if (now < timeIntervals[0][0]) {
            [[, , rotation]] = timeIntervals;
            timeFrac = 0;
            coord = geometry.getFirstCoordinate();
          } else if (now > timeIntervals[timeIntervals.length - 1][0]) {
            [, , rotation] = timeIntervals[timeIntervals.length - 1];
            timeFrac = 1;
            coord = geometry.getLastCoordinate();
          }
        } else {
          // eslint-disable-next-line no-console
          console.error(
            'This geometry type is not supported. Only Point or LineString are. Current geometry: ',
            geometry,
          );
        }

        // We set the rotation and the timeFraction of the trajectory (used by tralis).
        // if rotation === null that seems there is no rotation available.
        this.trajectories[i].rotation = rotation;
        this.trajectories[i].endFraction = timeFrac || 0;
      }

      if (coord) {
        // We set the rotation of the trajectory (used by tralis).
        this.trajectories[i].coordinate = coord;
        const px = this.getPixelFromCoordinate(coord);

        if (!px) {
          // eslint-disable-next-line no-continue
          continue;
        }
        // Trajectory with pixel (i.e. within map extent) will be in renderedTrajectories.
        this.trajectories[i].rendered = true;

        const vehicleImg = this.style(traj, this.currResolution);
        if (this.hoverVehicleId !== traj.id) {
          if ((px[0] >= 0 && px[1] >= 0 && px[0] <= this.canvas.width && px[1] <= this.canvas.height) &&            
           (!("px_before" in this.trajectories[i]) || (this.trajectories[i].px_before != Math.floor(px[0]) || this.trajectories[i].py_before != Math.floor(px[1]))))  {
            if (!cleared) {
              cleared = true;
              this.clear();
            }
            this.trajectories[i].px_before = Math.floor(px[0]);
            this.trajectories[i].py_before = Math.floor(px[1]);
            this.canvasContext.drawImage(
              vehicleImg,
              px[0] - vehicleImg.height / 2,
              px[1] - vehicleImg.height / 2,
            );
          }
        } else {
          // Store the canvas to draw it at the end
          hoverVehicleImg = vehicleImg;
          hoverVehiclePx = px;
        }
      }
    }
    if (hoverVehicleImg) {
      this.canvasContext.drawImage(
        hoverVehicleImg,
        hoverVehiclePx[0] - hoverVehicleImg.height / 2,
        hoverVehiclePx[1] - hoverVehicleImg.height / 2,
      );
    }

    this.renderedTrajectories = this.trajectories.filter((t) => t.rendered);
  }

  /**
   * Clean the canvas and the events the tracker.
   * @private
   */
  destroy() {
    unByKey(this.olEventsKeys);
    this.renderedTrajectories = [];
    this.clear();
  }
}

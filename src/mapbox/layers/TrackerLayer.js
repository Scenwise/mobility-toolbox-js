import { toLonLat, fromLonLat } from 'ol/proj';
import { matrix, multiply } from 'mathjs';
import Layer from '../../common/layers/Layer';
import mixin from '../../common/mixins/TrackerLayerMixin';
import { getResolution } from '../utils';

/**
 * Responsible for loading tracker data.
 *
 * @extends {Layer}
 * @implements {TrackerLayerInterface}
 */
class TrackerLayer extends mixin(Layer) {
  constructor(options = {}) {
    super({
      ...options,
    });

    /** @ignores */
    this.onMapZoomEnd = this.onMapZoomEnd.bind(this);
    /** @ignores */
    this.onMapMouseMove = this.onMapMouseMove.bind(this);
  }

  /**
   * Initialize the layer.
   *
   * @param {mapboxgl.Map} map A [mapbox Map](https://docs.mapbox.com/mapbox-gl-js/api/map/).
   * @override
   */
  init(map) {
    if (!map) {
      return;
    }
    const { width, height } = map.getCanvas();

    super.init(map, {
      width,
      height,
      getPixelFromCoordinate: (coord) => {
        const pixelRatio = window.devicePixelRatio || 1;
        const [lng, lat] = toLonLat(coord);
        const { x, y } = this.map.project({ lng, lat });

        // return [
        //   x *pixelRatio ,
        //   y *pixelRatio,
        // ];
        const angle = (-this.map.getBearing() * Math.PI) / 180;
        // https://lexique.netmath.ca/en/rotation-in-a-cartesian-plane/#:~:text=Formulas,%E2%88%92x%2C%E2%88%92y).
        const matrixx = matrix([
          [Math.cos(angle), -Math.sin(angle)],
          [Math.sin(angle), Math.cos(angle)],
        ]);
        let { width, height } = this.map.getCanvas();
        const northWestPixel = this.map.project(
          this.map.getBounds().getNorthWest(),
        );
        const northEastPixel = this.map.project(
          this.map.getBounds().getNorthEast(),
        );
        width = Math.sqrt(
          (northWestPixel.x - northEastPixel.x) ** 2 +
            (northWestPixel.y - northEastPixel.y) ** 2,
        );
        const southWestPixel = this.map.project(
          this.map.getBounds().getSouthWest(),
        );
        height = Math.sqrt(
          (northWestPixel.x - southWestPixel.x) ** 2 +
            (northWestPixel.y - southWestPixel.y) ** 2,
        );
        const rotationXPlaneOrigin = width / 2;
        const rotationYPlaneOrigin = height / 2;
        const xInNewPlane = x * pixelRatio - rotationXPlaneOrigin;
        const yInNewPlane = y * pixelRatio - rotationYPlaneOrigin;
        const rotatedCoordInNewPlane = multiply(
          [xInNewPlane, yInNewPlane],
          matrixx,
        ).toArray();
        return [
          rotatedCoordInNewPlane[0] + rotationXPlaneOrigin,
          rotatedCoordInNewPlane[1] + rotationYPlaneOrigin,
        ];
      },
    });
  }

  projectWithRotation({ lng, lat }) {
    const pixelRatio = window.devicePixelRatio || 1;
    const { x, y } = this.map.project({ lng, lat });
    const { width, height } = this.map.getCanvas();

    // return [
    //   x *pixelRatio ,
    //   y *pixelRatio,
    // ];
    const angle = (-this.map.getBearing() * Math.PI) / 180;
    // https://lexique.netmath.ca/en/rotation-in-a-cartesian-plane/#:~:text=Formulas,%E2%88%92x%2C%E2%88%92y).
    const matrixx = matrix([
      [Math.cos(angle), -Math.sin(angle)],
      [Math.sin(angle), Math.cos(angle)],
    ]);
    const rotationXPlaneOrigin = width / 2;
    const rotationYPlaneOrigin = height / 2;
    const xInNewPlane = x * pixelRatio - rotationXPlaneOrigin;
    const yInNewPlane = y * pixelRatio - rotationYPlaneOrigin;
    const rotatedCoordInNewPlane = multiply(
      [xInNewPlane, yInNewPlane],
      matrixx,
    ).toArray();
    return [
      rotatedCoordInNewPlane[0] + rotationXPlaneOrigin,
      rotatedCoordInNewPlane[1] + rotationYPlaneOrigin,
    ];
  }

  /**
   * Set the current time, it triggers a rendering of the trajectories.
   *
   * @param {Date} time  The current time.
   */
  setCurrTime(time) {
    const canvas = this.map.getCanvas();
    super.setCurrTime(
      time,
      [canvas.width, canvas.height],
      getResolution(this.map),
      this.map.getBearing(),
    );
  }

  /**
   * Start updating vehicles position.
   *
   * @listens {mapboxgl.map.event:zoomend} Listen to zoom end event.
   * @listens {mapboxgl.map.event:mousemove} Listen to mousemove end.
   * @override
   */
  start() {
    const canvas = this.map.getCanvas();
    super.start(
      [canvas.width, canvas.height],
      this.map.getZoom(),
      getResolution(this.map),
    );

    this.map.on('zoomend', this.onMapZoomEnd);

    if (this.isHoverActive) {
      this.map.on('mousemove', this.onMapMouseMove);
    }
  }

  /**
   * Stop updating vehicles position, and unlisten events.
   *
   * @override
   */
  stop() {
    super.stop();
    if (this.map) {
      this.map.off('zoomend', this.onMapZoomEnd);
      this.map.off('mousemove', this.onMapMouseMove);
    }
  }

  /**
   * Returns an array of vehicles located at the given coordinate.
   *
   * @param {Array<number>} coordinate
   * @returns {Array<ol/Feature~Feature>} Array of vehicle.
   * @override
   */
  getVehiclesAtCoordinate(coordinate) {
    const resolution = getResolution(this.map);
    return super.getVehiclesAtCoordinate(coordinate, resolution);
  }

  /**
   * On zoomend we adjust the time interval of the update of vehicles positions.
   *
   * @private
   */
  onMapZoomEnd() {
    this.startUpdateTime(this.map.getZoom());
  }

  /**
   * On mousemove, we detect if a vehicle is heovered then updates the cursor's style.
   *
   * @param {mapboxgl.MapMouseEvent} evt Map's mousemove event.
   * @private
   */
  onMapMouseMove(evt) {
    if (
      this.map.isMoving() ||
      this.map.isRotating() ||
      this.map.isZooming() ||
      !this.isHoverActive
    ) {
      this.map.getContainer().style.cursor = 'auto';
      return;
    }
    const [vehicle] = this.getVehiclesAtCoordinate(
      fromLonLat([evt.lngLat.lng, evt.lngLat.lat]),
    );
    this.map.getContainer().style.cursor = vehicle ? 'pointer' : 'auto';
    this.tracker.setHoverVehicleId(vehicle && vehicle.id);
  }
}

export default TrackerLayer;

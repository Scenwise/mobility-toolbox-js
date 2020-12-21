import { Vector } from 'ol/layer';
import { Circle, Stroke, Style, Fill } from 'ol/style';
import { Vector as VectorSource } from 'ol/source';
import { Feature } from 'ol';
import { LineString, Point } from 'ol/geom';
import { Modify } from 'ol/interaction';
import { unByKey } from 'ol/Observable';
import { click } from 'ol/events/condition';
import { fromLonLat, toLonLat } from 'ol/proj';
import turfLineSlice from '@turf/line-slice';
import { getDistance } from 'ol/sphere';
import {
  lineString as turfLineString,
  point as turfPoint,
} from '@turf/helpers';
import RoutingAPI from '../../api/routing/RoutingAPI';
import Control from '../../common/controls/Control';
import Layer from '../layers/Layer';

const defaultPointStyle = new Style({
  image: new Circle({
    radius: 6,
    fill: new Fill({
      color: [255, 0, 0, 1],
    }),
  }),
});

/**
 * Display layer's copyrights.
 *
 * @example
 * import { Map, RoutingControl } from 'mobility-toolbox-js/ol';
 *
 * const map = new Map({
 *   target: 'map',
 *   controls: [
 *     new RoutingControl()
 *   ]
 * });
 *
 *
 * @see <a href="/example/ol-routing">Openlayers routing example</a>
 *
 * @extends {Control}
 * @implements {RoutingInterface}
 */
class RoutingControl extends Control {
  constructor(options) {
    const opts = {
      active: true,
      ...options,
    };

    super(opts);

    this.abortController = new AbortController();

    this.apiKey = opts.apiKey;

    this.api = new RoutingAPI({
      apiKey: this.apiKey,
    });

    this.mot = opts.mot || 'bus';

    this.routingLayer =
      opts.layer ||
      new Layer({
        name: 'routing-layer',
        olLayer: new Vector({
          source: new VectorSource(),
          style: [
            new Style({
              stroke: new Stroke({
                color: [255, 0, 0, 1],
                width: 5,
              }),
            }),
          ],
        }),
      });

    this.viaPoints = [];

    this.setDrawEnabled = this.setDrawEnabled.bind(this);
    this.onMapClick = this.onMapClick.bind(this);
    this.onModifyEnd = this.onModifyEnd.bind(this);
    this.onModifyStart = this.onModifyStart.bind(this);
  }

  /**
   * Enables/Disables route draw mode.
   * @param {boolean} enabled Enable/Disable route draw mode
   * @param {boolean} [reset=undefined] Clears all features and viaPoints
   */
  setDrawEnabled(enabled, reset) {
    if (this.map) {
      // Clear viaPoints and source
      if (reset) {
        this.viaPoints = [];
        this.routingLayer.olLayer.getSource().clear();
      }

      if (!enabled) {
        // Remove control ressources from map
        this.map.removeLayer(this.routingLayer.olLayer);
        this.map.removeInteraction(this.modify);
        unByKey(this.onMapClickKey);
        return;
      }

      // Define and add modify interaction
      this.modify = new Modify({
        source: this.routingLayer.olLayer.getSource(),
        pixelTolerance: 4,
        deleteCondition: (e) => {
          const feats = e.target.getFeaturesAtPixel(e.pixel, {
            hitTolerance: 5,
          });
          const viaPoint = feats.find(
            (feat) => feat.getGeometry() instanceof Point && feat.get('index'),
          );
          if (click(e) && viaPoint) {
            // Remove node & viaPoint if an existing viaPoint was clicked
            this.removeViaPoint(viaPoint.get('index'));
            return true;
          }
          return false;
        },
      });
      this.modify.on('modifystart', this.onModifyStart);
      this.modify.on('modifyend', this.onModifyEnd);

      // Add control ressources to map
      this.map.addLayer(this.routingLayer);
      this.onMapClickKey = this.map.on('singleclick', this.onMapClick);
      this.map.addInteraction(this.modify);
    }
  }

  /**
   * Adds/Replaces a viaPoint to the viaPoints array and redraws route:
   *   - Adds a viaPoint at end of array by default
   *   - If an index is passed a viaPoint is added at the specified index
   *   - If an index and overwrite is set to true, a viaPoint at the specified
   *       index is replaced with a new viaPoint.
   * @param {Array<Array<number>>} coordinates Array of coordinates
   * @param {number} index Integer representing the index of the added viaPoint.
   * @param {number} [overwrite=0] Marks the number of viaPoints that are removed at the specified index on add.
   */
  addViaPoint(coordinate, index = this.viaPoints.length, overwrite = 0) {
    /* Add/Insert/Overwrite viapoint and redraw route */
    this.viaPoints.splice(index, overwrite, coordinate);
    this.drawRoute(this.viaPoints);
  }

  /**
   * Removes a viaPoint at the passed array index and redraws route
   * By default the last viaPoint is removed.
   * @param {number} index Integer representing the index of the viaPoint to delete.
   */
  removeViaPoint(index = this.viaPoints.length - 1) {
    /* Remove viapoint and redraw route */
    if (this.viaPoints.length && this.viaPoints[index]) {
      this.viaPoints.splice(index, 1);
    }
    this.drawRoute(this.viaPoints);
  }

  getViaPoints() {
    /* Return array of viaPoints */
    return this.viaPoints;
  }

  /**
   * Sets the current mot and redraws route.
   * @param {string} motString String defining the mean of transport (e.g. bus, rail, foot...).
   */
  setMot(motString) {
    /* Return array of viaPoints */
    this.mot = motString;
    this.drawRoute(this.viaPoints);
  }

  /**
   * Draws route on map using an array of coordinates:
   *   - If a single coordinate is passed a single point feature is added to map.
   *   - If two or more coordinates are passed a request to the RoutingAPI fetches
   *       the route using the passed coordinates and the current mot.
   * @private
   */
  drawRoute(coordinateArray) {
    /* Calls RoutingAPI to draw a route using the viaPoints array */
    if (coordinateArray.length === 1) {
      // Clear source
      this.routingLayer.olLayer.getSource().clear();
      // Add point for first node
      const pointFeature = new Feature({
        geometry: new Point(coordinateArray[0]),
      });
      pointFeature.setStyle(defaultPointStyle);
      return this.routingLayer.olLayer.getSource().addFeature(pointFeature);
    }
    if (coordinateArray.length >= 2) {
      this.abortController.abort();
      this.abortController = new AbortController();
      const { signal } = this.abortController;

      // Coordinates need to be reversed because RoutingAPI wants them to be
      const viasLonLat = this.viaPoints.map((coord) => [
        toLonLat(coord)[1],
        toLonLat(coord)[0],
      ]);

      // Fetch RoutingAPI data
      this.api
        .route(
          {
            via: `${viasLonLat.join('|')}`,
            mot: `${this.mot}`,
            'resolve-hops': false,
            elevation: false,
            'coord-radius': 100.0,
            'coord-punish': 1000.0,
          },
          signal,
        )
        .then((data) => {
          // Clear source
          this.routingLayer.olLayer.getSource().clear();

          // Create point features for the viaPoints
          this.viaPoints.forEach((viaPoint, idx) => {
            const pointFeature = new Feature({
              geometry: new Point(viaPoint),
            });
            pointFeature.set('index', idx);
            pointFeature.setStyle(defaultPointStyle);
            return this.routingLayer.olLayer
              .getSource()
              .addFeature(pointFeature);
          });

          // Create new route once there are at least two viaPoints
          const projectedCoords = [];
          data.forEach((feature) =>
            feature.geometry.coordinates.forEach((coord) =>
              projectedCoords.push(fromLonLat(coord)),
            ),
          );
          const routeFeature = new Feature({
            geometry: new LineString(projectedCoords),
          });
          return this.routingLayer.olLayer.getSource().addFeature(routeFeature);
        })
        .catch(() => {
          // Clear source
          this.viaPoints = [];
          this.routingLayer.olLayer.getSource().clear();
        });
    }
    return null;
  }

  /**
   * Used on click on map while control is active:
   *   - By default adds a viaPoint to the end of array
   *   - If an existing viaPoint is clicked removes the clicked viaPoint
   * @private
   */
  onMapClick(e) {
    const feats = e.target.getFeaturesAtPixel(e.pixel);
    const viaPoint = feats.find(
      (feat) =>
        feat.getGeometry() instanceof Point && feat.get('index') !== undefined,
    );

    if (viaPoint) {
      // Remove existing viaPoint on click and abort viaPoint add
      this.removeViaPoint(viaPoint.get('index'));
      return;
    }

    this.addViaPoint(e.coordinate);
  }

  /**
   * Used on start of the modify interaction. Stores relevant data
   * in this.initialRouteDrag object
   * @private
   */
  onModifyStart(e) {
    // Create instances for LineString and Point features
    const route = e.features
      .getArray()
      .find((feat) => feat.getGeometry() instanceof LineString);

    const viaPointFeatures = e.features
      .getArray()
      .filter((feat) => feat.getGeometry() instanceof Point);

    // Add listeners to viaPoint features to identify which one is being modified
    this.relocateViaPoint = (evt) => {
      this.initialRouteDrag.relocateViaPoint = evt.target;
    };

    viaPointFeatures.forEach((feature) => {
      feature.on('change', this.relocateViaPoint);
    });

    // Write object with modify info
    this.initialRouteDrag = {
      viaPointFeatures,
      oldRoute: route && route.clone(),
      coordinate: e.mapBrowserEvent.coordinate,
    };
  }

  /**
   * Used on end of the modify interaction. Resolves feature modification:
   *   - Line drag creates new viaPoint at the final coordinate of drag
   *   - Point drag replaces old viaPoint
   * @private
   */
  onModifyEnd(e) {
    /* Get the index for new viaPoint */
    let newViaIndex;
    const {
      oldRoute,
      relocateViaPoint,
      viaPointFeatures,
    } = this.initialRouteDrag;

    // Unlisten feature change listeners
    viaPointFeatures.forEach((feature) => {
      feature.un('change', this.relocateViaPoint);
    });

    // If viaPoint is being relocated overwrite the old viaPoint
    if (relocateViaPoint) {
      return this.addViaPoint(
        e.mapBrowserEvent.coordinate,
        relocateViaPoint.get('index'),
        1,
      );
    }

    // In case there is no route overwrite first coordinate
    if (!oldRoute) {
      return this.addViaPoint(e.mapBrowserEvent.coordinate, 0, 1);
    }

    // Get the closest point from viaPoints to original route
    const viaPointClosestPoints = this.viaPoints.map((viaPoint) => {
      const snapPoint = oldRoute.getGeometry().getClosestPoint(viaPoint);
      return snapPoint;
    });

    // Calculate the distance from the click point to each segment
    let distanceToSegment;
    for (let i = 0; i < viaPointClosestPoints.length - 1; i += 1) {
      // Create a segment for each pair of (closest) viaPoints using turf lineSlice
      const turfLineSegment = turfLineSlice(
        turfPoint(viaPointClosestPoints[i]),
        turfPoint(viaPointClosestPoints[i + 1]),
        turfLineString(oldRoute.getGeometry().getCoordinates()),
      );

      /* Create an ol LineString from segment and get the distance between
       * the click point and the closest point on segment
       */
      const segment = new LineString(turfLineSegment.geometry.coordinates);
      const distanceToClick = getDistance(
        segment.getClosestPoint(this.initialRouteDrag.coordinate),
        this.initialRouteDrag.coordinate,
      );

      // Return segment index with smallest distance to click point
      if (!distanceToSegment || distanceToClick < distanceToSegment) {
        distanceToSegment = distanceToClick;
        newViaIndex = i + 1;
      }
    }

    // Insert new viaPoint at given index
    return this.addViaPoint(e.mapBrowserEvent.coordinate, newViaIndex);
  }

  createDefaultElement() {
    /**
     * Define a default element.
     */
    this.element = document.createElement('button');
    this.element.id = 'ol-routing';
    this.element.innerHTML = 'Toggle Route Control';
    this.element.onclick = () =>
      this.active ? this.deactivate() : this.activate();
    Object.assign(this.element.style, {
      position: 'absolute',
      right: '10px',
      top: '10px',
    });
  }

  activate() {
    super.activate();
    this.set('active', true);
    this.setDrawEnabled(true, true);
  }

  deactivate() {
    this.set('active', false);
    this.setDrawEnabled(false);
    super.deactivate();
  }
}

export default RoutingControl;

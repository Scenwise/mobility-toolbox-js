/* eslint-disable no-param-reassign */
import Layer from './Layer';

/**
 * Layer for visualizing a specific set of layer from a MapboxLayer.
 *
 * @example
 * import { MapboxLayer, MapboxStyleLayer } from 'mobility-toolbox-js/ol';
 *
 * const mapboxLayer = new MapboxLayer({
 *   url: 'https://maps.geops.io/styles/travic_v2/style.json?key=[yourApiKey]',
 * });
 *
 * const layer = new MapboxStyleLayer({
 *   mapboxLayer: mapboxLayer,
 *   styleLayersFilter: () => {},
 * });
 *
 * @classproperty {ol/Map~Map} map - The map where the layer is displayed.
 * @extends {Layer}
 */
class MapboxStyleLayer extends Layer {
  /**
   * Constructor.
   *
   * @param {Object} options
   * @param {MapboxLayer} [options.mapboxLayer] The MapboxLayer to use.
   * @param {Function} [options.styleLayersFilter] Filter function to decide which style layer to display.
   */
  constructor(options = {}) {
    super(options);

    /**
     * MapboxLayer provided for the style Layer.
     * @type {MapboxLayer}
     * @private
     */
    this.mapboxLayer = options.mapboxLayer;

    /**
     * Define if the layer has data to display in the current mapbox layer.
     */
    this.disabled = false;

    /**
     * Function to filter features to be displayed.
     * @type {function}
     * @private
     */
    this.styleLayersFilter = options.styleLayersFilter;

    /**
     * Mapbox style layer id where to add the style layers.
     * See [mapbox.map.addLayer](https://docs.mapbox.com/mapbox-gl-js/api/map/#map#addlayer) documentation.
     * @type {String}
     * @private
     */
    this.beforeId = options.beforeId;

    /**
     * Function to filter features for getFeatureInfoAtCoordinate method.
     * @type {function}
     * @private
     */
    this.featureInfoFilter = options.featureInfoFilter || ((obj) => obj);

    /**
     * Function to query the rendered features.
     * @type {function}
     * @private
     */
    this.queryRenderedLayersFilter = options.queryRenderedLayersFilter;

    /**
     * Array of features to highlight.
     * @type {Array<ol/Feature~Feature>}
     * @private
     */
    this.highlightedFeatures = [];

    /**
     * Array of selected features.
     * @type {Array<ol/Feature~Feature>}
     * @private
     */
    this.selectedFeatures = [];

    /**
     * Array of mapbox style layers to add.
     * @type {Array<mapboxgl.styleLayer>}
     * @private
     */
    this.styleLayers =
      (options.styleLayer ? [options.styleLayer] : options.styleLayers) || [];

    /**
     * @private
     */
    this.addStyleLayers = this.addStyleLayers.bind(this);

    /**
     * @private
     */
    this.onLoad = this.onLoad.bind(this);
    if (options.filters) {
      /** @private */
      this.addDynamicFilters = () => {
        this.setFilter(
          typeof options.filters === 'function'
            ? options.filters(this)
            : options.filters,
        );
      };
    }

    if (!this.styleLayersFilter && this.styleLayers) {
      const ids = this.styleLayers.map((s) => s.id);
      this.styleLayersFilter = (styleLayer) => ids.includes(styleLayer.id);
    }
  }

  /**
   * Initialize the layer.
   * @param {mapboxgl.Map} map the mapbox map.
   * @override
   */
  init(map) {
    if (!this.mapboxLayer.map) {
      this.mapboxLayer.init(map);
      /**
       * An OpenLayers Layer.
       * @type {ol/layer/Layer~Layer}
       * @private
       */
      this.olLayer = this.mapboxLayer.olLayer;
    }
    super.init(map);

    if (!this.map) {
      return;
    }

    // Apply the initial visibiltity.
    const { mbMap } = this.mapboxLayer;
    if (!mbMap) {
      // If the mbMap is not yet created because the  map has no target yet, we
      // relaunch the initialisation when it's the case.
      this.olListenersKeys.push(
        this.map.on('change:target', () => {
          this.init(map);
        }),
      );

      return;
    }

    // mbMap.loaded() and mbMap.isStyleLoaded() are reliable only on the first call of init.
    // On the next call (when a topic change for example), these functions returns false because
    // the style is being modified.
    // That's why we rely on a property instead for the next calls.
    if (this.mapboxLayer.loaded || mbMap.isStyleLoaded() || mbMap.loaded()) {
      this.onLoad();
    } else {
      mbMap.once('load', this.onLoad);
    }

    // Apply the visibiltity when layer's visibility change.
    this.olListenersKeys.push(
      this.on('change:visible', (evt) => {
        // Once the map is loaded we can apply vsiiblity without waiting
        // the style. Mapbox take care of the application of style changes.
        this.applyLayoutVisibility(evt);
      }),
    );

    this.olListenersKeys.push(
      this.mapboxLayer.on('load', () => {
        this.onLoad();
      }),
    );
  }

  /**
   * Terminate the layer.
   * @param {mapboxgl.Map} map the mapbox map.
   * @override
   */
  terminate(map) {
    const { mbMap } = this.mapboxLayer;
    if (mbMap) {
      mbMap.off('load', this.onLoad);
      this.removeStyleLayers();
    }
    super.terminate(map);
  }

  /** @ignore */
  addStyleLayers() {
    const { mbMap } = this.mapboxLayer;

    if (!mbMap) {
      return;
    }

    this.styleLayers.forEach((styleLayer) => {
      const { id, source } = styleLayer;
      if (mbMap.getSource(source) && !mbMap.getLayer(id)) {
        mbMap.addLayer(styleLayer, this.beforeId);
      }
    });
    this.applyLayoutVisibility();
  }

  /** @ignore */
  removeStyleLayers() {
    const { mbMap } = this.mapboxLayer;

    if (!mbMap) {
      return;
    }

    this.styleLayers.forEach((styleLayer) => {
      if (mbMap.getLayer(styleLayer.id)) {
        mbMap.removeLayer(styleLayer.id);
      }
    });
  }

  /**
   * On Mapbox map load callback function. Add style layers and dynaimc filters.
   * @ignore
   */
  onLoad() {
    this.addStyleLayers();

    if (this.addDynamicFilters) {
      this.addDynamicFilters();
    }

    const { mbMap } = this.mapboxLayer;
    const style = mbMap.getStyle();
    if (style && this.styleLayersFilter) {
      const styles = style.layers.filter(this.styleLayersFilter);
      this.disabled = !styles.length;
    }
  }

  /**
   * Request feature information for a given coordinate.
   * @param {ol/coordinate~Coordinate} coordinate Coordinate to request the information at.
   * @return {Promise<FeatureInfo>} Promise with features, layer and coordinate.
   */
  getFeatureInfoAtCoordinate(coordinate) {
    const { mbMap } = this.mapboxLayer;

    // Ignore the getFeatureInfo until the mapbox map is loaded
    if (!mbMap || !mbMap.isStyleLoaded()) {
      return Promise.resolve({ coordinate, features: [], layer: this });
    }

    // We query features only on style layers used by this layer.
    let layers = this.styleLayers || [];

    if (this.styleLayersFilter) {
      layers = mbMap.getStyle().layers.filter(this.styleLayersFilter);
    }

    if (this.queryRenderedLayersFilter) {
      layers = mbMap.getStyle().layers.filter(this.queryRenderedLayersFilter);
    }

    return this.mapboxLayer
      .getFeatureInfoAtCoordinate(coordinate, {
        layers: layers.map((layer) => layer && layer.id),
        validate: false,
      })
      .then((featureInfo) => {
        const features = featureInfo.features.filter((feature) =>
          this.featureInfoFilter(feature, this.map.getView().getResolution()),
        );
        this.highlight(features);
        return { ...featureInfo, features, layer: this };
      });
  }

  /**
   * Set filter that determines which features should be rendered in a style layer.
   * @param {mapboxgl.filter} filter Determines which features should be rendered in a style layer.
   */
  setFilter(filter) {
    const { mbMap } = this.mapboxLayer;

    if (!mbMap) {
      return;
    }

    this.styleLayers.forEach(({ id }) => {
      if (mbMap.getLayer(id)) {
        mbMap.setFilter(id, filter);
      }
    });
  }

  /**
   * Set if features are hovered or not.
   * @param {Array<ol/Feature~Feature>} features
   * @param {boolean} state Is the feature hovered
   * @private
   */
  setHoverState(features, state) {
    const { mbMap } = this.mapboxLayer;

    if (!features || !mbMap) {
      return;
    }

    features.forEach((feature) => {
      const { source, sourceLayer } = feature.get('mapboxFeature') || {};
      if ((!source && !sourceLayer) || !feature.getId()) {
        if (!feature.getId()) {
          // eslint-disable-next-line no-console
          console.warn(
            "No feature's id found. To use the feature state functionnality, tiles must be generated with --generate-ids. See https://github.com/mapbox/tippecanoe#adding-calculated-attributes.",
            feature.getId(),
            feature.getProperties(),
          );
        }
        return;
      }

      mbMap.setFeatureState(
        {
          id: feature.getId(),
          source,
          sourceLayer,
        },
        { hover: state },
      );
    });
  }

  /**
   * Select a list of features.
   * @param {Array<ol/Feature~Feature>} [features=[]] Features to select.
   * @private
   */
  select(features = []) {
    this.setHoverState(this.selectedFeatures, false);
    this.selectedFeatures = features;
    this.setHoverState(this.selectedFeatures, true);
  }

  /**
   * Highlight a list of features.
   * @param {Array<ol/Feature~Feature>} [features=[]] Features to highlight.
   * @private
   */
  highlight(features = []) {
    // Filter out selected features
    const filtered = this.highlightedFeatures.filter(
      (feature) =>
        !this.selectedFeatures
          .map((feat) => feat.getId())
          .includes(feature.getId()),
    );

    // Remove previous highlight
    this.setHoverState(filtered, false);
    this.highlightedFeatures = features;

    // Add highlight
    this.setHoverState(this.highlightedFeatures, true);
  }

  /**
   * Apply visibility to style layers that fits the styleLayersFilter function.
   * @param {Event} evt Layer's event that has called the function.
   * @private
   */
  // eslint-disable-next-line no-unused-vars
  applyLayoutVisibility(evt) {
    const { visible } = this;
    const { mbMap } = this.mapboxLayer;
    const filterFunc = this.styleLayersFilter;

    if (!mbMap) {
      return;
    }

    const style = mbMap.getStyle();

    if (!style) {
      return;
    }

    if (filterFunc) {
      const visibilityValue = visible ? 'visible' : 'none';
      for (let i = 0; i < style.layers.length; i += 1) {
        const styleLayer = style.layers[i];
        if (filterFunc(styleLayer)) {
          if (mbMap.getLayer(styleLayer.id)) {
            mbMap.setLayoutProperty(
              styleLayer.id,
              'visibility',
              visibilityValue,
            );
          }
        }
      }
    }
  }

  /**
   * Create a copy of the MapboxStyleLayer.
   * @param {Object} newOptions Options to override.
   * @return {MapboxStyleLayer} A MapboxStyleLayer.
   */
  clone(newOptions) {
    return new MapboxStyleLayer({ ...this.options, ...newOptions });
  }
}

export default MapboxStyleLayer;

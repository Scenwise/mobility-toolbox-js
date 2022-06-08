import TrackerLayer from './TrackerLayer';
import mixin from '../../common/mixins/TralisLayerMixin';
import { toLonLat } from 'ol/proj';
import { getTypeIndex } from '../../common/trackerConfig';

/**
 * Responsible for loading and display data from a Tralis service.
 *
 * @example
 * import { TralisLayer } from 'mobility-toolbox-js/mapbox';
 *
 * const layer = new TralisLayer({
 *   url: [yourUrl],
 *   apiKey: [yourApiKey],
 * });
 *
 *
 * @see <a href="/api/class/src/api/tralis/TralisAPI%20js~TralisAPI%20html">TralisAPI</a>
 *
 * @extends {TrackerLayer}
 * @implements {TralisLayerInterface}
 */
class TralisLayer extends mixin(TrackerLayer) {
  /**
   * Determine if the trajectory must be removed or not added to the list
   *
   * @private
   */
  mustNotBeDisplayed(trajectory, extent, zoom) {
    return super.mustNotBeDisplayed(
      trajectory,
      extent || this.getMercatorExtent(),
      zoom || Math.floor(this.map.getZoom() + 1),
    );
  }

  /**
   * Send the current bbox to the websocket
   */
  setBbox(extent, zoom) {
    let newExtent = extent;
    let newZoom = zoom;
    if (!newExtent && this.isUpdateBboxOnMoveEnd) {
      newExtent = extent || this.getMercatorExtent();
      newZoom = Math.floor(this.getOlZoom());
    }
    super.setBbox(newExtent, newZoom);
  }

  /**
   * Send the new BBOX to the websocket.
   *
   * @param {ol/MapEvent~MapEvent} evt Moveend event
   * @private
   * @override
   */
  onMoveEnd(evt) {
    super.onMoveEnd(evt);

    if (this.visible && this.isUpdateBboxOnMoveEnd) {
      this.setBbox();
    }

    // if (
    //   this.visible &&
    //   this.isUpdateBboxOnMoveEnd &&
    //   this.isClickActive &&
    //   this.selectedVehicleId
    // ) {
    //   this.highlightTrajectory(this.selectedVehicleId);
    // }
  }

  /**
   * Callback when user clicks on the map.
   * It sets the layer's selectedVehicleId property with the current selected vehicle's id.
   *
   * @private
   * @override
   */
   onFeatureClick(features, layer, coordinate) {
    super.onFeatureClick(features, layer, coordinate);
    if (this.selectedVehicleId) {
      this.highlightTrajectory(this.selectedVehicleId);
    }
  }

  /**
   * Highlight the trajectory of journey.
   * @private
   */
  highlightTrajectory(id) {
    if (this.selectedVehicleId === this.previousVehicleId) {
      console.log("same as  previous")
      this.map.getSource("selectedLineTraject").setData({"type": "FeatureCollection", "features": []})
    }
    else {
      console.log("different")
      this.api
        .getFullTrajectory(id, this.mode, this.generalizationLevel)
        .then((fullTrajectory) => {
          const stroke = fullTrajectory.features[0].properties.stroke
          if (stroke && stroke[0] !== '#') {
            fullTrajectory.features[0].properties.stroke = `#${stroke}`;
          }
          const type = fullTrajectory.features[0].properties.type
          fullTrajectory.features[0].properties.typeIdx = getTypeIndex(type)
          fullTrajectory.features[0].geometry.geometries.forEach(element => {
            const newCoords = []
            for (const coord of element.coordinates) {
              newCoords.push(toLonLat(coord))
            }
            element.coordinates = newCoords
          });
          this.map.getSource("selectedLineTraject").setData(fullTrajectory)
        })
    }
  }

  /**
   * Create a copy of the TralisLayer.
   * @param {Object} newOptions Options to override
   * @return {TralisLayer} A TralisLayer
   */
  clone(newOptions) {
    return new TralisLayer({ ...this.options, ...newOptions });
  }
}

export default TralisLayer;

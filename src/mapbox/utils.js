import { fromLonLat } from 'ol/proj';
import { getWidth, getHeight } from 'ol/extent';
import { matrix, multiply } from 'mathjs';

/**
 * Get the current resolution of a Mapbox map.
 * @param {mapboxgl.Map} map A map object.
 * @private
 */
export const getResolution = (map) => {
  const bounds = map.getBounds().toArray();
  const extent = [...fromLonLat(bounds[0]), ...fromLonLat(bounds[1])];
  const { width, height } = map.getCanvas();
  const xResolution = getWidth(extent) / width;
  const yResolution = getHeight(extent) / height;
  return Math.max(xResolution, yResolution);
};

const projectWithRotation = (map, { lng, lat }) => {
  const pixelRatio = window.devicePixelRatio || 1;
  const { x, y } = map.project({ lng, lat });
  const { width, height } = map.getCanvas();

  // return [
  //   x *pixelRatio ,
  //   y *pixelRatio,
  // ];
  const angle = (-map.getBearing() * Math.PI) / 180;
  // https://lexique.netmath.ca/en/rotation-in-a-cartesian-plane/#:~:text=Formulas,%E2%88%92x%2C%E2%88%92y).
  const matrixx = matrix([
    [Math.cos(angle), -Math.sin(angle)],
    [Math.sin(angle), Math.cos(angle)],
  ]);
  const rotationXPlaneOrigin = width / 2;
  const rotationYPlaneOrigin = height / 2;
  const xInNewPlane = x * pixelRatio - rotationXPlaneOrigin;
  const yInNewPlane = y * pixelRatio - rotationYPlaneOrigin;
  const rotatedPixelInNewPlane = multiply(
    [xInNewPlane, yInNewPlane],
    matrixx,
  ).toArray();
  return [
    rotatedPixelInNewPlane[0] + rotationXPlaneOrigin,
    rotatedPixelInNewPlane[1] + rotationYPlaneOrigin,
  ];
};
/**
 * Get the canvas source coordinates of the current map's extent.
 * @param {mapboxgl.Map} map A map object.
 * @private
 */
export const getSourceCoordinates = (map) => {
  const bounds = map.getBounds().toArray();
  // const { width, height } = map.getCanvas();
  // const centerPx = map.project(map.getCenter());
  // const nw = map.unproject(
  //   projectWithRotation(map, map.getBounds().getNorthWest()),
  // );
  // const se = map.unproject(
  //   projectWithRotation(map, map.getBounds().getSouthEast()),
  // );

  // const nw = map.unproject([0, 0]);
  // const se = map.unproject([1232, 1232]);
  // console.log('nwse', nw, se);
  // console.log('bounds', bounds);
  // console.log('bounds2', [
  //   [bounds[0][0], bounds[1][1]],
  //   [...bounds[1]],
  //   [bounds[1][0], bounds[0][1]],
  //   [...bounds[0]],
  // ]);
  // console.log('sourcecoord', [
  //   [nw.lng, nw.lat],
  //   [se.lng, nw.lat],
  //   [se.lng, se.lat],
  //   [nw.lng, se.lat],
  // ]);
  // console.log('sourcecoord2', [
  //   [se.lng, se.lat],
  //   [se.lng, nw.lat],
  //   [nw.lng, nw.lat],
  //   [nw.lng, se.lat],
  // ]);
  // return [
  //   [nw.lng, nw.lat],
  //   [se.lng, nw.lat],
  //   [se.lng, se.lat],
  //   [nw.lng, se.lat],
  // ];
  return [
    [bounds[0][0], bounds[1][1]],
    [...bounds[1]],
    [bounds[1][0], bounds[0][1]],
    [...bounds[0]],
  ];
};

export default {
  getResolution,
  getSourceCoordinates,
};

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

const projectWithRotation = (map, { x, y }) => {
  const pixelRatio = window.devicePixelRatio || 1;
  const { width, height } = map.getCanvas();

  // return [
  //   x *pixelRatio ,
  //   y *pixelRatio,
  // ];
  const angle = (map.getBearing() * Math.PI) / 180;
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

// eslint-disable-next-line no-unused-vars
const displayCurrCanvasWidthAndHeight = (map) => {
  const { width, height } = map.getCanvas();

  // The bounds doesn't keep the same size after a rotation,
  // so we have to keep the same width and height for the canvas,
  // because pixel coordinate are defined with this size.
  const nw = map.unproject(projectWithRotation(map, { x: 0, y: 0 }));
  const se = map.unproject(projectWithRotation(map, { x: width, y: height }));
  const sw = map.unproject(projectWithRotation(map, { x: 0, y: height }));
  const northWestPixel = map.project(nw);
  const northEastPixel = map.project(se);
  const widthh = Math.sqrt(
    (northWestPixel.x - northEastPixel.x) ** 2 +
      (northWestPixel.y - northEastPixel.y) ** 2,
  );
  const southWestPixel = map.project(sw);
  const heightt = Math.sqrt(
    (northWestPixel.x - southWestPixel.x) ** 2 +
      (northWestPixel.y - southWestPixel.y) ** 2,
  );
  console.log(widthh, heightt);
};

/**
 * Get the canvas source coordinates of the current map's extent.
 * @param {mapboxgl.Map} map A map object.
 * @private
 */
export const getSourceCoordinates = (map) => {
  // const { width, height } = map.getCanvas();
  // const nw = map.unproject([0, 0]);
  // const se = map.unproject([width, height]);
  // return [
  //   [nw.lng, nw.lat],
  //   [se.lng, nw.lat],
  //   [se.lng, se.lat],
  //   [nw.lng, se.lat],
  // ];
  // The bounds doesn't keep the same size after a rotation,
  // so we have to define the goodbounds for the current canvas's size
  // because pixel coordinate are defined with this size.
  const { width, height } = map.getCanvas();
  const nw = map.unproject(projectWithRotation(map, { x: 0, y: 0 }));
  const se = map.unproject(projectWithRotation(map, { x: width, y: height }));
  return [
    [nw.lng, nw.lat],
    [se.lng, nw.lat],
    [se.lng, se.lat],
    [nw.lng, se.lat],
  ];
  // const bounds = map.getBounds().toArray();
  // return [
  //   [bounds[0][0], bounds[1][1]],
  //   [...bounds[1]],
  //   [bounds[1][0], bounds[0][1]],
  //   [...bounds[0]],
  // ];
};

export default {
  getResolution,
  getSourceCoordinates,
};

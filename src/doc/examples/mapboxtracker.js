import { Map } from 'mapbox-gl';
import { TrajservLayer } from '../../mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

export default () => {
  const map = new Map({
    container: 'map',
    style: `https://maps.geops.io/styles/travic/style.json?key=${window.apiKey}`,
    center: [7.47, 46.95],
    zoom: 12,
    bearing: 0,
    touchPitch: false,
    pitchWithRotate: false,
  });

  map.on('mousemove', function (e) {
    document.getElementById('info').innerHTML =
      // e.point is the x, y coordinates of the mousemove event relative
      // to the top-left corner of the map
      `${JSON.stringify(e.point)}<br />${
        // e.lngLat is the longitude, latitude geographical position of the event
        JSON.stringify(e.lngLat.wrap())
      }`;
  });

  const tracker = new TrajservLayer({
    url: 'https://api.geops.io/tracker/v1',
    apiKey: window.apiKey,
  });

  tracker.onClick((vehicle) => {
    // eslint-disable-next-line no-console
    console.log(vehicle);
  });

  map.on('load', () => {
    tracker.init(map, 'waterway-name');
  });
};

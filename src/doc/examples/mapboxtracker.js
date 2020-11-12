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
  // onpage load: 50 deg
  // 0: (2) [7.3210252971519765, 47.05159893883189]
  // 1: (2) [7.618974702850295, 47.05159893883189]
  // 2: (2) [7.618974702850295, 46.84820783536637]
  // 3: (2) [7.3210252971519765, 46.84820783536637

  // onpage load: 00 deg
  // 0: (2) [7.36425659179497, 47.02213561832119]
  // 1: (2) [7.575743408201589, 47.02213561832119]
  // 2: (2) [7.575743408201589, 46.87776702922881]
  // 3: (2) [7.36425659179497, 46.87776702922881]

  //   0: (2) [7.363794066150234, 47.022329333587464]
  // 1: (2) [7.575280882556882, 47.022329333587464]
  // 2: (2) [7.575280882556882, 46.87796126771539]
  // 3: (2) [7.363794066150234, 46.87796126771539]
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

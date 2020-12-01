import View from 'ol/View';
import { Map, MapboxLayer } from '../../ol';
import Copyright from '../../ol/controls/Copyright';
import 'ol/ol.css';

export default () => {
  // Define a custom copyright
  const control = new Copyright({
    target: document.getElementById('copyright'),
    element: document.createElement('div'),
    render() {
      this.element.innerHTML = this.active
        ? this.getCopyrights().join(' & ')
        : '';
    },
  });

  const mapboxLayer = new MapboxLayer({
    url: `https://maps.geops.io/styles/base_bright_v2/style.json?key=${window.apiKey}`,
  });

  const map = new Map({
    target: 'map',
    controls: [control],
    layers: [mapboxLayer],
    view: new View({
      center: [950690.34, 6003962.67],
      zoom: 15,
    }),
  });

  // Add example button to toggle the copyright control.
  document.getElementById('button').addEventListener('click', () => {
    if (control.element.parentNode) {
      map.removeMobilityControl(control);
    } else {
      map.addMobilityControl(control);
    }
  });
};
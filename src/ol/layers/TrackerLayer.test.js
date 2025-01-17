import Map from 'ol/Map';
import View from 'ol/View';
import TrackerLayer from './TrackerLayer';

let layer;
let onClick;

describe('TrackerLayer', () => {
  beforeEach(() => {
    onClick = jest.fn();
    layer = new TrackerLayer({
      onClick,
    });
  });

  test('should be instanced.', () => {
    expect(layer).toBeInstanceOf(TrackerLayer);
    expect(layer.clickCallbacks[0]).toBe(onClick);
  });

  test('should called terminate on initalization.', () => {
    const spy = jest.spyOn(layer, 'terminate');
    layer.init(
      new Map({
        view: new View({
          center: [831634, 5933959],
          zoom: 9,
        }),
      }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('#onClick', () => {
    const f = () => {};
    layer.onClick(f);
    expect(layer.clickCallbacks[1]).toBe(f);
    expect(layer.clickCallbacks.length).toBe(2);
    layer.onClick(f);
    expect(layer.clickCallbacks.length).toBe(2);
  });

  test('#unClick', () => {
    const foo = () => {};
    const bar = () => {};
    layer.onClick(foo);
    layer.onClick(bar);
    expect(layer.clickCallbacks[1]).toBe(foo);
    expect(layer.clickCallbacks[2]).toBe(bar);
    expect(layer.clickCallbacks.length).toBe(3);
    layer.unClick(foo);
    expect(layer.clickCallbacks[1]).toBe(bar);
    expect(layer.clickCallbacks.length).toBe(2);
  });

  describe('#terminate', () => {
    test('should set container to null', () => {
      layer.container = 'foo';
      layer.terminate();
      expect(layer.container).toBe(null);
    });
  });

  test('should clone', () => {
    const clone = layer.clone({ name: 'clone' });
    expect(clone).not.toBe(layer);
    expect(clone.name).toBe('clone');
    expect(clone).toBeInstanceOf(TrackerLayer);
  });
});

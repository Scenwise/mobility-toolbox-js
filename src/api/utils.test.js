import { handleError, cleanParams, readJsonResponse } from './utils';

describe('cleanParams()', () => {
  test('deletes property which value is undefined', () => {
    let obj = {
      foo: 'bar',
      bar: 'foo',
      quux: undefined,
      testNull: null,
      testEmptyString: '',
    };
    expect(Object.keys(obj).includes('quux')).toBe(true);
    expect(Object.keys(obj).includes('testNull')).toBe(true);
    expect(Object.keys(obj).includes('testEmptyString')).toBe(true);
    obj = cleanParams(obj);
    expect(Object.keys(obj).includes('quux')).toBe(false);
    expect(Object.keys(obj).includes('testNull')).toBe(false);
    expect(Object.keys(obj).includes('testEmptyString')).toBe(true);
  });
});

class MockResponse {
  constructor(body) {
    this.body = body;
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
}

describe('readJsonResponse()', () => {
  test('returns the json object', (done) => {
    readJsonResponse(new MockResponse('{}')).then((data) => {
      expect({}).toEqual(data);
      done();
    });
  });

  test('throws error if the response contains an error message', (done) => {
    readJsonResponse(new MockResponse('{"error":"foo2"}')).catch((err) => {
      expect(err.toString()).toBe('Error: foo2');
      done();
    });
  });

  test('throws error if the response is not a json', (done) => {
    readJsonResponse(new MockResponse('')).catch((err) => {
      expect(err.toString()).toBe(
        'Error: SyntaxError: Unexpected end of JSON input',
      );
      done();
    });
  });
});

describe('handleError()', () => {
  test('ignores AbortError', () => {
    const a = handleError('foo', { name: 'AbortError' });
    expect(a).toBe();
  });

  test('throws others errors and display a warn message', (done) => {
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    try {
      handleError('foo', new Error('blabla'));
    } catch (err) {
      expect(err.toString()).toBe('Error: blabla');
      expect(spy).toBeCalledWith('Fetch foo request failed: ', err);
      spy.mockRestore();
      done();
    }
  });
});
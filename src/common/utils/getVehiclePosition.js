import GeomType from 'ol/geom/GeometryType';

/**
 * Interpolate or not the vehicle position from a trajectory at a specific date.
 *
 * @param {number} now Current date to interpolate a position with. In ms.
 * @param {TralisTrajectory} trajectory The trajectory to interpolate.
@returns
 */
const getVehiclePosition = (now, trajectory, noInterpolate) => {
  const {
    time_intervals: timeIntervals,
    olGeometry: geometry,
    coordinate,
  } = trajectory.properties;

  let coord;
  let rotation;

  if (noInterpolate && coordinate) {
    coord = coordinate;
  } else if (geometry.getType() === GeomType.POINT) {
    coord = geometry.getCoordinates();
  } else if (geometry.getType() === GeomType.LINE_STRING) {
    const intervals = timeIntervals || [[]];
    const firstInterval = intervals[0];
    const lastInterval = intervals[intervals.length - 1];

    // Between the last time interval of a trajectory event and the beginning
    // of the new trajectory event, there is few seconds, can be 6 to 30
    // seconds (that's why the vehicle jumps sometimes).
    // So we make the choice here to display the last (or the first) position
    // of an trajectory event instead of removing them, if the current date is
    // outside the time intervals we display the vehicle at the last (or first) position known.
    if (now < firstInterval[0]) {
      // Display first position known.
      [, , rotation] = firstInterval;
      coord = geometry.getFirstCoordinate();
    } else if (now > lastInterval[0]) {
      // Display last position known.
      [, , rotation] = lastInterval;
      coord = geometry.getLastCoordinate();
    } else {
      // Interpolate position using time intervals.
      for (let j = 0; j < intervals.length - 1; j += 1) {
        // Rotation only available in tralis layer.
        const [start, startFrac] = intervals[j];
        const [end, endFrac] = intervals[j + 1];

        if (start <= now && now <= end) {
          // interpolate position inside the time interval.
          const timeFrac = Math.min((now - start) / (end - start), 1);
          const geomFrac = timeFrac * (endFrac - startFrac) + startFrac;
          coord = geometry.getCoordinateAt(geomFrac);
          [, , rotation] = intervals[j];
          break;
        }
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(
      'This geometry type is not supported. Only Point or LineString are. Current geometry: ',
      geometry,
    );
  }

  return { coord, rotation };
};

export default getVehiclePosition;

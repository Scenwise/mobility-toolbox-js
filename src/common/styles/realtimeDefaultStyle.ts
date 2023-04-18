import type {
  RealtimeTrajectory,
  ViewState,
  StyleCache,
  RealtimeStyleOptions,
  RealtimeStyleFunction,
} from '../../types';
import createCanvas from '../utils/createCanvas';

/** @private */
const cacheDelayBg: StyleCache = {};

/**
 * Draw circle delay background
 *
 * @private
 */
export const getDelayBgCanvas = (
  origin: number,
  radius: number,
  color: string,
) => {
  const key = `${origin}, ${radius}, ${color}`;
  if (!cacheDelayBg[key]) {
    const canvas = createCanvas(origin * 2, origin * 2);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.beginPath();
      ctx.arc(origin, origin, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.filter = 'blur(1px)';
      ctx.fill();
      cacheDelayBg[key] = canvas;
    }
  }
  return cacheDelayBg[key];
};

/** @private */
const cacheDelayText: StyleCache = {};

/**
 * Draw delay text
 *
 * @private
 */
export const getDelayTextCanvas = (
  text: string,
  fontSize: number,
  font: string,
  delayColor: string,
  delayOutlineColor: string = '#000',
  pixelRatio: number = 1,
) => {
  const key = `${text}, ${font}, ${delayColor}, ${delayOutlineColor}, ${pixelRatio}`;
  if (!cacheDelayText[key]) {
    const canvas = createCanvas(
      Math.ceil(text.length * fontSize),
      Math.ceil(fontSize + 8 * pixelRatio),
    );
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = font;
      ctx.fillStyle = delayColor;
      ctx.strokeStyle = delayOutlineColor;
      ctx.lineWidth = 1.5 * pixelRatio;
      ctx.strokeText(text, 0, fontSize);
      ctx.fillText(text, 0, fontSize);
      cacheDelayText[key] = canvas;
    }
  }
  return cacheDelayText[key];
};

/** @private */
const cacheCircle: StyleCache = {};

/**
 * Draw colored circle with black border
 *
 * @private
 */
export const getCircleCanvas = (
  origin: number,
  radius: number,
  color: string,
  hasStroke: boolean,
  hasDash: boolean,
  pixelRatio: number,
) => {
  const key = `${origin}, ${radius}, ${color}, ${hasStroke},  ${hasDash}, ${pixelRatio}`;
  if (!cacheCircle[key]) {
    const canvas = createCanvas(origin * 2, origin * 2);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.fillStyle = color;

      if (hasStroke) {
        ctx.lineWidth = 1 * pixelRatio;
        ctx.strokeStyle = '#000000';
      }

      ctx.beginPath();
      ctx.arc(origin, origin, radius, 0, 2 * Math.PI, false);
      ctx.fill();

      if (hasDash) {
        ctx.setLineDash([5, 3]);
      }

      if (hasStroke) {
        ctx.stroke();
      }

      cacheCircle[key] = canvas;
    }
  }
  return cacheCircle[key];
};

/** @private */
const cacheText: StyleCache = {};

/**
 * Draw text in the circle
 *
 * @private
 */
export const getTextCanvas = (
  text: string,
  origin: number,
  textSize: number,
  fillColor: string,
  strokeColor: string,
  hasStroke: boolean,
  pixelRatio: number,
) => {
  const key = `${text}, ${origin}, ${textSize}, ${fillColor},${strokeColor}, ${hasStroke}, ${pixelRatio}`;
  if (!cacheText[key]) {
    const canvas = createCanvas(origin * 2, origin * 2);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      // Draw a stroke to the text only if a provider provides realtime but we don't use it.
      if (hasStroke) {
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = `bold ${textSize + 2}px Arial`;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(text, origin, origin);
        ctx.restore();
      }

      // Draw a text
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = fillColor;
      ctx.font = `bold ${textSize}px Arial`;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, origin, origin);
      ctx.fillText(text, origin, origin);

      cacheText[key] = canvas;
    }
  }
  return cacheText[key];
};

/** @private */
const cache: StyleCache = {};

/**
 * A tracker style that take in account the delay.
 *
 * @param {RealtimeTrajectory} trajectory The trajectory to render.
 * @param {ViewState} viewState The view state of the map.
 * @param {RealtimeStyleOptions} options Some options to change the rendering
 * @return a canvas
 */
const realtimeDefaultStyle: RealtimeStyleFunction = (
  trajectory: RealtimeTrajectory,
  viewState: ViewState,
  options: RealtimeStyleOptions,
) => {
  const {
    hoverVehicleId,
    selectedVehicleId,
    useDelayStyle,
    delayOutlineColor = '#000',
    delayDisplay = 300000,
    getRadius = () => 0,
    getBgColor = () => '#000',
    getDelayColor = () => '#000',
    getDelayText = () => null,
    getTextColor = () => '#000',
    getTextSize = () => 0,
    getMaxRadiusForText = () => 10,
    getMaxRadiusForStrokeAndDelay = () => 7,
  } = options;

  const { zoom, pixelRatio = 1 } = viewState;
  let { type } = trajectory.properties;
  const {
    train_id: id,
    line,
    delay,
    state,
    operator_provides_realtime_journey: operatorProvidesRealtime,
  } = trajectory.properties;
  let { name, text_color: textColor, color } = line || {};

  const cancelled = state === 'JOURNEY_CANCELLED';

  if (!type) {
    type = 'Rail';
  }

  if (!name) {
    name = 'I';
  }

  if (!textColor) {
    textColor = '#000000';
  }

  if (color && color[0] !== '#') {
    color = `#${color}`;
  }

  if (textColor[0] !== '#') {
    textColor = `#${textColor}`;
  }

  const z = Math.min(Math.floor(zoom || 1), 16);
  const hover = !!(hoverVehicleId && hoverVehicleId === id);
  const selected = !!(selectedVehicleId && selectedVehicleId === id);

  // Calcul the radius of the circle
  let radius = getRadius(type, z) * pixelRatio;
  const isDisplayStrokeAndDelay =
    radius >= getMaxRadiusForStrokeAndDelay() * pixelRatio;

  if (hover || selected) {
    radius = isDisplayStrokeAndDelay
      ? radius + 5 * pixelRatio
      : 14 * pixelRatio;
  }
  const isDisplayText = radius > getMaxRadiusForText() * pixelRatio;

  // Optimize the cache key, very important in high zoom level
  let key = `${radius}${hover || selected}`;

  if (useDelayStyle) {
    key += `${operatorProvidesRealtime}${delay}`;

    if (isDisplayStrokeAndDelay) {
      key += `${cancelled}`;
    }
  } else {
    key += `${color || type}`;

    if (isDisplayStrokeAndDelay) {
      key += `${cancelled}${delay}`;
    }
  }

  if (isDisplayText) {
    key += `${name}${textColor}`;
  }

  if (!cache[key]) {
    if (radius === 0) {
      return null;
    }

    const margin = 1 * pixelRatio;
    const radiusDelay = radius + 2 * pixelRatio;
    const markerSize = radius * 2;
    const size = radiusDelay * 2 + margin * 2;
    const origin = size / 2;

    // Draw circle delay background
    let delayBg = null;
    if (isDisplayStrokeAndDelay && delay !== null) {
      delayBg = getDelayBgCanvas(
        origin,
        radiusDelay,
        getDelayColor(delay, cancelled),
      );
    }

    // Show delay if feature is hovered or if delay is above 5mins.
    let delayText = null;
    let fontSize = 0;
    if (
      isDisplayStrokeAndDelay &&
      (hover || (delay || 0) >= delayDisplay || cancelled)
    ) {
      // Draw delay text
      fontSize =
        Math.max(
          cancelled ? 19 : 14,
          Math.min(cancelled ? 19 : 17, radius * 1.2),
        ) * pixelRatio;
      const text = getDelayText(delay, cancelled);

      if (text) {
        delayText = getDelayTextCanvas(
          text,
          fontSize,
          `bold ${fontSize}px arial, sans-serif`,
          getDelayColor(delay, cancelled, true),
          delayOutlineColor,
          pixelRatio,
        );
      }
    }

    // Draw colored circle with black border
    let circleFillColor;
    if (useDelayStyle) {
      circleFillColor = getDelayColor(delay, cancelled);
    } else {
      circleFillColor = color || getBgColor(type);
    }

    const hasStroke = isDisplayStrokeAndDelay || hover || selected;

    const hasDash =
      !!isDisplayStrokeAndDelay &&
      !!useDelayStyle &&
      delay === null &&
      operatorProvidesRealtime === 'yes';

    const circle = getCircleCanvas(
      origin,
      radius,
      circleFillColor,
      hasStroke,
      hasDash,
      pixelRatio,
    );

    // Create the canvas
    const width = size + (delayText?.width || 0) * 2;
    const height = size;
    const canvas = createCanvas(width, height);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      // The renderTrajectories will center the image on the vehicle positions.
      const originX = delayText?.width || 0;

      if (delayBg) {
        ctx.drawImage(delayBg, originX, 0);
      }

      if (circle) {
        ctx.drawImage(circle, originX, 0);
      }

      // Draw text in the circle
      let circleText = null;
      if (isDisplayText) {
        const fontSize2 = Math.max(radius, 10);
        const textSize = getTextSize(ctx, markerSize, name, fontSize2);
        const textColor2 = !useDelayStyle
          ? textColor || getTextColor(type)
          : '#000000';
        const hasStroke2 =
          !!useDelayStyle &&
          delay === null &&
          operatorProvidesRealtime === 'yes';

        circleText = getTextCanvas(
          name,
          origin,
          textSize,
          textColor2,
          circleFillColor,
          hasStroke2,
          pixelRatio,
        );
      }

      if (circleText) {
        ctx.drawImage(circleText, originX, 0);
      }

      if (delayText) {
        ctx.drawImage(
          delayText,
          originX + Math.ceil(origin + radiusDelay) + margin,
          Math.ceil(origin - fontSize),
        );
      }

      cache[key] = canvas;
    }
  }

  return cache[key];
};
export default realtimeDefaultStyle;

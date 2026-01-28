/**
 * @fileoverview Mathematical utilities for Bezier curves, 3D transformations, and color interpolation.
 * Provides core math functions used throughout the point cloud generator.
 */

/**
 * Canvas margin constants for curve editor rendering.
 */
export const TOP_MARGIN = 100;
export const BOTTOM_MARGIN = 50;
export const LEFT_MARGIN = 50;
export const RIGHT_MARGIN = 50;

/**
 * Calculates a point on a cubic Bezier curve using De Casteljau's algorithm.
 * 
 * @param {number} t - Parameter value in range [0, 1]
 * @param {number} p0 - Start point value
 * @param {number} p1 - First control point value
 * @param {number} p2 - Second control point value
 * @param {number} p3 - End point value
 * @returns {number} The interpolated value at parameter t
 */
export function cubicBezier(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

/**
 * Samples a value from a composite Bezier spline at a given parameter.
 * Handles multiple connected Bezier segments seamlessly.
 * 
 * @param {number} t - Overall progress along the spline in range [0, 1]
 * @param {Array<{x: number, y: number, cp1: {dx: number, dy: number}, cp2: {dx: number, dy: number}}>} points - Array of control points with handles
 * @param {'x'|'y'} axis - Which axis to sample ('x' or 'y')
 * @returns {number} The sampled value at parameter t
 */
export function sampleBezierSpline(t, points, axis) {
  if (points.length < 2) return points[0] ? points[0][axis] : 0;

  const n = points.length - 1;
  const rawT = t * n;
  let idx = Math.floor(rawT);
  const weight = rawT - idx;

  if (idx >= n) {
    idx = n - 1;
    return points[n][axis];
  }

  const pA = points[idx];
  const pB = points[idx + 1];

  const v0 = pA[axis];
  const v1 = pA[axis] + (axis === 'x' ? pA.cp2.dx : pA.cp2.dy);
  const v2 = pB[axis] + (axis === 'x' ? pB.cp1.dx : pB.cp1.dy);
  const v3 = pB[axis];

  return cubicBezier(weight, v0, v1, v2, v3);
}

/**
 * Projects a 3D point onto a 2D plane using perspective projection.
 * 
 * @param {number} x - 3D X coordinate
 * @param {number} y - 3D Y coordinate
 * @param {number} z - 3D Z coordinate (depth)
 * @param {number} centerX - 2D canvas center X
 * @param {number} centerY - 2D canvas center Y
 * @param {number} [fov=400] - Field of view / perspective scale factor
 * @returns {{x: number, y: number, scale: number}} Projected 2D coordinates and depth scale
 */
export function project3D(x, y, z, centerX, centerY, fov = 400) {
  const scale = fov / (fov + z);
  const x2d = x * scale + centerX;
  const y2d = y * scale + centerY;
  return { x: x2d, y: y2d, scale };
}

/**
 * Rotates a 3D point around the Y axis.
 * 
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @param {number} angle - Rotation angle in radians
 * @returns {{x: number, y: number, z: number}} Rotated coordinates
 */
export function rotateY(x, y, z, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - z * sin,
    y: y,
    z: x * sin + z * cos
  };
}

/**
 * Rotates a 3D point around the X axis.
 * 
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @param {number} angle - Rotation angle in radians
 * @returns {{x: number, y: number, z: number}} Rotated coordinates
 */
export function rotateX(x, y, z, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x,
    y: y * cos - z * sin,
    z: y * sin + z * cos
  };
}

/**
 * Linearly interpolates between two hex colors in RGB space.
 * 
 * @param {string} color1 - First hex color (e.g., '#ff0000')
 * @param {string} color2 - Second hex color (e.g., '#00ff00')
 * @param {number} t - Interpolation factor in range [0, 1]
 * @returns {string} Interpolated hex color
 */
export function interpolateColor(color1, color2, t) {
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

/**
 * @fileoverview Point cloud surface generator using Bezier curve profiles.
 * Generates 3D point clouds from vertical and horizontal Bezier curves using
 * different geometry modes (sweep, revolution, sheet).
 */

import { cubicBezier, sampleBezierSpline, interpolateColor } from './math.js';

/**
 * Generates 3D point cloud surfaces from Bezier curve profiles.
 * Supports multiple geometry modes and color gradients.
 * 
 * @class
 * @example
 * const generator = new SurfaceGenerator();
 * const points = generator.generate(verticalCurve, horizontalCurve, {
 *   density: 50,
 *   height: 1.5,
 *   color: '#ff0000',
 *   colorMode: 'height'
 * });
 */
export class SurfaceGenerator {
    constructor() {
        this.points = [];
    }

    /**
     * Generates a 3D point cloud based on two Bezier curves and configuration parameters.
     * 
     * Geometry Modes:
     * - **sweep**: Sweeps the vertical profile along the horizontal curve
     * - **revolution**: Revolves the vertical profile around the Y axis
     * - **sheet**: Creates a height-mapped sheet using both curves
     * 
     * @param {Array<{x: number, y: number, cp1: Object, cp2: Object}>} verticalCurve - Vertical profile curve points
     * @param {Array<{x: number, y: number, cp1: Object, cp2: Object}>} horizontalCurve - Horizontal shape curve points
     * @param {Object} params - Generation parameters
     * @param {number} params.density - Number of points per axis (total points = density²)
     * @param {number} params.height - Height scale multiplier
     * @param {string} params.color - Primary hex color
     * @param {string} params.color2 - Secondary hex color for gradients
     * @param {'solid'|'height'|'depth'} params.colorMode - Color application mode
     * @param {number} params.noise - Noise intensity for random jitter [0-1]
     * @param {number} [params.gridWidth=400] - Grid width in world units
     * @param {number} [params.gridDepth=400] - Grid depth in world units
     * @returns {Array<{x: number, y: number, z: number, color: string}>} Generated point cloud
     */
    generate(verticalCurve, horizontalCurve, params) {
        const {
            density,
            height: heightScale,
            color,
            color2,
            colorMode,
            noise,
            gridWidth = 400,
            gridDepth = 400
        } = params;

        this.points = [];
        const steps = density;

        for (let i = 0; i <= steps; i++) {
            const v = i / steps;
            const vRadius = sampleBezierSpline(v, verticalCurve, 'x');
            const vHeight = sampleBezierSpline(v, verticalCurve, 'y');
            const yRaw = vHeight * heightScale * (gridWidth / 2);

            for (let j = 0; j <= steps; j++) {
                const u = j / steps;

                let finalX, finalY, finalZ;

                if (window.geometryMode === 'revolution') {
                    const angle = u * Math.PI * 2;
                    const rBase = (gridWidth / 2) * vRadius;
                    finalX = Math.cos(angle) * rBase;
                    finalZ = Math.sin(angle) * rBase;
                    finalY = -yRaw;
                } else if (window.geometryMode === 'sheet') {
                    finalX = (u - 0.5) * gridWidth;
                    finalZ = (v - 0.5) * gridDepth;
                    const hHeight = sampleBezierSpline(u, horizontalCurve, 'y');
                    const combinedY = (vHeight + hHeight) * heightScale * (gridWidth / 2);
                    finalY = -combinedY;
                } else {
                    const rawX = sampleBezierSpline(u, horizontalCurve, 'x');
                    const rawZ = sampleBezierSpline(u, horizontalCurve, 'y');

                    const baseX = (rawX - 0.5) * gridWidth;
                    const baseZ = (rawZ - 0.5) * gridDepth;

                    finalX = baseX * vRadius;
                    finalZ = baseZ * vRadius;
                    finalY = -yRaw;
                }

                if (noise > 0) {
                    const jitter = noise * 20;
                    finalX += (Math.random() - 0.5) * jitter;
                    finalY += (Math.random() - 0.5) * jitter;
                    finalZ += (Math.random() - 0.5) * jitter;
                }

                let finalColor = color;
                if (colorMode === 'height') {
                    finalColor = interpolateColor(color, color2, vHeight);
                } else if (colorMode === 'depth') {
                    const factor = Math.max(0, Math.min(1, (finalZ + (gridDepth / 2)) / gridDepth));
                    finalColor = interpolateColor(color, color2, factor);
                }

                this.points.push({
                    x: finalX,
                    y: finalY,
                    z: finalZ,
                    color: finalColor
                });
            }
        }

        return this.points;
    }
}

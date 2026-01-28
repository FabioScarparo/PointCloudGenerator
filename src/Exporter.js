/**
 * @fileoverview Export utilities for point clouds to PNG, SVG, and OBJ formats.
 * Handles 3D-to-2D projection for SVG export using the same transformation pipeline as WebGPU renderer.
 */

/**
 * Provides static methods for exporting point clouds to various file formats.
 * Supports PNG (raster), SVG (vector), and OBJ (3D model) exports.
 * 
 * @class
 */
export class Exporter {
    /**
     * Downloads a Blob object as a file by creating a temporary download link.
     * 
     * @param {Blob} blob - The blob data to download
     * @param {string} filename - The filename to save as
     * @private
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Exports the canvas content as a PNG image.
     * 
     * @param {HTMLCanvasElement} canvas - The canvas element to export
     * @param {string} [filename='point-cloud.png'] - The filename to save as
     */
    static toPNG(canvas, filename = 'point-cloud.png') {
        canvas.toBlob((blob) => {
            this.downloadBlob(blob, filename);
        }, 'image/png');
    }

    /**
     * Exports the point cloud as an SVG file with accurate 3D-to-2D projection.
     * Uses the same Model-View-Projection transformation pipeline as the WebGPU renderer
     * to ensure the exported SVG matches the viewport appearance exactly.
     * 
     * @param {Array<{x: number, y: number, z: number, color: string}>} points - The 3D points to export
     * @param {number} angleX - Rotation angle around X axis in radians
     * @param {number} angleY - Rotation angle around Y axis in radians
     * @param {number} zoom - Zoom factor
     * @param {number} offsetX - Pan offset in X direction
     * @param {number} offsetY - Pan offset in Y direction
     * @param {number} width - Viewport width in pixels
     * @param {number} height - Viewport height in pixels
     * @param {number} radius - Point radius in pixels
     * @param {string} bgColor - Background color as hex string
     * @param {boolean} bgTransparent - Whether the background should be transparent
     * @param {string} [filename='point-cloud.svg'] - The filename to save as
     */
    static toSVG(points, angleX, angleY, zoom, offsetX, offsetY, width, height, radius, bgColor, bgTransparent, filename = 'point-cloud.svg') {
        const aspect = width / height;

        const rotY = this.mat4RotateY(angleY);
        const rotX = this.mat4RotateX(angleX);
        const modelMat = this.mat4Multiply(rotX, rotY);

        const offX = isNaN(offsetX) ? 0 : offsetX;
        const offY = isNaN(offsetY) ? 0 : offsetY;

        const dist = 1000.0 / zoom;
        const viewMat = this.mat4Translate(offX, offY, -dist);

        const fovRad = (60 * Math.PI) / 180;
        const projMat = this.mat4Perspective(fovRad, aspect, 1.0, 5000.0);

        const mvMat = this.mat4Multiply(viewMat, modelMat);
        const mvpMat = this.mat4Multiply(projMat, mvMat);

        const transformed = [];

        for (const p of points) {
            const v = [p.x, p.y, p.z, 1.0];
            const out = this.vec4TransformMat4(v, mvpMat);

            if (out[3] === 0) continue;

            const ndc = {
                x: out[0] / out[3],
                y: out[1] / out[3],
                z: out[2] / out[3]
            };

            if (ndc.z < 0 || ndc.z > 1) continue;

            const screenX = (ndc.x * 0.5 + 0.5) * width;
            const screenY = ((-ndc.y) * 0.5 + 0.5) * height;
            const scale = (1000.0 / out[3]);

            transformed.push({
                x: screenX,
                y: screenY,
                r: radius * scale,
                zDepth: ndc.z,
                color: p.color
            });
        }

        transformed.sort((a, b) => b.zDepth - a.zDepth);

        const bgAttr = bgTransparent ? '' : ` style=\"background: ${bgColor};\"`;
        let svgContent = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${width}\" height=\"${height}\" viewBox=\"0 0 ${width} ${height}\"${bgAttr}>\n`;

        if (!bgTransparent) {
            svgContent += `<rect width=\"100%\" height=\"100%\" fill=\"${bgColor}\" />\n`;
        }

        svgContent += `<g id=\"point-cloud\">\n`;

        for (const p of transformed) {
            if (p.r < 0.1) continue;

            const r = Math.max(0.1, p.r).toFixed(2);
            const cx = p.x.toFixed(2);
            const cy = p.y.toFixed(2);

            svgContent += `  <circle cx=\"${cx}\" cy=\"${cy}\" r=\"${r}\" fill=\"${p.color}\" />\n`;
        }

        svgContent += `</g>\n`;
        svgContent += `</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        this.downloadBlob(blob, filename);
    }

    /**
     * Exports the point cloud as an OBJ file with vertex colors.
     * Each point becomes a vertex with RGB color data.
     * 
     * @param {Array<{x: number, y: number, z: number, color: string}>} points - The points to export
     * @param {string} [filename='point-cloud.obj'] - The filename to save as
     */
    static toOBJ(points, filename = 'point-cloud.obj') {
        let objContent = "# Point Cloud OBJ Export\n";

        for (const p of points) {
            const r = parseInt(p.color.substring(1, 3), 16) / 255;
            const g = parseInt(p.color.substring(3, 5), 16) / 255;
            const b = parseInt(p.color.substring(5, 7), 16) / 255;
            objContent += `v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)} ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}\n`;
        }

        const blob = new Blob([objContent], { type: 'text/plain;charset=utf-8' });
        this.downloadBlob(blob, filename);
    }

    /**
     * Multiplies two 4x4 matrices in column-major order.
     * 
     * @param {Float32Array} a - First matrix
     * @param {Float32Array} b - Second matrix
     * @returns {Float32Array} Result of a * b
     * @private
     */
    static mat4Multiply(a, b) {
        const out = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[k * 4 + i] * b[j * 4 + k];
                }
                out[j * 4 + i] = sum;
            }
        }
        return out;
    }

    /**
     * Creates a 4x4 rotation matrix around the Y axis.
     * 
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array} Rotation matrix
     * @private
     */
    static mat4RotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }

    /**
     * Creates a 4x4 rotation matrix around the X axis.
     * 
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array} Rotation matrix
     * @private
     */
    static mat4RotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    }

    /**
     * Creates a 4x4 translation matrix.
     * 
     * @param {number} x - X translation
     * @param {number} y - Y translation
     * @param {number} z - Z translation
     * @returns {Float32Array} Translation matrix
     * @private
     */
    static mat4Translate(x, y, z) {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ]);
    }

    /**
     * Creates a 4x4 perspective projection matrix for WebGPU (0-1 depth range).
     * 
     * @param {number} fov - Field of view in radians
     * @param {number} aspect - Aspect ratio (width / height)
     * @param {number} near - Near clipping plane distance
     * @param {number} far - Far clipping plane distance
     * @returns {Float32Array} Perspective projection matrix
     * @private
     */
    static mat4Perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, -f, 0, 0,
            0, 0, far / (near - far), -1,
            0, 0, (far * near) / (near - far), 0
        ]);
    }

    /**
     * Transforms a 4D vector by a 4x4 matrix.
     * 
     * @param {Array<number>} v - Vector [x, y, z, w]
     * @param {Float32Array} m - 4x4 transformation matrix
     * @returns {Array<number>} Transformed vector
     * @private
     */
    static vec4TransformMat4(v, m) {
        const x = v[0], y = v[1], z = v[2], w = v[3];
        const out = [0, 0, 0, 0];
        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
        out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
        return out;
    }
}

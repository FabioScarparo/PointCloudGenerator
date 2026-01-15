import { rotateY, rotateX, project3D } from './math.js';

export class Exporter {

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

    static toPNG(canvas, filename = 'point-cloud.png') {
        canvas.toBlob((blob) => {
            this.downloadBlob(blob, filename);
        }, 'image/png');
    }

    /**
   * Generates and downloads an SVG representation of the current 3D state.
   */
    static toSVG(points, angleX, angleY, zoom, width, height, radius, bgColor, bgTransparent, filename = 'point-cloud.svg') {
        const cx = width / 2;
        const cy = height / 2;

        const transformed = points.map(p => {
            const zx = p.x * zoom;
            const zy = p.y * zoom;
            const zz = p.z * zoom;

            let r = rotateY(zx, zy, zz, angleY);
            r = rotateX(r.x, r.y, r.z, angleX);

            const proj = project3D(r.x, r.y, r.z, cx, cy);
            return { ...proj, zDepth: r.z, color: p.color };
        });

        transformed.sort((a, b) => b.zDepth - a.zDepth);

        const bgAttr = bgTransparent ? '' : ` style="background: ${bgColor};"`;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${bgAttr}>\n`;

        if (!bgTransparent) {
            svgContent += `<rect width="100%" height="100%" fill="${bgColor}" />\n`;
        }

        svgContent += `<g id="point-cloud">\n`;

        for (const p of transformed) {
            if (p.scale <= 0) continue;

            const r = Math.max(0.5, radius * p.scale).toFixed(2);
            const cx_ = p.x.toFixed(2);
            const cy_ = p.y.toFixed(2);

            svgContent += `  <circle cx="${cx_}" cy="${cy_}" r="${r}" fill="${p.color}" />\n`;
        }

        svgContent += `</g>\n`;
        svgContent += `</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        this.downloadBlob(blob, filename);
    }

    /**
     * Exports the point cloud as an OBJ file (vertex only with colors).
     */
    static toOBJ(points, filename = 'point-cloud.obj') {
        let objContent = "# Point Cloud OBJ Export\n";

        for (const p of points) {
            // Hex to normalized RGB
            const r = parseInt(p.color.substring(1, 3), 16) / 255;
            const g = parseInt(p.color.substring(3, 5), 16) / 255;
            const b = parseInt(p.color.substring(5, 7), 16) / 255;

            // Standard OBJ vertex: v x y z r g b
            objContent += `v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)} ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}\n`;
        }

        const blob = new Blob([objContent], { type: 'text/plain;charset=utf-8' });
        this.downloadBlob(blob, filename);
    }
}

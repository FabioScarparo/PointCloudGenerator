import { cubicBezier, TOP_MARGIN, BOTTOM_MARGIN, LEFT_MARGIN, RIGHT_MARGIN } from './math.js';

export class CurveEditor {
    constructor(canvasId, isVertical = false, onChange) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isVertical = isVertical;
        this.onChange = onChange;
        this.theme = 'dark';
        this.pulse = 0;
        this.animationFrame = null;

        // Control points (normalized 0..1)
        // p0 and p3 are fixed start/end points
        // p1 and p2 are draggable control points
        this.points = [
            { x: 0, y: 0, fixed: true },  // Start
            { x: 0.33, y: 0, fixed: false }, // Control 1
            { x: 0.66, y: 0, fixed: false }, // Control 2
            { x: 1, y: 0, fixed: true }   // End
        ];

        // Initialize default shape based on orientation
        if (this.isVertical) {
            // Vertical profile: Base at Y=0 (bottom)
            this.points = [
                { x: 0.5, y: 0 },   // Bottom-center
                { x: 1.0, y: 0.5 },
                { x: 0.2, y: 0.8 },
                { x: 0.8, y: 1 }    // Top
            ];
        } else {
            // Horizontal shape: 
            this.points = [
                { x: 0, y: 0.5 },
                { x: 0.2, y: 0.2 },
                { x: 0.8, y: 0.8 },
                { x: 1, y: 0.5 }
            ];
        }

        this.dragIndex = -1;
        this.hoverIndex = -1;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Event Listeners
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.onMouseDown(e.touches[0]);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            // e.preventDefault(); // Prevent scrolling
            this.onMouseMove(e.touches[0]);
        }, { passive: false });
        window.addEventListener('touchend', (e) => this.onMouseUp(e));

        // Start Animation Loop
        this.animate();
    }

    animate() {
        this.pulse += 0.05;
        this.draw();
        this.animationFrame = requestAnimationFrame(this.animate.bind(this));
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    // Convert normalized coordinate (0..1) to canvas pixel
    toCanvas(p) {
        const w = this.canvas.width - LEFT_MARGIN - RIGHT_MARGIN;
        const h = this.canvas.height - TOP_MARGIN - BOTTOM_MARGIN;

        // Flip Y because canvas 0 is top
        return {
            x: LEFT_MARGIN + p.x * w,
            y: this.canvas.height - BOTTOM_MARGIN - p.y * h
        };
    }

    // Convert canvas pixel to normalized coordinate (0..1)
    fromCanvas(x, y) {
        const w = this.canvas.width - LEFT_MARGIN - RIGHT_MARGIN;
        const h = this.canvas.height - TOP_MARGIN - BOTTOM_MARGIN;

        let nx = (x - LEFT_MARGIN) / w;
        let ny = (this.canvas.height - BOTTOM_MARGIN - y) / h;

        // Clamp
        // nx = Math.max(0, Math.min(1, nx));
        // ny = Math.max(0, Math.min(1, ny));

        return { x: nx, y: ny };
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        // Draw grid/axes
        const isLight = this.theme === 'light';
        this.ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        // Draw some sub-grid lines
        const gridSteps = 4;
        for (let i = 1; i < gridSteps; i++) {
            const x = LEFT_MARGIN + (i / gridSteps) * (width - LEFT_MARGIN - RIGHT_MARGIN);
            const y = TOP_MARGIN + (i / gridSteps) * (height - TOP_MARGIN - BOTTOM_MARGIN);

            this.ctx.moveTo(x, TOP_MARGIN);
            this.ctx.lineTo(x, height - BOTTOM_MARGIN);
            this.ctx.moveTo(LEFT_MARGIN, y);
            this.ctx.lineTo(width - RIGHT_MARGIN, y);
        }
        this.ctx.stroke();

        // Determine baseline positions (normalized 0..1)
        // Vertical profile: axes are at Left (x=0) and Bottom (y=0)
        // Horizontal shape: axes are at Center (x=0.5) and Center (y=0.5)
        const bx = this.isVertical ? 0 : 0.5;
        const by = this.isVertical ? 0 : 0.5;
        const baseline = this.toCanvas({ x: bx, y: by });

        // Y/Z Axis (Vertical in canvas)
        this.ctx.strokeStyle = this.isVertical ? '#4dff4d' : '#4d4dff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(baseline.x, TOP_MARGIN);
        this.ctx.lineTo(baseline.x, height - BOTTOM_MARGIN);
        this.ctx.stroke();

        // X Axis (Horizontal in canvas)
        this.ctx.strokeStyle = '#ff4d4d';
        this.ctx.beginPath();
        this.ctx.moveTo(LEFT_MARGIN, baseline.y);
        this.ctx.lineTo(width - RIGHT_MARGIN, baseline.y);
        this.ctx.stroke();

        // Labels
        this.ctx.font = '10px Outfit';
        this.ctx.fillStyle = this.isVertical ? '#4dff4d' : '#4d4dff';
        this.ctx.fillText(this.isVertical ? 'Y (Height)' : 'Z (Depth)', baseline.x - 40, TOP_MARGIN);

        this.ctx.fillStyle = '#ff4d4d';
        this.ctx.fillText(this.isVertical ? 'Radius' : 'X (Width)', width - RIGHT_MARGIN, baseline.y + 20);

        // Origin Glow
        this.ctx.beginPath();
        const pulseFactor = Math.sin(this.pulse) * 5;
        const glowRadius = 20 + pulseFactor;
        const grad = this.ctx.createRadialGradient(baseline.x, baseline.y, 0, baseline.x, baseline.y, glowRadius);
        const accentColor = '#007aff';
        grad.addColorStop(0, `${accentColor}4D`); // 30% alpha
        grad.addColorStop(1, `${accentColor}00`); // 0% alpha
        this.ctx.fillStyle = grad;
        this.ctx.arc(baseline.x, baseline.y, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw Curve
        this.ctx.strokeStyle = accentColor;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();

        // Glow effect
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(124, 77, 255, 0.4)';

        // We calculate points along the curve for rendering
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = cubicBezier(t, this.points[0].x, this.points[1].x, this.points[2].x, this.points[3].x);
            const y = cubicBezier(t, this.points[0].y, this.points[1].y, this.points[2].y, this.points[3].y);
            const pos = this.toCanvas({ x, y });
            if (i === 0) this.ctx.moveTo(pos.x, pos.y);
            else this.ctx.lineTo(pos.x, pos.y);
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // Reset glow

        /* Removed old bulk line drawing to draw per-point connector */

        // Draw Points
        // Draw Points
        this.points.forEach((p, i) => {
            const pos = this.toCanvas(p);

            const isHovered = i === this.hoverIndex;
            const isDragged = i === this.dragIndex;
            const isActive = isHovered || isDragged;

            // Visual Styles for different point types
            if (i === 1 || i === 2) {
                // Control Points (Handle)
                // Draw line to anchor
                this.ctx.beginPath();
                this.ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
                this.ctx.setLineDash([4, 4]);
                this.ctx.lineWidth = 1;

                const anchorIndex = i === 1 ? 0 : 3;
                const anchorPos = this.toCanvas(this.points[anchorIndex]);
                this.ctx.moveTo(anchorPos.x, anchorPos.y);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]); // Reset

                // Draw circle for handle
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, isActive ? 6 : 4, 0, Math.PI * 2);
                this.ctx.fillStyle = isActive ? '#ff4d4d' : (isLight ? '#666' : '#888');
                if (isActive) {
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowColor = 'rgba(255, 77, 77, 0.5)';
                }
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            } else {
                // Anchor Points (Start/End)
                this.ctx.beginPath();
                const size = isActive ? 10 : 8;
                this.ctx.rect(pos.x - size / 2, pos.y - size / 2, size, size);
                this.ctx.fillStyle = isActive ? (isLight ? '#007aff' : '#fff') : (isLight ? '#888' : '#ccc');
                if (isActive) {
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
                }
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }

            if (isActive) {
                this.ctx.strokeStyle = isLight ? '#007aff' : '#fff';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        });
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;

        // For touches
        if (e.clientX === undefined && e.pageX !== undefined) {
            clientX = e.pageX;
            clientY = e.pageY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);

        // Check hit test
        this.dragIndex = -1;
        const hitRadiusSq = 225; // 15px radius squared
        for (let i = 0; i < this.points.length; i++) {
            const p = this.toCanvas(this.points[i]);
            const dx = pos.x - p.x;
            const dy = pos.y - p.y;
            if (dx * dx + dy * dy < hitRadiusSq) {
                this.dragIndex = i;
                break;
            }
        }
        this.draw();
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.dragIndex !== -1) {
            // Update point
            const normalized = this.fromCanvas(pos.x, pos.y);

            // Clamping to [0, 1] range
            normalized.x = Math.max(0, Math.min(1, normalized.x));
            normalized.y = Math.max(0, Math.min(1, normalized.y));

            // No hard constraints on P0/P3 to allow full flexibility in both axes.
            // This allows the user to adjust start/end height and radius freely.

            this.points[this.dragIndex] = normalized;
            this.draw();
            if (this.onChange) this.onChange();
        } else {
            // Hover effect
            this.hoverIndex = -1;
            const hitRadiusSq = 225; // 15px radius squared
            for (let i = 0; i < this.points.length; i++) {
                const p = this.toCanvas(this.points[i]);
                const dx = pos.x - p.x;
                const dy = pos.y - p.y;
                if (dx * dx + dy * dy < hitRadiusSq) {
                    this.hoverIndex = i;
                    break;
                }
            }
            this.draw();
        }
    }

    onMouseUp() {
        this.dragIndex = -1;
        this.draw();
    }

    reset() {
        if (this.isVertical) {
            this.points = [
                { x: 0.5, y: 0 },
                { x: 1.0, y: 0.5 },
                { x: 0.2, y: 0.8 },
                { x: 0.8, y: 1 }
            ];
        } else {
            this.points = [
                { x: 0, y: 0.5 },
                { x: 0.2, y: 0.2 },
                { x: 0.8, y: 0.8 },
                { x: 1, y: 0.5 }
            ];
        }
        this.draw();
    }
}

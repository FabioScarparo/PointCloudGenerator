/**
 * @fileoverview Interactive Bezier spline curve editor with touch support.
 * Provides a canvas-based interface for creating and editing smooth curves using
 * cubic Bezier splines with draggable control points.
 */

import { cubicBezier, sampleBezierSpline, TOP_MARGIN, BOTTOM_MARGIN, LEFT_MARGIN, RIGHT_MARGIN } from './math.js';

/**
 * Interactive Bezier curve editor for defining profile and shape curves.
 * Supports both mouse and touch interactions with mobile-optimized gestures.
 * 
 * @class
 * @example
 * const editor = new CurveEditor('canvas-id', true, () => console.log('curve changed'));
 */
export class CurveEditor {
    /**
     * Creates a new curve editor instance.
     * 
     * @param {string} canvasId - ID of the canvas element to attach to
     * @param {boolean} [isVertical=false] - Whether this is a vertical profile editor
     * @param {Function} [onChange] - Callback function triggered when the curve changes
     */
    constructor(canvasId, isVertical = false, onChange) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isVertical = isVertical;
        this.onChange = onChange;
        this.theme = 'dark';
        this.pulse = 0;
        this.animationFrame = null;

        this.points = [];
        this.selectedPoint = -1;
        this.dragHandle = 0;
        this.dragIndex = -1;
        this.hoverIndex = -1;

        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.hitRadius = this.isTouchDevice ? 15 : 8;
        this.longPressTimer = null;
        this.longPressDuration = 500;

        this.initializeDefaultCurve();
        this.setupEventListeners();
        this.resize();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Initializes the default curve shape based on editor orientation.
     * @private
     */
    initializeDefaultCurve() {
        if (this.isVertical) {
            this.points = [
                { x: 0.5, y: 0, cp1: { dx: -0.1, dy: 0 }, cp2: { dx: 0.1, dy: 0 } },
                { x: 0.8, y: 0.5, cp1: { dx: 0, dy: -0.1 }, cp2: { dx: 0, dy: 0.1 } },
                { x: 0.5, y: 1, cp1: { dx: 0.1, dy: 0 }, cp2: { dx: -0.1, dy: 0 } }
            ];
        } else {
            this.points = [
                { x: 0, y: 0.5, cp1: { dx: 0, dy: 0.2 }, cp2: { dx: 0, dy: -0.2 } },
                { x: 0.5, y: 0.1, cp1: { dx: -0.2, dy: 0 }, cp2: { dx: 0.2, dy: 0 } },
                { x: 1, y: 0.5, cp1: { dx: 0, dy: -0.2 }, cp2: { dx: 0, dy: 0.2 } }
            ];
        }
    }

    /**
     * Sets up all mouse and touch event listeners.
     * @private
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));

        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
    }

    /**
     * Handles touch start events with long-press detection for adding points.
     * @param {TouchEvent} e - Touch event
     * @private
     */
    onTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const pos = this.getMousePos(touch);

            this.longPressTimer = setTimeout(() => {
                this.onLongPress(pos);
                this.longPressTimer = null;
            }, this.longPressDuration);

            this.onMouseDown({ ...touch, button: 0 });
        } else {
            this.clearLongPress();
        }
    }

    /**
     * Handles touch move events.
     * @param {TouchEvent} e - Touch event
     * @private
     */
    onTouchMove(e) {
        e.preventDefault();
        this.clearLongPress();

        if (e.touches.length === 1) {
            this.onMouseMove(e.touches[0]);
        }
    }

    /**
     * Handles touch end events.
     * @param {TouchEvent} e - Touch event
     * @private
     */
    onTouchEnd(e) {
        e.preventDefault();
        this.clearLongPress();
        this.onMouseUp(e);
    }

    /**
     * Clears the long-press timer.
     * @private
     */
    clearLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    /**
     * Handles long-press gesture to add a new point (mobile alternative to double-click).
     * @param {{x: number, y: number}} pos - Canvas position
     * @private
     */
    onLongPress(pos) {
        const normalized = this.fromCanvas(pos.x, pos.y);

        this.points.push({
            ...normalized,
            cp1: { dx: -0.1, dy: 0 },
            cp2: { dx: 0.1, dy: 0 }
        });

        this.selectedPoint = this.points.length - 1;
        this.draw();
        if (this.onChange) this.onChange();

        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    /**
     * Animation loop for pulsing origin glow effect.
     * @private
     */
    animate() {
        this.pulse += 0.05;
        this.draw();
        this.animationFrame = requestAnimationFrame(this.animate.bind(this));
    }

    /**
     * Resizes the canvas to match its container.
     */
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    /**
     * Converts normalized coordinates (0-1) to canvas pixel coordinates.
     * @param {{x: number, y: number}} p - Normalized point
     * @returns {{x: number, y: number}} Canvas pixel coordinates
     */
    toCanvas(p) {
        const w = this.canvas.width - LEFT_MARGIN - RIGHT_MARGIN;
        const h = this.canvas.height - TOP_MARGIN - BOTTOM_MARGIN;

        return {
            x: LEFT_MARGIN + p.x * w,
            y: this.canvas.height - BOTTOM_MARGIN - p.y * h
        };
    }

    /**
     * Converts canvas pixel coordinates to normalized coordinates (0-1).
     * @param {number} x - Canvas X coordinate
     * @param {number} y - Canvas Y coordinate
     * @returns {{x: number, y: number}} Normalized coordinates
     */
    fromCanvas(x, y) {
        const w = this.canvas.width - LEFT_MARGIN - RIGHT_MARGIN;
        const h = this.canvas.height - TOP_MARGIN - BOTTOM_MARGIN;

        const nx = (x - LEFT_MARGIN) / w;
        const ny = (this.canvas.height - BOTTOM_MARGIN - y) / h;

        return { x: nx, y: ny };
    }

    /**
     * Renders the curve editor to the canvas.
     * @private
     */
    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        this.drawGrid();
        this.drawAxes();
        this.drawOriginGlow();
        this.drawCurve();
        this.drawControlPoints();
    }

    /**
     * Draws the background grid.
     * @private
     */
    drawGrid() {
        const { width, height } = this.canvas;
        const isLight = this.theme === 'light';

        this.ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

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
    }

    /**
     * Draws the coordinate axes.
     * @private
     */
    drawAxes() {
        const { width, height } = this.canvas;
        const bx = this.isVertical ? 0 : 0.5;
        const by = this.isVertical ? 0 : 0.5;
        const baseline = this.toCanvas({ x: bx, y: by });

        this.ctx.strokeStyle = this.isVertical ? '#4dff4d' : '#4d4dff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(baseline.x, TOP_MARGIN);
        this.ctx.lineTo(baseline.x, height - BOTTOM_MARGIN);
        this.ctx.stroke();

        this.ctx.strokeStyle = '#ff4d4d';
        this.ctx.beginPath();
        this.ctx.moveTo(LEFT_MARGIN, baseline.y);
        this.ctx.lineTo(width - RIGHT_MARGIN, baseline.y);
        this.ctx.stroke();

        this.ctx.font = '10px Outfit';
        this.ctx.fillStyle = this.isVertical ? '#4dff4d' : '#4d4dff';
        this.ctx.fillText(this.isVertical ? 'Y (Height)' : 'Z (Depth)', baseline.x - 40, TOP_MARGIN);

        this.ctx.fillStyle = '#ff4d4d';
        this.ctx.fillText(this.isVertical ? 'Radius' : 'X (Width)', width - RIGHT_MARGIN, baseline.y + 20);
    }

    /**
     * Draws the animated glow at the origin.
     * @private
     */
    drawOriginGlow() {
        const bx = this.isVertical ? 0 : 0.5;
        const by = this.isVertical ? 0 : 0.5;
        const baseline = this.toCanvas({ x: bx, y: by });

        this.ctx.beginPath();
        const pulseFactor = Math.sin(this.pulse) * 5;
        const glowRadius = 20 + pulseFactor;
        const grad = this.ctx.createRadialGradient(baseline.x, baseline.y, 0, baseline.x, baseline.y, glowRadius);
        const accentColor = '#007aff';
        grad.addColorStop(0, `${accentColor}4D`);
        grad.addColorStop(1, `${accentColor}00`);
        this.ctx.fillStyle = grad;
        this.ctx.arc(baseline.x, baseline.y, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draws the Bezier curve.
     * @private
     */
    drawCurve() {
        const accentColor = '#007aff';
        this.ctx.strokeStyle = accentColor;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();

        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(124, 77, 255, 0.4)';

        const steps = 150;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = sampleBezierSpline(t, this.points, 'x');
            const y = sampleBezierSpline(t, this.points, 'y');
            const pos = this.toCanvas({ x, y });
            if (i === 0) this.ctx.moveTo(pos.x, pos.y);
            else this.ctx.lineTo(pos.x, pos.y);
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    /**
     * Draws control points and handles.
     * @private
     */
    drawControlPoints() {
        const isLight = this.theme === 'light';

        this.points.forEach((p, i) => {
            const pos = this.toCanvas(p);
            const isHovered = i === this.hoverIndex;
            const isDragged = i === this.dragIndex;
            const isSelected = i === this.selectedPoint;
            const isActive = isHovered || isDragged || isSelected;

            if (isActive) {
                const cp1Pos = this.toCanvas({ x: p.x + p.cp1.dx, y: p.y + p.cp1.dy });
                const cp2Pos = this.toCanvas({ x: p.x + p.cp2.dx, y: p.y + p.cp2.dy });

                this.ctx.setLineDash([2, 4]);
                this.ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
                this.ctx.lineWidth = 1;

                this.ctx.beginPath();
                this.ctx.moveTo(cp1Pos.x, cp1Pos.y);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.lineTo(cp2Pos.x, cp2Pos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                this.ctx.beginPath();
                this.ctx.arc(cp1Pos.x, cp1Pos.y, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = (this.dragIndex === i && this.dragHandle === 1) ? '#ff4d4d' : '#888';
                this.ctx.fill();

                this.ctx.beginPath();
                this.ctx.arc(cp2Pos.x, cp2Pos.y, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = (this.dragIndex === i && this.dragHandle === 2) ? '#ff4d4d' : '#888';
                this.ctx.fill();
            }

            this.ctx.beginPath();
            const size = (isHovered || isDragged) ? 10 : 8;
            this.ctx.rect(pos.x - size / 2, pos.y - size / 2, size, size);
            this.ctx.fillStyle = isSelected ? (isLight ? '#007aff' : '#fff') : (isLight ? '#666' : '#bbb');

            if (isSelected) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = 'rgba(0, 122, 255, 0.5)';
            }
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    /**
     * Gets mouse/touch position relative to canvas.
     * @param {MouseEvent|Touch} e - Event object
     * @returns {{x: number, y: number}} Canvas-relative position
     * @private
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX ?? e.pageX;
        const clientY = e.clientY ?? e.pageY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    /**
     * Handles mouse down events for dragging points and handles.
     * @param {MouseEvent} e - Mouse event
     * @private
     */
    onMouseDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        const pos = this.getMousePos(e);

        this.dragIndex = -1;
        this.dragHandle = 0;
        const hitRadiusSq = this.hitRadius * this.hitRadius;

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            const pCanvas = this.toCanvas(p);

            if (this.distSq(pos, pCanvas) < hitRadiusSq) {
                this.dragIndex = i;
                this.dragHandle = 0;
                this.selectedPoint = i;
                break;
            }

            if (i === this.selectedPoint) {
                const cp1 = this.toCanvas({ x: p.x + p.cp1.dx, y: p.y + p.cp1.dy });
                if (this.distSq(pos, cp1) < hitRadiusSq) {
                    this.dragIndex = i;
                    this.dragHandle = 1;
                    break;
                }
                const cp2 = this.toCanvas({ x: p.x + p.cp2.dx, y: p.y + p.cp2.dy });
                if (this.distSq(pos, cp2) < hitRadiusSq) {
                    this.dragIndex = i;
                    this.dragHandle = 2;
                    break;
                }
            }
        }
        this.draw();
    }

    /**
     * Calculates squared distance between two points.
     * @param {{x: number, y: number}} p1 - First point
     * @param {{x: number, y: number}} p2 - Second point
     * @returns {number} Squared distance
     * @private
     */
    distSq(p1, p2) {
        return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
    }

    /**
     * Handles double-click to add a new point.
     * @param {MouseEvent} e - Mouse event
     * @private
     */
    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const normalized = this.fromCanvas(pos.x, pos.y);

        this.points.push({
            ...normalized,
            cp1: { dx: -0.1, dy: 0 },
            cp2: { dx: 0.1, dy: 0 }
        });

        this.selectedPoint = this.points.length - 1;
        this.draw();
        if (this.onChange) this.onChange();
    }

    /**
     * Handles right-click to remove a point.
     * @param {MouseEvent} e - Mouse event
     * @private
     */
    onContextMenu(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);

        let toRemove = -1;
        const hitRadiusSq = 225;
        for (let i = 0; i < this.points.length; i++) {
            const p = this.toCanvas(this.points[i]);
            const dx = pos.x - p.x;
            const dy = pos.y - p.y;
            if (dx * dx + dy * dy < hitRadiusSq) {
                toRemove = i;
                break;
            }
        }

        if (toRemove !== -1 && this.points.length > 2) {
            this.points.splice(toRemove, 1);
            this.draw();
            if (this.onChange) this.onChange();
        }
    }

    /**
     * Handles mouse move for dragging and hover effects.
     * @param {MouseEvent} e - Mouse event
     * @private
     */
    onMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.dragIndex !== -1) {
            const normalized = this.fromCanvas(pos.x, pos.y);
            const p = this.points[this.dragIndex];

            if (this.dragHandle === 0) {
                p.x = Math.max(0, Math.min(1, normalized.x));
                p.y = Math.max(0, Math.min(1, normalized.y));
            } else if (this.dragHandle === 1) {
                p.cp1.dx = normalized.x - p.x;
                p.cp1.dy = normalized.y - p.y;
                p.cp2.dx = -p.cp1.dx;
                p.cp2.dy = -p.cp1.dy;
            } else if (this.dragHandle === 2) {
                p.cp2.dx = normalized.x - p.x;
                p.cp2.dy = normalized.y - p.y;
                p.cp1.dx = -p.cp2.dx;
                p.cp1.dy = -p.cp2.dy;
            }

            this.draw();
            if (this.onChange) this.onChange();
        } else {
            this.hoverIndex = -1;
            const hitRadiusSq = 225;
            for (let i = 0; i < this.points.length; i++) {
                const p = this.toCanvas(this.points[i]);
                if (this.distSq(pos, p) < hitRadiusSq) {
                    this.hoverIndex = i;
                    break;
                }
            }
            this.draw();
        }
    }

    /**
     * Handles mouse up to end dragging.
     * @private
     */
    onMouseUp() {
        this.dragIndex = -1;
        this.draw();
    }

    /**
     * Resets the curve to its default shape.
     */
    reset() {
        this.initializeDefaultCurve();
        this.selectedPoint = -1;
        this.draw();
    }
}

// ==========================================
// 1. SETUP
// ==========================================

// --- THEME TOGGLE ---
const btnTheme = document.getElementById('btn-theme');
let isDarkMode = true;

if(btnTheme) btnTheme.onclick = () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.body.removeAttribute('data-theme');
        btnTheme.innerText = "☀"; // Sun icon for Dark Mode
    } else {
        document.body.setAttribute('data-theme', 'light');
        btnTheme.innerText = "☾"; // Moon icon for Light Mode
    }
    render(); // Re-draw canvas to match new background
};

const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const btnReset = document.getElementById('btn-reset');
const btnRecenter = document.getElementById('btn-recenter');
const btnUndo = document.getElementById('btn-undo');
const btnClose = document.getElementById('btn-close');
const inputAutoLabel = document.getElementById('input-auto-label');

// Drafting Styles
const inputColor = document.getElementById('input-color');
const inputWidth = document.getElementById('input-width');

// Traverse
const inputAz = document.getElementById('input-az');
const inputDist = document.getElementById('input-dist');
const btnTraverse = document.getElementById('btn-traverse');
const btnTurnLeft = document.getElementById('btn-turn-left');
const btnTurnRight = document.getElementById('btn-turn-right');

// Offsets
const inputOffsetDist = document.getElementById('input-offset-dist');
const btnOffsetLeft = document.getElementById('btn-offset-left');
const btnOffsetRight = document.getElementById('btn-offset-right');

// Coords
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const btnGo = document.getElementById('btn-go');
const btnJump = document.getElementById('btn-jump');

// Curve
const curveRadius = document.getElementById('curve-radius');
const curveFacing = document.getElementById('curve-facing');
const curveTurn = document.getElementById('curve-turn');
const btnCurve = document.getElementById('btn-curve');

// Snaps
const snapEnd = document.getElementById('snap-end');
const snapMid = document.getElementById('snap-mid');
const snapCenter = document.getElementById('snap-center');
const btnMeasure = document.getElementById('btn-measure');
const measureOutput = document.getElementById('measure-output');

// Area
const btnToggleFill = document.getElementById('btn-toggle-fill');
const btnAddParcel = document.getElementById('btn-add-parcel');
const areaDisplay = document.getElementById('area-display');
const parcelListBody = document.getElementById('parcel-list-body');

// View
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnFit = document.getElementById('btn-fit');
const btnPaperMode = document.getElementById('btn-paper-mode');
const inputScale = document.getElementById('input-scale');
const offsetDisplay = document.getElementById('offset-display');

const btnPng = document.getElementById('btn-png');
const btnPdf = document.getElementById('btn-pdf');

// ==========================================
// 2. STATE
// ==========================================
// History now stores OBJECTS: { points: [], color: '#...', width: 2 }
let history = []; 
let currentStroke = { points: [], color: '#f3e2a0', width: 2 }; 

let pen = { x: 0, y: 0 }; 
let camera = { x: 0, y: 0, zoom: 5 };
let snap = { active: false, x: 0, y: 0, type: '' }; 

let parcels = []; 
let showFill = true; 
let measureMode = false;
let measureStart = null; 
let paperMode = false; // Toggle for White Background

let isDragging = false;
let lastX=0, lastY=0;

// ==========================================
// 3. RENDER ENGINE
// ==========================================
function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    render();
}
window.addEventListener('resize', resize);
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Initialize first stroke with default styles
currentStroke.color = inputColor.value;
currentStroke.width = parseInt(inputWidth.value);
currentStroke.points.push({ ...pen });

function render() {
    // --- 1. SETUP COLORS (Theme Support) ---
    const isLight = document.body.getAttribute('data-theme') === 'light';
    
    // Define Palette
    const themeBg = isLight ? '#f1f5f9' : '#0f172a'; 
    const themeGrid = isLight ? '#cbd5e1' : '#1e293b'; 
    const themeAxis = isLight ? '#94a3b8' : '#334155';
    
    // Paper Mode Overrides
    const bgColor = paperMode ? '#ffffff' : themeBg;
    const gridColor = paperMode ? '#e0e0e0' : themeGrid;
    const axisColor = paperMode ? '#888888' : themeAxis;

    // Clear Screen
    ctx.fillStyle = bgColor; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update Zoom Box if it exists
    if (typeof inputScale !== 'undefined' && inputScale) {
        // Only update if not currently being typed in (optional safety)
        if (document.activeElement !== inputScale) {
            inputScale.value = camera.zoom.toFixed(1);
        }
    }
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Helper: Convert World to Screen
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // --- 2. DRAW GRID & ORIGIN ---
    // (Assuming drawGrid function exists in your code)
    if (typeof drawGrid === 'function') {
        drawGrid(ctx, camera, cx, cy, canvas.width, canvas.height, gridColor, axisColor);
    }

    // Draw Origin Crosshair
    const origin = toScreen(0,0);
    ctx.strokeStyle = axisColor; 
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y); ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10); ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();

    // --- 3. DRAW SAVED HISTORY ---
    history.forEach(strokeObj => {
        const points = strokeObj.points || [];
        if (points.length < 2) return;
        
        let strokeColor = strokeObj.color || '#f3e2a0';
        let strokeWidth = strokeObj.width || 2;

        // Paper Mode: Force light colors to black for visibility
        if (paperMode) {
             if (strokeColor.toLowerCase().includes('f3e2a0') || strokeColor.toLowerCase() === '#ffffff') {
                 strokeColor = '#000000';
             }
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // A. Draw The Line
        ctx.beginPath(); // <--- PREVENTS CRASH
        const start = toScreen(points[0].x, points[0].y);
        ctx.moveTo(start.x, start.y);
        
        for (let i = 1; i < points.length; i++) {
            const pt = toScreen(points[i].x, points[i].y);
            ctx.lineTo(pt.x, pt.y);
        }

        // Handle Fill (if closed loop)
        const first = points[0];
        const last = points[points.length - 1];
        const isClosed = Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01;
        
        if (isClosed && typeof showFill !== 'undefined' && showFill) {
            ctx.fillStyle = paperMode ? 'rgba(0,0,0,0.05)' : 'rgba(243, 226, 160, 0.15)'; 
            ctx.fill();
        }
        
        ctx.stroke(); // Draw the ink

        // B. Draw Labels (NEW)
        if (strokeObj.hasLabel && !paperMode) {
            for (let i = 0; i < points.length - 1; i++) {
                drawSmartLabel(ctx, points[i], points[i+1], toScreen);
            }
        }
    });

    // --- 4. DRAW CURRENT STROKE (The Ghost Line) ---
    if (currentStroke.points.length > 0) {
        ctx.strokeStyle = inputColor.value;
        ctx.lineWidth = parseInt(inputWidth.value);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath(); // <--- PREVENTS CRASH
        const start = toScreen(currentStroke.points[0].x, currentStroke.points[0].y);
        ctx.moveTo(start.x, start.y);
        
        for (let i = 1; i < currentStroke.points.length; i++) {
            const pt = toScreen(currentStroke.points[i].x, currentStroke.points[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }
}

    // D. DRAW SNAP CURSOR
    if (snap.active) {
        const s = toScreen(snap.x, snap.y);
        ctx.strokeStyle = paperMode ? '#FF0000' : '#FFFF00'; 
        ctx.lineWidth = 2;
        
        if (snap.type === 'END') ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
        else if (snap.type === 'MID') {
            ctx.beginPath(); ctx.moveTo(s.x, s.y - 8); ctx.lineTo(s.x - 7, s.y + 6); ctx.lineTo(s.x + 7, s.y + 6); ctx.closePath(); ctx.stroke();
        } 
        else if (snap.type === 'CENTER') {
            ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); 
            ctx.moveTo(s.x - 8, s.y); ctx.lineTo(s.x + 8, s.y); 
            ctx.moveTo(s.x, s.y - 8); ctx.lineTo(s.x, s.y + 8); ctx.stroke();
        }
    } else {
        const p = toScreen(pen.x, pen.y);
        ctx.fillStyle = paperMode ? '#000' : '#d99e33';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // E. MEASURE LINE
    if (measureMode && measureStart) {
        const s = toScreen(measureStart.x, measureStart.y);
        ctx.fillStyle = '#00FF00'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI*2); ctx.fill();
    }

    // F. HUD
    if (!paperMode) drawNorthArrow(ctx, canvas.width); // Hide HUD in paper mode for clean print? Or keep it? kept hidden for clean
    drawScaleBar(ctx, canvas.height, camera.zoom, paperMode);

    // G. UPDATE DATA
    if(inputX) inputX.value = pen.x.toFixed(2);
    if(inputY) inputY.value = pen.y.toFixed(2);
    updateLiveArea();
}

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================
function drawGrid(ctx, cam, cx, cy, w, h, color, textColor) {
    const step = 10; const zoom = cam.zoom;
    if (step * zoom < 10) return; 
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.fillStyle = textColor; ctx.font = '10px monospace'; ctx.textAlign = 'center';

    const worldLeft = cam.x - (cx / zoom); const worldRight = cam.x + (cx / zoom);
    const worldTop = cam.y + (cy / zoom); const worldBottom = cam.y - (cy / zoom);

    const startX = Math.floor(worldLeft / step) * step; const endX = Math.ceil(worldRight / step) * step;
    const startY = Math.floor(worldBottom / step) * step; const endY = Math.ceil(worldTop / step) * step;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
        const screenX = (x - cam.x) * zoom + cx; ctx.moveTo(screenX, 0); ctx.lineTo(screenX, h);
        if (x % 50 === 0) ctx.fillText(x, screenX + 2, h - 5); 
    }
    for (let y = startY; y <= endY; y += step) {
        const screenY = (cam.y - y) * zoom + cy; ctx.moveTo(0, screenY); ctx.lineTo(w, screenY);
        if (y % 50 === 0) ctx.fillText(y, 5, screenY - 2);
    }
    ctx.stroke();
}

function drawNorthArrow(ctx, w) {
    const x = w - 40; const y = 40;
    ctx.strokeStyle = '#f3e2a0'; ctx.fillStyle = '#f3e2a0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 10, y + 10); ctx.lineTo(x, y); ctx.lineTo(x + 10, y + 10); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', x, y - 25);
}

function drawScaleBar(ctx, h, zoom, isPaper) {
    const targetPx = 100; const worldUnits = targetPx / zoom;
    let scaleUnit = 10;
    if (worldUnits > 20) scaleUnit = 20; if (worldUnits > 50) scaleUnit = 50; if (worldUnits > 100) scaleUnit = 100;
    const barWidth = scaleUnit * zoom; const x = 20; const y = h - 30;
    const color = isPaper ? '#000' : '#fff';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 5); ctx.lineTo(x + barWidth, y - 5); ctx.lineTo(x + barWidth, y); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(x, y - 5, barWidth / 2, 5);
    ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(`Scale: ${scaleUnit} ft`, x, y - 10);
}

function getShapeArea(points) {
    if (!points || points.length < 3) return { sqft: 0, acres: 0 };
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < points.length - 1; i++) {
        sum1 += points[i].x * points[i+1].y;
        sum2 += points[i].y * points[i+1].x;
    }
    const first = points[0]; const last = points[points.length - 1];
    if (first.x !== last.x || first.y !== last.y) { sum1 += last.x * first.y; sum2 += last.y * first.x; }
    const sqft = Math.abs(0.5 * (sum1 - sum2));
    return { sqft: sqft, acres: sqft / 43560 };
}

function updateLiveArea() {
    let target = null;
    if (currentStroke.points.length > 2) target = currentStroke.points;
    else if (history.length > 0) target = history[history.length-1].points;
    
    if(target && areaDisplay) {
        const a = getShapeArea(target);
        areaDisplay.innerText = `${a.acres.toFixed(3)} Ac`;
    }
}

// Helper: Push current stroke to history and start new one
function saveStroke() {
    if (currentStroke.points.length > 0) {
        history.push({
            points: [...currentStroke.points],
            color: currentStroke.color,
            width: currentStroke.width,
            // NEW: Remember if we wanted labels for this specific line
            hasLabel: inputAutoLabel ? inputAutoLabel.checked : false
        });
    }
    // Start fresh
    currentStroke.points = [{ ...pen }];
    // Keep styles same as inputs
    currentStroke.color = inputColor.value;
    currentStroke.width = parseInt(inputWidth.value);
}

// ==========================================
// 5. CONTROLS & EVENTS
// ==========================================

// --- OFFSET TOOL ---
function createOffset(distance, side) { // side: -1 (Left), 1 (Right)
    let target = null;
    if (currentStroke.points.length > 1) target = currentStroke.points;
    else if (history.length > 0) target = history[history.length - 1].points;

    if (!target || target.length < 2) { alert("Draw a line to offset first."); return; }

    // Simple Offset: Move points along perpendicular of segment
    // Note: Complex polygon offsetting is hard. We will do segment-based offset.
    const newPoints = [];
    
    for(let i=0; i<target.length-1; i++) {
        const p1 = target[i];
        const p2 = target[i+1];
        
        // Direction vector
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        
        // Perpendicular vector (-dy, dx) is 90 deg left
        // Normalize and scale
        const udx = dx / len;
        const udy = dy / len;
        
        // Normal vector (90 deg)
        // Left (-dy, dx), Right (dy, -dx)
        let nx, ny;
        if (side === -1) { nx = -udy; ny = udx; } // Left
        else { nx = udy; ny = -udx; } // Right

        const offX = nx * distance;
        const offY = ny * distance;

        // Offset Start and End of this segment
        // (For continuous lines, we should intersect, but for now we draw separate segments or disconnected)
        // Better Approach: Just offset the points directly? No.
        // Let's create a disconnected parallel line for now to avoid corner math complexity
        
        // Simple shift:
        newPoints.push({ x: p1.x + offX, y: p1.y + offY });
        newPoints.push({ x: p2.x + offX, y: p2.y + offY });
        
        // Lift pen between segments if we don't do intersection logic
        // But users want a continuous line. 
        // Let's just push start and end. 
    }
    
    // Create a new stroke from these points. 
    // To make it a single connected line, we need to handle corners. 
    // Simplified: Just take the offset of the first point of segment.
    
    const simpleOffsetPoints = [];
    // Iterate points (vertex normal approx)
    for(let i=0; i<target.length; i++) {
        // Find segment before and after
        // This is complex math. Let's do the simplest useful thing:
        // Offset the whole shape by a fixed X/Y? No.
        
        // Let's just offset the last segment for now if it's a line
        // Or if it's a shape, offset perpendicular to the first segment?
        
        // Let's stick to the Perpendicular of each segment.
        // We will create a new stroke for EACH segment to ensure accuracy.
    }
    
    // REVISED OFFSET: Just offset the segments as separate lines for accuracy
    // User can connect them if needed.
    target.forEach((pt, i) => {
        if (i === target.length - 1) return;
        const p1 = pt;
        const p2 = target[i+1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        let nx, ny;
        if (side === -1) { nx = -dy/len; ny = dx/len; }
        else { nx = dy/len; ny = -dx/len; }
        
        const offX = nx * distance;
        const offY = ny * distance;
        
        const np1 = { x: p1.x + offX, y: p1.y + offY };
        const np2 = { x: p2.x + offX, y: p2.y + offY };
        
        history.push({
            points: [np1, np2],
            color: '#888888', // Grey for offsets
            width: 1
        });
    });
    render();
} // <--- THIS WAS MISSING! This closes the createOffset function.

// ==========================================
// FILLET / JOIN TOOL
// ==========================================
const btnFillet = document.getElementById('btn-fillet');

if (btnFillet) btnFillet.onclick = () => {
    // 1. Identify the last two shapes
    let shapes = [...history];
    if (currentStroke.points.length > 0) shapes.push(currentStroke);
    
    if (shapes.length < 2) {
        alert("Need 2 lines to join!");
        return;
    }

    // Get the last two strokes
    const strokeB = shapes[shapes.length - 1]; 
    const strokeA = shapes[shapes.length - 2]; 
    
    const ptsA = strokeA.points || strokeA;
    const ptsB = strokeB.points || strokeB;
    
    // Line A (Last 2 points)
    const a2 = ptsA[ptsA.length - 1]; 
    const a1 = ptsA[ptsA.length - 2]; 
    
    // Line B (First 2 points)
    const b1 = ptsB[0];     
    const b2 = ptsB[1];     
    
    if (!a1 || !a2 || !b1 || !b2) {
        alert("Cannot join these shapes.");
        return;
    }

    // 2. Calculate Intersection
    const x1 = a1.x, y1 = a1.y;
    const x2 = a2.x, y2 = a2.y;
    const x3 = b1.x, y3 = b1.y;
    const x4 = b2.x, y4 = b2.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 0.001) {
        alert("Lines are parallel! Cannot fillet.");
        return;
    }

    const intersectX = ((x1*y2 - y1*x2)*(x3 - x4) - (x1 - x2)*(x3*y4 - y3*x4)) / denom;
    const intersectY = ((x1*y2 - y1*x2)*(y3 - y4) - (y1 - y2)*(x3*y4 - y3*x4)) / denom;

    // 3. Update the Points
    a2.x = intersectX; a2.y = intersectY;
    b1.x = intersectX; b1.y = intersectY;

    // 4. Update the Pen
    pen.x = intersectX; pen.y = intersectY;
    if(inputX) inputX.value = pen.x.toFixed(2);
    if(inputY) inputY.value = pen.y.toFixed(2);

    render();
};

// Wire up the Offset Buttons
btnOffsetLeft.onclick = () => createOffset(parseFloat(inputOffsetDist.value), -1);
btnOffsetRight.onclick = () => createOffset(parseFloat(inputOffsetDist.value), 1);


// --- MOUSE WHEEL ZOOM ---
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = camera.zoom + (delta * 0.1 * camera.zoom);
    camera.zoom = Math.max(0.5, Math.min(newZoom, 100));
    render();
}, { passive: false });

// --- MOUSE CLICK ---
canvas.addEventListener('mousedown', (e) => {
    isDragging = false; 
    let clickX = pen.x; let clickY = pen.y;
    
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    const worldX = ((e.clientX - rect.left) - cx) / camera.zoom + camera.x;
    const worldY = camera.y - ((e.clientY - rect.top) - cy) / camera.zoom;

    if (snap.active) { clickX = snap.x; clickY = snap.y; } 
    else { clickX = worldX; clickY = worldY; }

    if (measureMode) {
        if (!measureStart) {
            measureStart = { x: clickX, y: clickY };
            measureOutput.innerText = "Select 2nd point...";
        } else {
            const dx = clickX - measureStart.x;
            const dy = clickY - measureStart.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            let az = Math.atan2(dx, dy) * (180 / Math.PI);
            if (az < 0) az += 360;
            measureOutput.innerText = `Dist: ${dist.toFixed(2)}' | Az: ${az.toFixed(1)}°`;
            measureStart = null;
        }
        render(); return; 
    }

    if (snap.active) { 
        pen.x = snap.x; pen.y = snap.y; 
        currentStroke.points.push({ ...pen }); 
        render(); return; 
    }

    isDragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => { isDragging = false; if(!measureMode) canvas.style.cursor = 'crosshair'; });

// --- MOUSE MOVE ---
canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const dx = e.clientX - lastX; const dy = e.clientY - lastY;
        camera.x -= dx / camera.zoom; camera.y += dy / camera.zoom;
        lastX = e.clientX; lastY = e.clientY; render(); return;
    }

    const rect = canvas.getBoundingClientRect();
    const mousePxX = e.clientX - rect.left; const mousePxY = e.clientY - rect.top;
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    const worldX = (mousePxX - cx) / camera.zoom + camera.x;
    const worldY = camera.y - (mousePxY - cy) / camera.zoom; 

    // Snapping Logic
    let bestDist = Infinity; let bestPt = null; let bestType = "";
    const snapWorldThreshold = 15 / camera.zoom;
    const distSq = (x1, y1, x2, y2) => (x1-x2)**2 + (y1-y2)**2;

    [...history, currentStroke].forEach(strokeObj => {
        const points = strokeObj.points || strokeObj; 
        if (points.length < 2) return; 
        
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            if (snapEnd.checked) {
                const d = distSq(p1.x, p1.y, worldX, worldY);
                if (d < bestDist) { bestDist = d; bestPt = { x: p1.x, y: p1.y }; bestType = "END"; }
            }
            if (i < points.length - 1) {
                const p2 = points[i+1];
                if (snapMid.checked) {
                    const mx = (p1.x + p2.x) / 2; const my = (p1.y + p2.y) / 2;
                    const d = distSq(mx, my, worldX, worldY);
                    if (d < bestDist) { bestDist = d; bestPt = { x: mx, y: my }; bestType = "MID"; }
                }
            }
        }
        // Center Snap
        if (snapCenter && snapCenter.checked && points.length > 2) {
            const p1 = points[0];
            const p2 = points[Math.floor(points.length / 2)];
            const p3 = points[points.length - 1];
            const D = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
            if (Math.abs(D) > 0.001) {
                const Ux = ((p1.x**2 + p1.y**2) * (p2.y - p3.y) + (p2.x**2 + p2.y**2) * (p3.y - p1.y) + (p3.x**2 + p3.y**2) * (p1.y - p2.y)) / D;
                const Uy = ((p1.x**2 + p1.y**2) * (p3.x - p2.x) + (p2.x**2 + p2.y**2) * (p1.x - p3.x) + (p3.x**2 + p3.y**2) * (p2.x - p1.x)) / D;
                const d = distSq(Ux, Uy, worldX, worldY);
                if (d < bestDist) { bestDist = d; bestPt = { x: Ux, y: Uy }; bestType = "CENTER"; }
            }
        }
    });

    if (bestPt && Math.sqrt(bestDist) < snapWorldThreshold) {
        snap.active = true; snap.x = bestPt.x; snap.y = bestPt.y; snap.type = bestType; canvas.style.cursor = 'none';
    } else {
        snap.active = false; snap.type = ''; canvas.style.cursor = measureMode ? 'help' : 'crosshair';
    }
    render();
});

// --- KEYBOARD ---
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { btnUndo.click(); return; }
    if (e.key === '=' || e.key === '+') { camera.zoom *= 1.1; render(); }
    if (e.key === '-') { camera.zoom /= 1.1; render(); }

    const step = 1; let dx = 0, dy = 0;
    if (e.key === 'ArrowUp') dy = step; if (e.key === 'ArrowDown') dy = -step;
    if (e.key === 'ArrowLeft') dx = -step; if (e.key === 'ArrowRight') dx = step;
    if (dx !== 0 || dy !== 0) { 
        pen.x += dx; pen.y += dy; 
        currentStroke.points.push({ ...pen }); 
        render(); 
    }
    
    if (e.key === ' ') { saveStroke(); render(); }
});

// --- BUTTONS ---
if(btnReset) btnReset.onclick = () => { if(confirm("Start a New Job?")) { history = []; currentStroke.points = []; pen = {x:0, y:0}; camera = {x:0, y:0, zoom:5}; currentStroke.points.push({...pen}); render(); }};
if(btnRecenter) btnRecenter.onclick = () => { camera.x = pen.x; camera.y = pen.y; render(); };
if(btnGo) btnGo.onclick = () => { pen.x = parseFloat(inputX.value); pen.y = parseFloat(inputY.value); currentStroke.points.push({ ...pen }); render(); };
if(btnJump) btnJump.onclick = () => { 
    saveStroke();
    pen.x = parseFloat(inputX.value); pen.y = parseFloat(inputY.value); 
    currentStroke.points = [{ ...pen }]; 
    camera.x = pen.x; camera.y = pen.y; render(); 
};

if(btnUndo) btnUndo.onclick = () => {
    if (currentStroke.points.length > 1) { 
        currentStroke.points.pop(); 
        const prev = currentStroke.points[currentStroke.points.length - 1]; 
        pen.x = prev.x; pen.y = prev.y; 
    } else if (history.length > 0) { 
        // Restore previous stroke
        const last = history.pop();
        currentStroke = last;
        const prev = currentStroke.points[currentStroke.points.length - 1]; 
        pen.x = prev.x; pen.y = prev.y; 
    }
    render();
};

if(btnClose) btnClose.onclick = () => {
    if (currentStroke.points.length < 2) { alert("Draw a shape first!"); return; }
    const startPt = currentStroke.points[0]; pen.x = startPt.x; pen.y = startPt.y;
    currentStroke.points.push({ ...pen }); 
    saveStroke();
    if(inputX) inputX.value = pen.x.toFixed(2); if(inputY) inputY.value = pen.y.toFixed(2); render();
};

if(btnTraverse) btnTraverse.onclick = () => {
    const az = parseFloat(inputAz.value) || 0; const dist = parseFloat(inputDist.value) || 0;
    const rad = (az * Math.PI) / 180;
    pen.x += dist * Math.sin(rad); pen.y += dist * Math.cos(rad);
    currentStroke.points.push({ ...pen }); 
    if(inputX) inputX.value = pen.x.toFixed(2); if(inputY) inputY.value = pen.y.toFixed(2);
    camera.x = pen.x; camera.y = pen.y; render();
};

if(btnTurnLeft) btnTurnLeft.onclick = () => { inputAz.value = (parseFloat(inputAz.value) - 90 + 360) % 360; };
if(btnTurnRight) btnTurnRight.onclick = () => { inputAz.value = (parseFloat(inputAz.value) + 90) % 360; };

if(btnCurve) btnCurve.onclick = () => {
    const R = parseFloat(curveRadius.value);
    const facing = curveFacing.value; const turn = curveTurn.value;
    let startAngle = 0;
    if (facing === 'Tangent') {
        let prev = null;
        if (currentStroke.points.length > 1) { prev = currentStroke.points[currentStroke.points.length - 2]; } 
        else if (history.length > 0) {
            const lastShape = history[history.length - 1].points;
            const lastPt = lastShape[lastShape.length - 1];
            if (pen.x === lastPt.x && pen.y === lastPt.y) { prev = lastShape[lastShape.length - 2]; }
        }
        if (prev) { startAngle = Math.atan2(pen.y - prev.y, pen.x - prev.x); } 
        else { alert("No previous line to attach to!"); return; }
    } else {
        if (facing === 'N') startAngle = Math.PI / 2;
        if (facing === 'W') startAngle = Math.PI;
        if (facing === 'S') startAngle = -Math.PI / 2;
        if (facing === 'E') startAngle = 0;
    }
    const isLeft = (turn === 'Left');
    const sweep = isLeft ? (Math.PI / 2) : -(Math.PI / 2);
    const centerAngle = startAngle + (isLeft ? (Math.PI / 2) : -(Math.PI / 2));
    const centerX = pen.x + R * Math.cos(centerAngle);
    const centerY = pen.y + R * Math.sin(centerAngle);
    const steps = 20; let currentTheta = centerAngle + Math.PI;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps; const angle = currentTheta + (sweep * t);
        pen.x = centerX + R * Math.cos(angle); pen.y = centerY + R * Math.sin(angle);
        currentStroke.points.push({ ...pen });
    }
    if(inputX) inputX.value = pen.x.toFixed(2); if(inputY) inputY.value = pen.y.toFixed(2);
    render(); canvas.focus();
};

if(btnMeasure) btnMeasure.onclick = () => {
    measureMode = !measureMode; measureStart = null;
    btnMeasure.innerText = measureMode ? "RULER: ON" : "RULER: OFF";
    btnMeasure.style.background = measureMode ? "#f3e2a0" : "#333";
    btnMeasure.style.color = measureMode ? "#000" : "#aaa";
    measureOutput.innerText = "";
    canvas.style.cursor = measureMode ? 'help' : 'crosshair'; render();
};

if(btnToggleFill) btnToggleFill.onclick = () => {
    showFill = !showFill;
    btnToggleFill.innerText = showFill ? "Fill: ON" : "Fill: OFF";
    btnToggleFill.style.color = showFill ? "#fff" : "#777";
    render();
};

if(btnAddParcel) btnAddParcel.onclick = () => {
    let target = null;
    if (currentStroke.points.length > 2) target = currentStroke.points; 
    else if (history.length > 0) target = history[history.length - 1].points;
    if (!target) { alert("Draw a shape first!"); return; }
    const area = getShapeArea(target);
    const parcelID = String.fromCharCode(65 + parcels.length); 
    parcels.push({ id: parcelID, acres: area.acres, sqft: area.sqft });
    parcelListBody.innerHTML = ""; 
    parcels.forEach(p => {
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #333";
        row.innerHTML = `<td style="padding:4px; color:#f3e2a0; font-weight:bold;">${p.id}</td><td style="padding:4px; text-align:right;">${p.acres.toFixed(3)}</td><td style="padding:4px; text-align:right; color:#888;">${Math.round(p.sqft)}</td>`;
        parcelListBody.appendChild(row);
    });
};

if(btnZoomIn) btnZoomIn.onclick = () => { camera.zoom *= 1.2; render(); };
if(btnZoomOut) btnZoomOut.onclick = () => { camera.zoom /= 1.2; if (camera.zoom < 0.5) camera.zoom = 0.5; render(); };
if(btnFit) btnFit.onclick = () => {
    if (history.length === 0 && currentStroke.points.length <= 1) { camera = { x: 0, y: 0, zoom: 5 }; render(); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    [...history, currentStroke].forEach(strokeObj => {
        const pts = strokeObj.points || strokeObj;
        pts.forEach(pt => { if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x; if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y; });
    });
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
    const width = maxX - minX; const height = maxY - minY;
    const zoomX = canvas.width / (width * 1.2); const zoomY = canvas.height / (height * 1.2);
    camera.x = centerX; camera.y = centerY; camera.zoom = Math.min(zoomX, zoomY, 50); render();
};

// Paper Mode Toggle
if(btnPaperMode) btnPaperMode.onclick = () => {
    paperMode = !paperMode;
    btnPaperMode.innerText = paperMode ? "Dark Mode" : "Paper Mode";
    btnPaperMode.style.background = paperMode ? "#333" : "#eee";
    btnPaperMode.style.color = paperMode ? "#fff" : "#000";
    render();
};

if(btnPng) btnPng.onclick = () => {
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    link.download = `ArithmaSketch_${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

if(btnPdf) btnPdf.onclick = () => {
    if (!window.jspdf) { alert("PDF Library not loaded."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const imgData = canvas.toDataURL('image/png');
    const imgProps = doc.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pageWidth) / imgProps.width;
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pdfHeight);
    const date = new Date().toISOString().slice(0,10);
    doc.save(`ArithmaSketch_${date}.pdf`);
};

// FIX: Update Camera Zoom when user types a number
if(inputScale) inputScale.onchange = () => {
    const val = parseFloat(inputScale.value);
    // Safety check: make sure it's a real number and not 0
    if (!isNaN(val) && val > 0.1) {
        camera.zoom = val;
        render();
    } else {
        // If they typed junk, put the old number back
        inputScale.value = camera.zoom.toFixed(1);
    }
};

// Inputs update current styles
if(inputColor) inputColor.oninput = () => { currentStroke.color = inputColor.value; };
if(inputWidth) inputWidth.oninput = () => { currentStroke.width = parseInt(inputWidth.value); };

// ==========================================
// SAVE & LOAD SYSTEM
// ==========================================
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const fileInput = document.getElementById('file-input');

// 1. SAVE JOB (Download JSON)
if(btnSave) btnSave.onclick = () => {
    const jobData = {
        version: "1.0",
        date: new Date().toISOString(),
        history: history,
        parcels: parcels // Save the parcels too
    };

    const jsonString = JSON.stringify(jobData, null, 2);
    const blob = new Blob([jsonString], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    link.download = `ArithmaJob_${date}.json`;
    link.href = url;
    link.click();
};

// 2. LOAD JOB (Trigger File Picker)
if(btnLoad) btnLoad.onclick = () => {
    fileInput.click(); 
};

// 3. READ FILE (When user picks a file)
if(fileInput) fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            // Restore History
            if (data.history) history = data.history;
            
            // Restore Parcels
            if (data.parcels) {
                parcels = data.parcels;
                // Rebuild Parcel List UI
                if(typeof parcelListBody !== 'undefined') {
                    parcelListBody.innerHTML = ""; 
                    parcels.forEach(p => {
                        const row = document.createElement('tr');
                        row.style.borderBottom = "1px solid #333";
                        row.innerHTML = `<td style="padding:4px; color:#f3e2a0; font-weight:bold;">${p.id}</td><td style="padding:4px; text-align:right;">${p.acres.toFixed(3)}</td><td style="padding:4px; text-align:right; color:#888;">${Math.round(p.sqft)}</td>`;
                        parcelListBody.appendChild(row);
                    });
                }
            }
            
            // Move pen to end of last shape
            if (history.length > 0) {
                const lastShape = history[history.length - 1];
                const pts = lastShape.points || lastShape;
                const lastPt = pts[pts.length - 1];
                pen.x = lastPt.x;
                pen.y = lastPt.y;
                currentStroke.points = [{...pen}];
            } else {
                pen = {x:0, y:0};
                currentStroke.points = [{...pen}];
            }
            
            // Update UI
            if(inputX) inputX.value = pen.x.toFixed(2);
            if(inputY) inputY.value = pen.y.toFixed(2);
            
            // Auto-Zoom
            if(btnFit) btnFit.click();
            else render();
            
            alert("Job Loaded Successfully!");
            
        } catch (err) {
            console.error(err);
            alert("Error loading file. Is this a valid .json job file?");
        }
    };
    reader.readAsText(file);
};

// ==========================================
// MATH HELPERS (For Smart Labels)
// ==========================================

function getBearingAndDist(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Calculate Azimuth (0-360)
    let az = Math.atan2(dx, dy) * (180 / Math.PI);
    if (az < 0) az += 360;
    
    // Convert to Quadrant Bearing (e.g., N 45° E)
    let bearing = "";
    if (az >= 0 && az < 90) bearing = "N " + az.toFixed(1) + "° E";
    else if (az >= 90 && az < 180) bearing = "S " + (180 - az).toFixed(1) + "° E";
    else if (az >= 180 && az < 270) bearing = "S " + (az - 180).toFixed(1) + "° W";
    else bearing = "N " + (360 - az).toFixed(1) + "° W";
    
    return { text: `${bearing}  ${dist.toFixed(2)}'`, angle: az };
}

function drawSmartLabel(ctx, p1, p2, toScreenFunc) {
    const data = getBearingAndDist(p1, p2);
    
    const s1 = toScreenFunc(p1.x, p1.y);
    const s2 = toScreenFunc(p2.x, p2.y);
    const midX = (s1.x + s2.x) / 2;
    const midY = (s1.y + s2.y) / 2;
    
    ctx.save();
    ctx.translate(midX, midY);
    
    // Align text to line
    const dy = s2.y - s1.y;
    const dx = s2.x - s1.x;
    let rotation = Math.atan2(dy, dx);
    if (Math.abs(rotation) > Math.PI / 2) rotation += Math.PI;
    
    ctx.rotate(rotation);
    ctx.fillStyle = "#00FFFF"; // Cyan
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom"; 
    ctx.fillText(data.text, 0, -3); 
    ctx.restore();
}

// ==========================================
// MAIN RENDER ENGINE
// ==========================================

function render() {
    // 1. SETUP COLORS
    const isLight = document.body.getAttribute('data-theme') === 'light';
    const bgColor = isLight ? '#f1f5f9' : '#0f172a'; 
    const gridColor = isLight ? '#cbd5e1' : '#1e293b'; 
    const axisColor = isLight ? '#94a3b8' : '#334155';
    
    const finalBg = paperMode ? '#ffffff' : bgColor;
    const finalGrid = paperMode ? '#e0e0e0' : gridColor;
    const finalAxis = paperMode ? '#888888' : axisColor;

    // Clear Screen
    ctx.fillStyle = finalBg; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update Zoom Box safely
    if (typeof inputScale !== 'undefined' && inputScale && document.activeElement !== inputScale) {
        inputScale.value = camera.zoom.toFixed(1);
    }
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Helper: World to Screen
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // 2. DRAW THE GRID
    const gridSize = 100 * camera.zoom; 
    const offsetX = (camera.x * camera.zoom) % gridSize;
    const offsetY = (camera.y * camera.zoom) % gridSize;
    
    ctx.beginPath();
    ctx.strokeStyle = finalGrid;
    ctx.lineWidth = 0.5;

    for (let x = -offsetX; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Origin
    const origin = toScreen(0,0);
    ctx.strokeStyle = finalAxis; 
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y); ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10); ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();

    // 3. DRAW HISTORY
    history.forEach(strokeObj => {
        const points = strokeObj.points || [];
        if (points.length < 2) return;
        
        let strokeColor = strokeObj.color || '#f3e2a0';
        let strokeWidth = strokeObj.width || 2;

        if (paperMode) {
             if (strokeColor.toLowerCase().includes('f3e2a0') || strokeColor.toLowerCase() === '#ffffff') {
                 strokeColor = '#000000';
             }
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath(); // PREVENTS CRASH
        const start = toScreen(points[0].x, points[0].y);
        ctx.moveTo(start.x, start.y);
        
        for (let i = 1; i < points.length; i++) {
            const pt = toScreen(points[i].x, points[i].y);
            ctx.lineTo(pt.x, pt.y);
        }

        // Fill if closed
        const first = points[0];
        const last = points[points.length - 1];
        const isClosed = Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01;
        
        if (isClosed && typeof showFill !== 'undefined' && showFill) {
            ctx.fillStyle = paperMode ? 'rgba(0,0,0,0.05)' : 'rgba(243, 226, 160, 0.15)'; 
            ctx.fill();
        }
        ctx.stroke();

        // Labels
        if (strokeObj.hasLabel && !paperMode) {
            for (let i = 0; i < points.length - 1; i++) {
                drawSmartLabel(ctx, points[i], points[i+1], toScreen);
            }
        }
    });

    // 4. DRAW CURRENT STROKE
    if (currentStroke.points.length > 0) {
        ctx.strokeStyle = inputColor.value;
        ctx.lineWidth = parseInt(inputWidth.value);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        const start = toScreen(currentStroke.points[0].x, currentStroke.points[0].y);
        ctx.moveTo(start.x, start.y);
        
        for (let i = 1; i < currentStroke.points.length; i++) {
            const pt = toScreen(currentStroke.points[i].x, currentStroke.points[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }
}

// ==========================================
// APP INITIALIZATION
// ==========================================

function resize() {
    canvas.width = canvasContainer.clientWidth;
    canvas.height = canvasContainer.clientHeight;
    render();
}

window.addEventListener('resize', resize);
resize(); // Start the app

// INITIAL DRAW
//resize();

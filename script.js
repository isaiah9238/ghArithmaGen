// ==========================================
// 1. SETUP
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputScale = document.getElementById('input-scale');
const offsetDisplay = document.getElementById('offset-display');
const curveRadius = document.getElementById('curve-radius');
const curveFacing = document.getElementById('curve-facing');
const curveTurn = document.getElementById('curve-turn');
const btnGo = document.getElementById('btn-go');
const btnCurve = document.getElementById('btn-curve');
const btnRecenter = document.getElementById('btn-recenter');
const btnReset = document.getElementById('btn-reset');

// ==========================================
// 2. STATE
// ==========================================
let history = []; 
let currentStroke = []; 
let pen = { x: 0, y: 0 }; 
let camera = { x: 0, y: 0, zoom: 5 };
let snap = { active: false, x: 0, y: 0, type: '' }; // NEW: Snap State

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

// Init
currentStroke.push({ ...pen });

function render() {
    // A. Setup
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sync UI with Camera State
    inputScale.value = camera.zoom.toFixed(1);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // World -> Screen Transform
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // B. DRAW GRID
    drawGrid(ctx, camera, cx, cy, canvas.width, canvas.height);

    // C. DRAW ORIGIN
    const origin = toScreen(0,0);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y); ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10); ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();

    // D. DRAW SKETCH
    ctx.strokeStyle = '#f3e2a0'; // Gold
    ctx.lineWidth = 2;
    ctx.beginPath();
    [...history, currentStroke].forEach(stroke => {
        if (stroke.length < 2) return;
        const start = toScreen(stroke[0].x, stroke[0].y);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < stroke.length; i++) {
            const pt = toScreen(stroke[i].x, stroke[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
    });
    ctx.stroke();

    // E. DRAW SNAP CURSOR OR PEN
    // If we are snapped, draw the Yellow Box
    if (snap.active) {
        const s = toScreen(snap.x, snap.y);
        ctx.strokeStyle = '#FFFF00'; // Yellow
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x - 6, s.y - 6, 12, 12); // The Box
        } else {
        // Normal Pen
        const p = toScreen(pen.x, pen.y);
        ctx.fillStyle = '#d99e33';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // F. HUD ELEMENTS
    drawNorthArrow(ctx, canvas.width);
    drawScaleBar(ctx, canvas.height, camera.zoom);

    // G. UPDATE DATA
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2);
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `${dist.toFixed(2)}'`;
}

// --- HELPER: GRID SYSTEM ---
function drawGrid(ctx, cam, cx, cy, w, h) {
    const step = 10; 
    const zoom = cam.zoom;
    if (step * zoom < 10) return; 

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#444';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const worldLeft = cam.x - (cx / zoom);
    const worldRight = cam.x + (cx / zoom);
    const worldTop = cam.y + (cy / zoom);
    const worldBottom = cam.y - (cy / zoom);

    const startX = Math.floor(worldLeft / step) * step;
    const endX = Math.ceil(worldRight / step) * step;
    const startY = Math.floor(worldBottom / step) * step;
    const endY = Math.ceil(worldTop / step) * step;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
        const screenX = (x - cam.x) * zoom + cx;
        ctx.moveTo(screenX, 0); ctx.lineTo(screenX, h);
        if (x % 50 === 0) ctx.fillText(x, screenX + 2, h - 5); 
    }
    for (let y = startY; y <= endY; y += step) {
        const screenY = (cam.y - y) * zoom + cy;
        ctx.moveTo(0, screenY); ctx.lineTo(w, screenY);
        if (y % 50 === 0) ctx.fillText(y, 5, screenY - 2);
    }
    ctx.stroke();
}

function drawNorthArrow(ctx, w) {
    const x = w - 40; const y = 40;
    ctx.strokeStyle = '#f3e2a0'; ctx.fillStyle = '#f3e2a0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 10, y + 10);
    ctx.lineTo(x, y); ctx.lineTo(x + 10, y + 10); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', x, y - 25);
}

function drawScaleBar(ctx, h, zoom) {
    const targetPx = 100; const worldUnits = targetPx / zoom;
    let scaleUnit = 10;
    if (worldUnits > 20) scaleUnit = 20; if (worldUnits > 50) scaleUnit = 50; if (worldUnits > 100) scaleUnit = 100;
    const barWidth = scaleUnit * zoom; const x = 20; const y = h - 30;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 5); ctx.lineTo(x + barWidth, y - 5);
    ctx.lineTo(x + barWidth, y); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 5, barWidth / 2, 5);
    ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(`Scale: ${scaleUnit} ft`, x, y - 10);
}

// ==========================================
// 4. CONTROLS
// ==========================================

// --- A. MOUSE WHEEL ZOOM (NEW!) ---
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = camera.zoom + (delta * zoomIntensity * camera.zoom);
    
    // Clamp zoom levels
    camera.zoom = Math.max(0.5, Math.min(newZoom, 100));
    render();
}, { passive: false });


// --- B. MOUSE MOVE & SNAP ENGINE (NEW!) ---
let isDragging = false;
let lastX=0, lastY=0;

canvas.addEventListener('mousedown', (e) => {
    // If we are snapped, clicking should move the pen to the snap point!
    if (snap.active) {
        pen.x = snap.x;
        pen.y = snap.y;
        currentStroke.push({ ...pen });
        render();
        return; // Don't drag if we just clicked a point
    }
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => { isDragging = false; canvas.style.cursor = 'crosshair'; });

canvas.addEventListener('mousemove', (e) => {
    // 1. PANNING LOGIC
    if (isDragging) {
        const dx = e.clientX - lastX; 
        const dy = e.clientY - lastY;
        camera.x -= dx / camera.zoom; 
        camera.y += dy / camera.zoom;
        lastX = e.clientX; 
        lastY = e.clientY;
        render();
        return;
    }

    // 2. SNAPPING LOGIC (The Magnet)
    // Convert mouse pixels to world coordinates
    const rect = canvas.getBoundingClientRect();
    const mousePxX = e.clientX - rect.left;
    const mousePxY = e.clientY - rect.top;
    
    // Reverse Transform (Screen -> World)
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const worldX = (mousePxX - cx) / camera.zoom + camera.x;
    const worldY = camera.y - (mousePxY - cy) / camera.zoom;

    // Check distance to all known points
    let nearestDist = Infinity;
    let nearestPt = null;

    // Collect all points from history + current stroke
    const allStrokes = [...history, currentStroke];
    
    allStrokes.forEach(stroke => {
        stroke.forEach(pt => {
            const dx = pt.x - worldX;
            const dy = pt.y - worldY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestPt = pt;
            }
        });
    });

    // Snap Threshold (in pixels, converted to world units)
    const snapPixelThreshold = 15; 
    const snapWorldThreshold = snapPixelThreshold / camera.zoom;

    if (nearestPt && nearestDist < snapWorldThreshold) {
        snap.active = true;
        snap.x = nearestPt.x;
        snap.y = nearestPt.y;
        canvas.style.cursor = 'none'; // Hide mouse when snapped
    } else {
        snap.active = false;
        canvas.style.cursor = 'crosshair';
    }
    render();
});

// --- C. KEYBOARD & BUTTONS ---
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (currentStroke.length > 1) {
            currentStroke.pop(); 
            const prev = currentStroke[currentStroke.length - 1];
            pen.x = prev.x; pen.y = prev.y;
        } else if (history.length > 0) {
            currentStroke = history.pop(); 
            const prev = currentStroke[currentStroke.length - 1];
            pen.x = prev.x; pen.y = prev.y;
        }
        render();
        return; 
    }

    const step = 1; let dx = 0, dy = 0;
    if (e.key === 'ArrowUp') dy = step;
    if (e.key === 'ArrowDown') dy = -step;
    if (e.key === 'ArrowLeft') dx = -step;
    if (e.key === 'ArrowRight') dx = step;

    if (dx !== 0 || dy !== 0) {
        pen.x += dx; pen.y += dy;
        currentStroke.push({ ...pen });
        render();
    }
    
    if (e.key === ' ') {
        if (currentStroke.length > 0) history.push([...currentStroke]);
        currentStroke = [{ ...pen }];
        render();
    }
});

btnCurve.onclick = () => {
    const R = parseFloat(curveRadius.value);
    const facing = curveFacing.value; 
    const turn = curveTurn.value;
    
    let startAngle = 0;
    if (facing === 'N') startAngle = Math.PI / 2;
    if (facing === 'W') startAngle = Math.PI;
    if (facing === 'S') startAngle = -Math.PI / 2;
    if (facing === 'E') startAngle = 0;

    const isLeft = (turn === 'Left');
    const sweep = isLeft ? (Math.PI / 2) : -(Math.PI / 2);
    const centerAngle = startAngle + (isLeft ? (Math.PI / 2) : -(Math.PI / 2));
    const centerX = pen.x + R * Math.cos(centerAngle);
    const centerY = pen.y + R * Math.sin(centerAngle);

    const steps = 20; 
    let currentTheta = centerAngle + Math.PI;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const angle = currentTheta + (sweep * t);
        pen.x = centerX + R * Math.cos(angle);
        pen.y = centerY + R * Math.sin(angle);
        currentStroke.push({ ...pen });
    }
    render();
    canvas.focus();
};

btnReset.onclick = () => {
    if(confirm("Start a New Job?")) {
        history = []; currentStroke = [];
        pen = {x:0, y:0}; camera = {x:0, y:0, zoom:5};
        currentStroke.push({...pen});
        render();
    }
};

btnGo.onclick = () => {
    pen.x = parseFloat(inputX.value); pen.y = parseFloat(inputY.value);
    currentStroke.push({ ...pen }); render();
};
btnRecenter.onclick = () => { camera.x = pen.x; camera.y = pen.y; render(); };
inputScale.onchange = render;

// ==========================================
// LAPTOP ZOOM CONTROLS
// ==========================================

const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnFit = document.getElementById('btn-fit');

// 1. BUTTON ZOOM
// Zooms in/out by 20% each click
btnZoomIn.onclick = () => {
    camera.zoom *= 1.2;
    render();
};

btnZoomOut.onclick = () => {
    camera.zoom /= 1.2;
    // Don't let it vanish
    if (camera.zoom < 0.5) camera.zoom = 0.5;
    render();
};

// 2. "FIT TO SCREEN" (Finds your drawing)
btnFit.onclick = () => {
    // If drawing is empty, just reset
    if (history.length === 0 && currentStroke.length <= 1) {
        camera = { x: 0, y: 0, zoom: 5 };
        render();
        return;
    }

    // Find the bounds of your drawing
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    const allStrokes = [...history, currentStroke];
    allStrokes.forEach(stroke => {
        stroke.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });
    });

    // Center the camera on the drawing
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculate required zoom to fit everything
    const width = maxX - minX;
    const height = maxY - minY;
    // Add 20% padding
    const zoomX = canvas.width / (width * 1.2);
    const zoomY = canvas.height / (height * 1.2);
    
    camera.x = centerX;
    camera.y = centerY;
    camera.zoom = Math.min(zoomX, zoomY, 50); // Cap max zoom
    
    render();
};

// 3. KEYBOARD SHORTCUTS (+ and -)
window.addEventListener('keydown', (e) => {
    if (e.key === '=' || e.key === '+') { // Plus key
        camera.zoom *= 1.1;
        render();
    }
    if (e.key === '-') { // Minus key
        camera.zoom /= 1.1;
        render();
    }
});

// Initial Draw
resize();

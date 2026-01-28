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
let parcels = []; // Stores saved parcel data
let showFill = true; // Toggle state

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

    // D. DRAW SKETCH (New "AutoCAD Style" Logic)
    ctx.lineWidth = 2;
    
    // Loop through every shape in history + the one you are drawing now
    [...history, currentStroke].forEach(stroke => {
        if (stroke.length < 2) return;
        
        ctx.beginPath(); // Start a new path for THIS specific shape
        
        const start = toScreen(stroke[0].x, stroke[0].y);
        ctx.moveTo(start.x, start.y);
        
        for (let i = 1; i < stroke.length; i++) {
            const pt = toScreen(stroke[i].x, stroke[i].y);
            ctx.lineTo(pt.x, pt.y);
        }

        // CHECK CLOSURE: Is the last point effectively the same as the start?
        const first = stroke[0];
        const last = stroke[stroke.length - 1];
        const isClosed = Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001;

        if (isClosed) {
            // It's a closed polygon!
            if (showFill) {
                ctx.fillStyle = 'rgba(243, 226, 160, 0.15)'; // Transparent Gold Fill
                ctx.fill();
            }
            ctx.strokeStyle = '#f3e2a0'; // Solid Gold Outline
        } else {
            // It's just a line (not closed)
            ctx.strokeStyle = '#f3e2a0'; 
            
            // If this is the active line (the one you are drawing right now), make it bright white
            if (stroke === currentStroke) ctx.strokeStyle = '#fff';
        }
        
        ctx.stroke(); // Draw this specific shape
    });
    
    // E. DRAW SNAP CURSOR
    if (snap.active) {
        const s = toScreen(snap.x, snap.y);
        ctx.strokeStyle = '#FFFF00'; // Yellow
        ctx.lineWidth = 2;
        
        if (snap.type === 'END') {
            ctx.strokeRect(s.x - 6, s.y - 6, 12, 12); // Square
        } 
        else if (snap.type === 'MID') {
            // Triangle
            ctx.beginPath();
            ctx.moveTo(s.x, s.y - 8);
            ctx.lineTo(s.x - 7, s.y + 6);
            ctx.lineTo(s.x + 7, s.y + 6);
            ctx.closePath();
            ctx.stroke();
        } 
        else if (snap.type === 'PERP') {
            // Perpendicular Symbol
            ctx.beginPath();
            ctx.moveTo(s.x - 6, s.y + 6);
            ctx.lineTo(s.x + 6, s.y + 6); // Base
            ctx.moveTo(s.x, s.y + 6);
            ctx.lineTo(s.x, s.y - 6); // Vertical
            ctx.stroke();
        }
    } 

    // F. DRAW MEASURE LINE (Rubber Band)
    if (measureMode && measureStart) {
        const s = toScreen(measureStart.x, measureStart.y);
        
        // Find current mouse position (approximate based on snap or raw)
        // (For simplicity in render, we just draw start point)
        ctx.fillStyle = '#00FF00'; // Green
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI*2);
        ctx.fill();
        
        // Note: Ideally we pass current mouse pos to render for the line
        // but seeing the start point is usually enough context.
    }

    // F. HUD ELEMENTS
    drawNorthArrow(ctx, canvas.width);
    drawScaleBar(ctx, canvas.height, camera.zoom);

    // G. UPDATE DATA
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2);
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `${dist.toFixed(2)}'`;
    updateLiveArea();
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


// ==========================================
// ADVANCED SNAP & MEASURE ENGINE
// ==========================================
const snapEnd = document.getElementById('snap-end');
const snapMid = document.getElementById('snap-mid');
const snapPerp = document.getElementById('snap-perp');
const btnMeasure = document.getElementById('btn-measure');
const measureOutput = document.getElementById('measure-output');

let measureMode = false;
let measureStart = null; 

// --- DRAG STATE (Essential for panning) ---
let isDragging = false;
let lastX=0, lastY=0;

// 1. TOGGLE MEASURE MODE
btnMeasure.onclick = () => {
    measureMode = !measureMode;
    measureStart = null; 
    if (measureMode) {
        btnMeasure.innerText = "RULER: ON";
        btnMeasure.style.background = "#f3e2a0";
        btnMeasure.style.color = "#000";
        canvas.style.cursor = 'help';
    } else {
        btnMeasure.innerText = "RULER: OFF";
        btnMeasure.style.background = "#333";
        btnMeasure.style.color = "#aaa";
        measureOutput.innerText = "";
        canvas.style.cursor = 'crosshair';
    }
    render();
};

// 2. MOUSE UP (Reset Drag)
window.addEventListener('mouseup', () => { 
    isDragging = false; 
    if (!measureMode) canvas.style.cursor = 'crosshair'; 
});

// 3. MOUSE DOWN (Click Action)
canvas.addEventListener('mousedown', (e) => {
    isDragging = false; 

    // DETERMINE CLICK POINT (Snap or Free)
    let clickX = pen.x; 
    let clickY = pen.y;
    
    // Calculate world coords again for the click
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const worldX = ((e.clientX - rect.left) - cx) / camera.zoom + camera.x;
    const worldY = camera.y - ((e.clientY - rect.top) - cy) / camera.zoom;

    if (snap.active) {
        clickX = snap.x;
        clickY = snap.y;
    } else {
        // If not snapped, click where the mouse is
        clickX = worldX;
        clickY = worldY;
    }

    // MEASURE MODE LOGIC
    if (measureMode) {
        if (!measureStart) {
            // First Click: Start Measuring
            measureStart = { x: clickX, y: clickY };
            measureOutput.innerText = "Select 2nd point...";
        } else {
            // Second Click: Finish Measuring
            const dx = clickX - measureStart.x;
            const dy = clickY - measureStart.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Calculate Azimuth
            let az = Math.atan2(dx, dy) * (180 / Math.PI);
            if (az < 0) az += 360;

            measureOutput.innerText = `Dist: ${dist.toFixed(2)}' | Az: ${az.toFixed(1)}°`;
            
            // Reset for next measurement
            measureStart = null;
        }
        render();
        return; // STOP HERE (Don't draw or drag)
    }

    // DRAW MODE LOGIC
    if (snap.active) {
        pen.x = snap.x;
        pen.y = snap.y;
        currentStroke.push({ ...pen });
        render();
        return; 
    }

    // Pan (Drag)
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

// 4. MOUSE MOVE (The Brains)
canvas.addEventListener('mousemove', (e) => {
    // PANNING
    if (isDragging) {
        const dx = e.clientX - lastX; 
        const dy = e.clientY - lastY;
        camera.x -= dx / camera.zoom; 
        camera.y += dy / camera.zoom;
        lastX = e.clientX; lastY = e.clientY;
        render();
        return;
    }

    // GET WORLD COORDINATES
    const rect = canvas.getBoundingClientRect();
    const mousePxX = e.clientX - rect.left;
    const mousePxY = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const worldX = (mousePxX - cx) / camera.zoom + camera.x;
    const worldY = camera.y - (mousePxY - cy) / camera.zoom; 

    // ADVANCED SNAP LOGIC
    let bestDist = Infinity;
    let bestPt = null;
    let bestType = "";

    const snapPixelThreshold = 15; 
    const snapWorldThreshold = snapPixelThreshold / camera.zoom;

    const allStrokes = [...history, currentStroke];

    // Helper: Distance squared
    const distSq = (x1, y1, x2, y2) => (x1-x2)**2 + (y1-y2)**2;

    allStrokes.forEach(stroke => {
        if (stroke.length < 2) return; 

        for (let i = 0; i < stroke.length; i++) {
            const p1 = stroke[i];
            
            // A. ENDPOINT SNAP
            if (snapEnd.checked) {
                const d = distSq(p1.x, p1.y, worldX, worldY);
                if (d < bestDist) {
                    bestDist = d;
                    bestPt = { x: p1.x, y: p1.y };
                    bestType = "END";
                }
            }

            // Check segments
            if (i < stroke.length - 1) {
                const p2 = stroke[i+1];

                // B. MIDPOINT SNAP
                if (snapMid.checked) {
                    const mx = (p1.x + p2.x) / 2;
                    const my = (p1.y + p2.y) / 2;
                    const d = distSq(mx, my, worldX, worldY);
                    if (d < bestDist) {
                        bestDist = d;
                        bestPt = { x: mx, y: my };
                        bestType = "MID";
                    }
                }

                // C. PERPENDICULAR SNAP
                if (snapPerp.checked) {
                    const A = worldX - p1.x;
                    const B = worldY - p1.y;
                    const C = p2.x - p1.x;
                    const D = p2.y - p1.y;
                    
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    if (lenSq !== 0) param = dot / lenSq;

                    if (param > 0 && param < 1) { 
                        const xx = p1.x + param * C;
                        const yy = p1.y + param * D;
                        const d = distSq(xx, yy, worldX, worldY);
                        if (d < bestDist) {
                            bestDist = d;
                            bestPt = { x: xx, y: yy };
                            bestType = "PERP";
                        }
                    }
                }
            }
        }
    });

    // APPLY SNAP
    if (bestPt && Math.sqrt(bestDist) < snapWorldThreshold) {
        snap.active = true;
        snap.x = bestPt.x;
        snap.y = bestPt.y;
        snap.type = bestType;
        canvas.style.cursor = 'none';
    } else {
        snap.active = false;
        snap.type = '';
        canvas.style.cursor = measureMode ? 'help' : 'crosshair';
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

// ==========================================
// TRAVERSE TOOL (Bearing & Distance)
// ==========================================
const inputAz = document.getElementById('input-az');
const inputDist = document.getElementById('input-dist');
const btnTraverse = document.getElementById('btn-traverse');
const btnTurnLeft = document.getElementById('btn-turn-left');
const btnTurnRight = document.getElementById('btn-turn-right');

// 1. HELPER: Calculate current back-azimuth (direction we just came from)
function getPreviousAzimuth() {
    if (currentStroke.length < 2) return 0; // Default to North if no history
    const p1 = currentStroke[currentStroke.length - 2];
    const p2 = currentStroke[currentStroke.length - 1];
    
    // Math.atan2 gives radians -PI to +PI. We convert to Degrees 0-360.
    let deg = Math.atan2(p2.x - p1.x, p2.y - p1.y) * (180 / Math.PI); // Note: (dx, dy) swapped for Azimuth (0=N) logic
    if (deg < 0) deg += 360;
    return deg;
}

// 2. TURN BUTTONS (Quick Angle Logic)
// If I am walking North (0) and turn Right 90, my new Azimuth is 90.
btnTurnLeft.onclick = () => {
    let currentAz = parseFloat(inputAz.value) || 0;
    currentAz = (currentAz - 90 + 360) % 360; // Subtract 90
    inputAz.value = currentAz;
};

btnTurnRight.onclick = () => {
    let currentAz = parseFloat(inputAz.value) || 0;
    currentAz = (currentAz + 90) % 360; // Add 90
    inputAz.value = currentAz;
};

// 3. THE CALCULATOR
btnTraverse.onclick = () => {
    const az = parseFloat(inputAz.value) || 0;
    const dist = parseFloat(inputDist.value) || 0;

    // Convert Survey Azimuth (0 is North, Clockwise) to Math Radians
    // Math: 0 is East, Counter-Clockwise. 
    // Trig Formula for Surveying: 
    // dE (x) = dist * sin(az)
    // dN (y) = dist * cos(az)
    
    const rad = (az * Math.PI) / 180;
    
    const dx = dist * Math.sin(rad);
    const dy = dist * Math.cos(rad);

    // Move Pen
    pen.x += dx;
    pen.y += dy;

    currentStroke.push({ ...pen });
    
    // Update UI
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2);
    
    // Center camera on new point so we don't draw off-screen
    camera.x = pen.x;
    camera.y = pen.y;    
    render();
};

// ==========================================
// JUMP TOOL (Move without drawing)
// ==========================================
const btnJump = document.getElementById('btn-jump');

btnJump.onclick = () => {
    // 1. "Lift" the pen (Save current line to history)
    if (currentStroke.length > 0) {
        history.push([...currentStroke]);
    }

    // 2. Teleport the pen
    pen.x = parseFloat(inputX.value) || 0;
    pen.y = parseFloat(inputY.value) || 0;

    // 3. Start a fresh line at the new spot
    currentStroke = [{ ...pen }];

    // 4. Center Camera on the new spot so you don't get lost
    camera.x = pen.x;
    camera.y = pen.y;

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

// ==========================================
// PARCEL MANAGER & AREA
// ==========================================
const btnToggleFill = document.getElementById('btn-toggle-fill');
const btnAddParcel = document.getElementById('btn-add-parcel');
const areaDisplay = document.getElementById('area-display');
const parcelListBody = document.getElementById('parcel-list-body');
let parcels = []; 
let showFill = true; 

// 1. TOGGLE FILL
btnToggleFill.onclick = () => {
    showFill = !showFill;
    btnToggleFill.innerText = showFill ? "Fill: ON" : "Fill: OFF";
    btnToggleFill.style.color = showFill ? "#fff" : "#777";
    render();
};

// 2. HELPER: CALCULATE AREA
function getShapeArea(shape) {
    if (!shape || shape.length < 3) return { sqft: 0, acres: 0 };
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < shape.length - 1; i++) {
        sum1 += shape[i].x * shape[i+1].y;
        sum2 += shape[i].y * shape[i+1].x;
    }
    const first = shape[0];
    const last = shape[shape.length - 1];
    if (first.x !== last.x || first.y !== last.y) {
        sum1 += last.x * first.y;
        sum2 += last.y * first.x;
    }
    const sqft = Math.abs(0.5 * (sum1 - sum2));
    return { sqft: sqft, acres: sqft / 43560 };
}

// 3. ADD PARCEL TO LIST
btnAddParcel.onclick = () => {
    let targetShape = null;
    if (currentStroke.length > 2) targetShape = currentStroke; 
    else if (history.length > 0) targetShape = history[history.length - 1];

    if (!targetShape) { alert("Draw a shape first!"); return; }

    const area = getShapeArea(targetShape);
    const parcelID = String.fromCharCode(65 + parcels.length); 
    parcels.push({ id: parcelID, acres: area.acres, sqft: area.sqft });
    
    parcelListBody.innerHTML = ""; 
    parcels.forEach(p => {
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #333";
        row.innerHTML = `
            <td style="padding:4px; color:#f3e2a0; font-weight:bold;">${p.id}</td>
            <td style="padding:4px; text-align:right;">${p.acres.toFixed(3)}</td>
            <td style="padding:4px; text-align:right; color:#888;">${Math.round(p.sqft)}</td>`;
        parcelListBody.appendChild(row);
    });
};

function updateLiveArea() {
    let target = currentStroke.length > 2 ? currentStroke : (history.length > 0 ? history[history.length-1] : null);
    if(target) {
        const a = getShapeArea(target);
        if(areaDisplay) areaDisplay.innerText = `${a.acres.toFixed(3)} Ac`;
    }
}

// Initial Draw
resize();

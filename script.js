// ==========================================
// 1. SETUP
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');

// UI Elements - JOB
const btnReset = document.getElementById('btn-reset');
const btnRecenter = document.getElementById('btn-recenter');
const btnUndo = document.getElementById('btn-undo');
const btnClose = document.getElementById('btn-close');

// UI Elements - TRAVERSE
const inputAz = document.getElementById('input-az');
const inputDist = document.getElementById('input-dist');
const btnTraverse = document.getElementById('btn-traverse');
const btnTurnLeft = document.getElementById('btn-turn-left');
const btnTurnRight = document.getElementById('btn-turn-right');

// UI Elements - COORDS
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const btnGo = document.getElementById('btn-go');
const btnJump = document.getElementById('btn-jump');

// UI Elements - CURVE
const curveRadius = document.getElementById('curve-radius');
const curveFacing = document.getElementById('curve-facing');
const curveTurn = document.getElementById('curve-turn');
const btnCurve = document.getElementById('btn-curve');

// UI Elements - SNAPS
const snapEnd = document.getElementById('snap-end');
const snapMid = document.getElementById('snap-mid');
const snapPerp = document.getElementById('snap-perp');
const btnMeasure = document.getElementById('btn-measure');
const measureOutput = document.getElementById('measure-output');

// UI Elements - AREA
const btnToggleFill = document.getElementById('btn-toggle-fill');
const btnAddParcel = document.getElementById('btn-add-parcel');
const areaDisplay = document.getElementById('area-display');
const parcelListBody = document.getElementById('parcel-list-body');

// UI Elements - VIEW
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnFit = document.getElementById('btn-fit');
const inputScale = document.getElementById('input-scale');
const offsetDisplay = document.getElementById('offset-display');

// ==========================================
// 2. STATE
// ==========================================
let history = []; 
let currentStroke = []; 
let pen = { x: 0, y: 0 }; 
let camera = { x: 0, y: 0, zoom: 5 };
let snap = { active: false, x: 0, y: 0, type: '' }; 

// Area State
let parcels = []; 
let showFill = true; 

// Measure State
let measureMode = false;
let measureStart = null; 

// Mouse State
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

currentStroke.push({ ...pen });

function render() {
    // Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update Zoom Input safely
    if (inputScale) inputScale.value = camera.zoom.toFixed(1);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // A. DRAW GRID
    drawGrid(ctx, camera, cx, cy, canvas.width, canvas.height);

    // B. DRAW ORIGIN
    const origin = toScreen(0,0);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y); ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10); ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();

    // C. DRAW SKETCH (With Fill Logic)
    ctx.lineWidth = 2;
    [...history, currentStroke].forEach(stroke => {
        if (stroke.length < 2) return;
        
        ctx.beginPath();
        const start = toScreen(stroke[0].x, stroke[0].y);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < stroke.length; i++) {
            const pt = toScreen(stroke[i].x, stroke[i].y);
            ctx.lineTo(pt.x, pt.y);
        }

        // Check Closure
        const first = stroke[0];
        const last = stroke[stroke.length - 1];
        const isClosed = Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001;

        if (isClosed) {
            if (showFill) {
                ctx.fillStyle = 'rgba(243, 226, 160, 0.15)'; 
                ctx.fill();
            }
            ctx.strokeStyle = '#f3e2a0'; 
        } else {
            ctx.strokeStyle = '#f3e2a0'; 
            if (stroke === currentStroke) ctx.strokeStyle = '#fff';
        }
        ctx.stroke();
    });

    // D. DRAW SNAP CURSOR
    if (snap.active) {
        const s = toScreen(snap.x, snap.y);
        ctx.strokeStyle = '#FFFF00'; 
        ctx.lineWidth = 2;
        if (snap.type === 'END') ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
        else if (snap.type === 'MID') {
            ctx.beginPath(); ctx.moveTo(s.x, s.y - 8); ctx.lineTo(s.x - 7, s.y + 6); ctx.lineTo(s.x + 7, s.y + 6); ctx.closePath(); ctx.stroke();
        } 
        else if (snap.type === 'PERP') {
            ctx.beginPath(); ctx.moveTo(s.x - 6, s.y + 6); ctx.lineTo(s.x + 6, s.y + 6); ctx.moveTo(s.x, s.y + 6); ctx.lineTo(s.x, s.y - 6); ctx.stroke();
        }
    } else {
        // Normal Pen
        const p = toScreen(pen.x, pen.y);
        ctx.fillStyle = '#d99e33';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // E. MEASURE LINE
    if (measureMode && measureStart) {
        const s = toScreen(measureStart.x, measureStart.y);
        ctx.fillStyle = '#00FF00'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI*2); ctx.fill();
    }

    // F. HUD
    drawNorthArrow(ctx, canvas.width);
    drawScaleBar(ctx, canvas.height, camera.zoom);

    // G. UPDATE DATA
    if(inputX) inputX.value = pen.x.toFixed(2);
    if(inputY) inputY.value = pen.y.toFixed(2);
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    if(offsetDisplay) offsetDisplay.innerText = `${dist.toFixed(2)}'`;
    
    updateLiveArea();
}

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================
function drawGrid(ctx, cam, cx, cy, w, h) {
    const step = 10; const zoom = cam.zoom;
    if (step * zoom < 10) return; 
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.fillStyle = '#444'; ctx.font = '10px monospace'; ctx.textAlign = 'center';

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

function drawScaleBar(ctx, h, zoom) {
    const targetPx = 100; const worldUnits = targetPx / zoom;
    let scaleUnit = 10;
    if (worldUnits > 20) scaleUnit = 20; if (worldUnits > 50) scaleUnit = 50; if (worldUnits > 100) scaleUnit = 100;
    const barWidth = scaleUnit * zoom; const x = 20; const y = h - 30;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 5); ctx.lineTo(x + barWidth, y - 5); ctx.lineTo(x + barWidth, y); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 5, barWidth / 2, 5);
    ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(`Scale: ${scaleUnit} ft`, x, y - 10);
}

function getShapeArea(shape) {
    if (!shape || shape.length < 3) return { sqft: 0, acres: 0 };
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < shape.length - 1; i++) {
        sum1 += shape[i].x * shape[i+1].y;
        sum2 += shape[i].y * shape[i+1].x;
    }
    const first = shape[0]; const last = shape[shape.length - 1];
    if (first.x !== last.x || first.y !== last.y) { sum1 += last.x * first.y; sum2 += last.y * first.x; }
    const sqft = Math.abs(0.5 * (sum1 - sum2));
    return { sqft: sqft, acres: sqft / 43560 };
}

function updateLiveArea() {
    let target = currentStroke.length > 2 ? currentStroke : (history.length > 0 ? history[history.length-1] : null);
    if(target && areaDisplay) {
        const a = getShapeArea(target);
        areaDisplay.innerText = `${a.acres.toFixed(3)} Ac`;
    }
}

// ==========================================
// 5. CONTROLS & EVENTS
// ==========================================

// --- MOUSE WHEEL ZOOM ---
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = camera.zoom + (delta * zoomIntensity * camera.zoom);
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

    if (snap.active) { pen.x = snap.x; pen.y = snap.y; currentStroke.push({ ...pen }); render(); return; }

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

    // Snapping
    let bestDist = Infinity; let bestPt = null; let bestType = "";
    const snapWorldThreshold = 15 / camera.zoom;
    const distSq = (x1, y1, x2, y2) => (x1-x2)**2 + (y1-y2)**2;

    [...history, currentStroke].forEach(stroke => {
        if (stroke.length < 2) return; 
        for (let i = 0; i < stroke.length; i++) {
            const p1 = stroke[i];
            if (snapEnd.checked) {
                const d = distSq(p1.x, p1.y, worldX, worldY);
                if (d < bestDist) { bestDist = d; bestPt = { x: p1.x, y: p1.y }; bestType = "END"; }
            }
            if (i < stroke.length - 1) {
                const p2 = stroke[i+1];
                if (snapMid.checked) {
                    const mx = (p1.x + p2.x) / 2; const my = (p1.y + p2.y) / 2;
                    const d = distSq(mx, my, worldX, worldY);
                    if (d < bestDist) { bestDist = d; bestPt = { x: mx, y: my }; bestType = "MID"; }
                }
                if (snapPerp.checked) {
                    const A = worldX - p1.x; const B = worldY - p1.y;
                    const C = p2.x - p1.x; const D = p2.y - p1.y;
                    const dot = A * C + B * D; const lenSq = C * C + D * D;
                    let param = -1; if (lenSq !== 0) param = dot / lenSq;
                    if (param > 0 && param < 1) { 
                        const xx = p1.x + param * C; const yy = p1.y + param * D;
                        const d = distSq(xx, yy, worldX, worldY);
                        if (d < bestDist) { bestDist = d; bestPt = { x: xx, y: yy }; bestType = "PERP"; }
                    }
                }
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
    if (dx !== 0 || dy !== 0) { pen.x += dx; pen.y += dy; currentStroke.push({ ...pen }); render(); }
    
    if (e.key === ' ') { 
        if (currentStroke.length > 0) history.push([...currentStroke]);
        currentStroke = [{ ...pen }]; render();
    }
});

// --- BUTTON ACTIONS ---
if(btnReset) btnReset.onclick = () => { if(confirm("Start a New Job?")) { history = []; currentStroke = []; pen = {x:0, y:0}; camera = {x:0, y:0, zoom:5}; currentStroke.push({...pen}); render(); }};
if(btnRecenter) btnRecenter.onclick = () => { camera.x = pen.x; camera.y = pen.y; render(); };
if(btnGo) btnGo.onclick = () => { pen.x = parseFloat(inputX.value); pen.y = parseFloat(inputY.value); currentStroke.push({ ...pen }); render(); };
if(btnJump) btnJump.onclick = () => { if (currentStroke.length > 0) history.push([...currentStroke]); pen.x = parseFloat(inputX.value); pen.y = parseFloat(inputY.value); currentStroke = [{ ...pen }]; camera.x = pen.x; camera.y = pen.y; render(); };

if(btnUndo) btnUndo.onclick = () => {
    if (currentStroke.length > 1) { currentStroke.pop(); const prev = currentStroke[currentStroke.length - 1]; pen.x = prev.x; pen.y = prev.y; }
    else if (history.length > 0) { currentStroke = history.pop(); const prev = currentStroke[currentStroke.length - 1]; pen.x = prev.x; pen.y = prev.y; }
    render();
};

if(btnClose) btnClose.onclick = () => {
    if (currentStroke.length < 2) { alert("Draw a shape first!"); return; }
    const startPt = currentStroke[0]; pen.x = startPt.x; pen.y = startPt.y;
    currentStroke.push({ ...pen }); history.push([...currentStroke]); currentStroke = [{ ...pen }];
    inputX.value = pen.x.toFixed(2); inputY.value = pen.y.toFixed(2); render();
};

if(btnTraverse) btnTraverse.onclick = () => {
    const az = parseFloat(inputAz.value) || 0; const dist = parseFloat(inputDist.value) || 0;
    const rad = (az * Math.PI) / 180;
    pen.x += dist * Math.sin(rad); pen.y += dist * Math.cos(rad);
    currentStroke.push({ ...pen }); inputX.value = pen.x.toFixed(2); inputY.value = pen.y.toFixed(2);
    camera.x = pen.x; camera.y = pen.y; render();
};

if(btnTurnLeft) btnTurnLeft.onclick = () => { inputAz.value = (parseFloat(inputAz.value) - 90 + 360) % 360; };
if(btnTurnRight) btnTurnRight.onclick = () => { inputAz.value = (parseFloat(inputAz.value) + 90) % 360; };

if(btnCurve) btnCurve.onclick = () => {
    const R = parseFloat(curveRadius.value); const facing = curveFacing.value; const turn = curveTurn.value;
    let startAngle = 0;
    if (facing === 'N') startAngle = Math.PI / 2; if (facing === 'W') startAngle = Math.PI;
    if (facing === 'S') startAngle = -Math.PI / 2; if (facing === 'E') startAngle = 0;
    const isLeft = (turn === 'Left'); const sweep = isLeft ? (Math.PI / 2) : -(Math.PI / 2);
    const centerAngle = startAngle + (isLeft ? (Math.PI / 2) : -(Math.PI / 2));
    const centerX = pen.x + R * Math.cos(centerAngle); const centerY = pen.y + R * Math.sin(centerAngle);
    const steps = 20; let currentTheta = centerAngle + Math.PI;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps; const angle = currentTheta + (sweep * t);
        pen.x = centerX + R * Math.cos(angle); pen.y = centerY + R * Math.sin(angle);
        currentStroke.push({ ...pen });
    }
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
        row.innerHTML = `<td style="padding:4px; color:#f3e2a0; font-weight:bold;">${p.id}</td><td style="padding:4px; text-align:right;">${p.acres.toFixed(3)}</td><td style="padding:4px; text-align:right; color:#888;">${Math.round(p.sqft)}</td>`;
        parcelListBody.appendChild(row);
    });
};

if(btnZoomIn) btnZoomIn.onclick = () => { camera.zoom *= 1.2; render(); };
if(btnZoomOut) btnZoomOut.onclick = () => { camera.zoom /= 1.2; if (camera.zoom < 0.5) camera.zoom = 0.5; render(); };
if(btnFit) btnFit.onclick = () => {
    if (history.length === 0 && currentStroke.length <= 1) { camera = { x: 0, y: 0, zoom: 5 }; render(); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    [...history, currentStroke].forEach(stroke => stroke.forEach(pt => { if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x; if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y; }));
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
    const width = maxX - minX; const height = maxY - minY;
    const zoomX = canvas.width / (width * 1.2); const zoomY = canvas.height / (height * 1.2);
    camera.x = centerX; camera.y = centerY; camera.zoom = Math.min(zoomX, zoomY, 50); render();
};

if(inputScale) inputScale.onchange = render;

// INITIAL DRAW
resize();

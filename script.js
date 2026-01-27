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

// ==========================================
// 3. RENDER ENGINE (The "HUD")
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
    camera.zoom = parseFloat(inputScale.value) || 5;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // World -> Screen Transform
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // B. DRAW GRID (The Graph Paper)
    drawGrid(ctx, camera, cx, cy, canvas.width, canvas.height);

    // C. DRAW ORIGIN (0,0)
    const origin = toScreen(0,0);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Bold Axis Lines
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

    // E. DRAW PEN
    const p = toScreen(pen.x, pen.y);
    ctx.fillStyle = '#d99e33';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // F. HUD ELEMENTS (Static on Screen)
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
    const step = 10; // Grid lines every 10 feet
    const zoom = cam.zoom;
    
    // Don't draw if grid is too tiny (performance)
    if (step * zoom < 10) return; 

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#444';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Calculate Visible World Bounds
    const worldLeft = cam.x - (cx / zoom);
    const worldRight = cam.x + (cx / zoom);
    const worldTop = cam.y + (cy / zoom);
    const worldBottom = cam.y - (cy / zoom);

    // Snap to nearest 10
    const startX = Math.floor(worldLeft / step) * step;
    const endX = Math.ceil(worldRight / step) * step;
    const startY = Math.floor(worldBottom / step) * step;
    const endY = Math.ceil(worldTop / step) * step;

    ctx.beginPath();
    
    // Vertical Lines (Eastings)
    for (let x = startX; x <= endX; x += step) {
        const screenX = (x - cam.x) * zoom + cx;
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, h);
        // Label
        if (x % 50 === 0) ctx.fillText(x, screenX + 2, h - 5); 
    }

    // Horizontal Lines (Northings)
    for (let y = startY; y <= endY; y += step) {
        const screenY = (cam.y - y) * zoom + cy;
        ctx.moveTo(0, screenY);
        ctx.lineTo(w, screenY);
        // Label
        if (y % 50 === 0) ctx.fillText(y, 5, screenY - 2);
    }
    ctx.stroke();
}

// --- HELPER: NORTH ARROW ---
function drawNorthArrow(ctx, w) {
    const x = w - 40;
    const y = 40;
    
    ctx.strokeStyle = '#f3e2a0';
    ctx.fillStyle = '#f3e2a0';
    ctx.lineWidth = 2;
    
    // Arrow Head
    ctx.beginPath();
    ctx.moveTo(x, y - 20); // Top
    ctx.lineTo(x - 10, y + 10); // Bottom Left
    ctx.lineTo(x, y); // Center notch
    ctx.lineTo(x + 10, y + 10); // Bottom Right
    ctx.closePath();
    ctx.fill();
    
    // "N" Label
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', x, y - 25);
}

// --- HELPER: SCALE BAR ---
function drawScaleBar(ctx, h, zoom) {
    // We want a bar that represents roughly 100px on screen
    // but rounds to a nice surveyor number (10', 20', 50', 100')
    const targetPx = 100;
    const worldUnits = targetPx / zoom;
    
    // Round to nice number
    let scaleUnit = 10;
    if (worldUnits > 20) scaleUnit = 20;
    if (worldUnits > 50) scaleUnit = 50;
    if (worldUnits > 100) scaleUnit = 100;
    
    const barWidth = scaleUnit * zoom;
    const x = 20;
    const y = h - 30;

    // Draw Bar
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 5); // Tick Up
    ctx.lineTo(x + barWidth, y - 5); // Tick Up
    ctx.lineTo(x + barWidth, y);
    ctx.lineTo(x, y); // Bottom Line
    ctx.stroke();

    // Fill alternating blocks (Classic Survey Style)
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y - 5, barWidth / 2, 5);
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Scale: ${scaleUnit} ft`, x, y - 10);
}

// ==========================================
// 4. CONTROLS
// ==========================================

// A. KEYBOARD
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 1; 
    let dx = 0, dy = 0;

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

// B. CURVE TOOL
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

// C. UTILS
btnReset.onclick = () => {
    if(confirm("Start a New Job?")) {
        history = []; currentStroke = [];
        pen = {x:0, y:0}; camera = {x:0, y:0, zoom:5};
        currentStroke.push({...pen});
        render();
    }
};

let isDragging = false;
let lastX=0, lastY=0;
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
});
window.addEventListener('mouseup', () => { isDragging = false; canvas.style.cursor = 'crosshair'; });
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX; const dy = e.clientY - lastY;
    camera.x -= dx / camera.zoom; camera.y += dy / camera.zoom;
    lastX = e.clientX; lastY = e.clientY;
    render();
});

btnGo.onclick = () => {
    pen.x = parseFloat(inputX.value); pen.y = parseFloat(inputY.value);
    currentStroke.push({ ...pen }); render();
};
btnRecenter.onclick = () => { camera.x = pen.x; camera.y = pen.y; render(); };
inputScale.onchange = render;

resize();

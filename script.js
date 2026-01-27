// ==========================================
// 1. SETUP
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');

// Inputs
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputScale = document.getElementById('input-scale');
const offsetDisplay = document.getElementById('offset-display');

// Curve Inputs
const curveRadius = document.getElementById('curve-radius');
const curveFacing = document.getElementById('curve-facing');
const curveTurn = document.getElementById('curve-turn');

// Buttons
const btnGo = document.getElementById('btn-go');
const btnCurve = document.getElementById('btn-curve'); // New
const btnRecenter = document.getElementById('btn-recenter');
const btnReset = document.getElementById('btn-reset'); // New

// ==========================================
// 2. DATA STORAGE
// ==========================================
let history = []; 
let currentStroke = []; 
let pen = { x: 0, y: 0 }; 
let camera = { x: 0, y: 0, zoom: 5 };

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

// Start First Stroke
currentStroke.push({ ...pen });

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    camera.zoom = parseFloat(inputScale.value) || 5;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // Grid & Origin
    const origin = toScreen(0,0);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
    ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Lines
    ctx.strokeStyle = '#f3e2a0';
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

    // Pen
    const p = toScreen(pen.x, pen.y);
    ctx.fillStyle = '#d99e33';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Data Update
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2);
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `${dist.toFixed(2)}'`;
}

// ==========================================
// 4. CONTROLS & TOOLS
// ==========================================

// --- A. NEW JOB (RESET) ---
btnReset.onclick = () => {
    if(confirm("Start a New Job? This wipes the current sketch.")) {
        history = [];
        currentStroke = [];
        pen = {x:0, y:0};
        camera = {x:0, y:0, zoom:5};
        currentStroke.push({...pen});
        render();
    }
};

// --- B. CURVE STAKER ---
btnCurve.onclick = () => {
    const R = parseFloat(curveRadius.value);
    const facing = curveFacing.value; // N, S, E, W
    const turn = curveTurn.value;     // Left, Right

    // 1. Determine Start Angle (in Radians)
    // 0 = East, PI/2 = North, PI = West, -PI/2 = South
    let startAngle = 0;
    if (facing === 'N') startAngle = Math.PI / 2;
    if (facing === 'W') startAngle = Math.PI;
    if (facing === 'S') startAngle = -Math.PI / 2;
    if (facing === 'E') startAngle = 0;

    // 2. Determine Turn Direction
    // Left Turn = Add Angle (+), Right Turn = Subtract Angle (-)
    const isLeft = (turn === 'Left');
    const sweep = isLeft ? (Math.PI / 2) : -(Math.PI / 2); // 90 degree turn

    // 3. Find Center of Circle
    // The center is 90 degrees offset from the current heading
    const centerAngle = startAngle + (isLeft ? (Math.PI / 2) : -(Math.PI / 2));
    const centerX = pen.x + R * Math.cos(centerAngle);
    const centerY = pen.y + R * Math.sin(centerAngle);

    // 4. Generate Points along the arc
    const steps = 20; // Resolution (higher = smoother)
    
    // We need to sweep from the "Entry" angle to the "Exit" angle relative to the center
    // Entry angle relative to center is: centerAngle + PI (backwards from center to pen)
    let currentTheta = centerAngle + Math.PI;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const angle = currentTheta + (sweep * t);
        
        pen.x = centerX + R * Math.cos(angle);
        pen.y = centerY + R * Math.sin(angle);
        
        currentStroke.push({ ...pen });
    }
    
    render();
    canvas.focus(); // Keep keyboard active
};

// --- C. KEYBOARD DRAW ---
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
        pen.x += dx;
        pen.y += dy;
        currentStroke.push({ ...pen });
        render();
    }
    
    if (e.key === ' ') {
        if (currentStroke.length > 0) history.push([...currentStroke]);
        currentStroke = [];
        currentStroke.push({ ...pen });
        render();
    }
});

// --- D. PANNING ---
let isDragging = false;
let lastX=0, lastY=0;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
});
window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    camera.x -= dx / camera.zoom;
    camera.y += dy / camera.zoom;
    lastX = e.clientX; lastY = e.clientY;
    render();
});

// --- E. BUTTONS ---
btnGo.onclick = () => {
    pen.x = parseFloat(inputX.value);
    pen.y = parseFloat(inputY.value);
    currentStroke.push({ ...pen });
    render();
};
btnRecenter.onclick = () => {
    camera.x = pen.x; camera.y = pen.y; // Jump to Pen
    render();
};
inputScale.onchange = render;

// Init
resize();

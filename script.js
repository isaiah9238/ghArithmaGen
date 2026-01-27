// ==========================================
// 1. SETUP
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');

const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputScale = document.getElementById('input-scale');
const offsetDisplay = document.getElementById('offset-display');
const btnGo = document.getElementById('btn-go');
const btnRecenter = document.getElementById('btn-recenter');

// ==========================================
// 2. DATA STORAGE (The "Database")
// ==========================================
let history = []; 
let currentStroke = []; 
let pen = { x: 0, y: 0 }; 

let camera = {
    x: 0, 
    y: 0,
    zoom: 5 // Default Scale
};

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
    // 1. Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. Read Zoom
    camera.zoom = parseFloat(inputScale.value) || 5;

    // 3. Math Helpers
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // 4. Draw Origin & Grid
    const origin = toScreen(0,0);
    
    // Axis Lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
    ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();

    // Origin Dot (Red)
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Lines (History)
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

    // 6. Draw Pen (Cursor)
    const p = toScreen(pen.x, pen.y);
    ctx.fillStyle = '#d99e33';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // 7. Update Displays
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2);
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `${dist.toFixed(2)}'`;
}

// ==========================================
// 4. CONTROLS
// ==========================================

// PANNING (Mouse Drag)
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
    
    // Reverse Pan (Dragging moves camera)
    camera.x -= dx / camera.zoom;
    camera.y += dy / camera.zoom;
    
    lastX = e.clientX; lastY = e.clientY;
    render();
});

// KEYBOARD DRAWING
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 1; // 1 foot per tap
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
    
    // LIFT PEN (Space)
    if (e.key === ' ') {
        if (currentStroke.length > 0) history.push([...currentStroke]);
        currentStroke = [];
        currentStroke.push({ ...pen });
        render();
    }
});

// BUTTONS
btnGo.onclick = () => {
    pen.x = parseFloat(inputX.value);
    pen.y = parseFloat(inputY.value);
    currentStroke.push({ ...pen });
    render();
};

btnRecenter.onclick = () => {
    camera.x = 0; camera.y = 0;
    pen.x = 0; pen.y = 0;
    currentStroke = [{x:0, y:0}];
    render();
};

inputScale.onchange = render;

// Init
resize();

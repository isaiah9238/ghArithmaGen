// ==========================================
// 1. THE DATABASE (Vector Storage)
// ==========================================
let history = []; 
let currentStroke = []; 
let pen = { x: 0, y: 0 }; 

// ==========================================
// 2. THE CAMERA (Viewport)
// ==========================================
let camera = {
    x: 0, // World X at center of screen
    y: 0, // World Y at center of screen
    zoom: 5 // Pixels per Foot (Scale)
};

// ==========================================
// 3. SETUP & HTML LINKS
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputScale = document.getElementById('input-scale');
const btnGo = document.getElementById('btn-go');
const btnRecenter = document.getElementById('btn-recenter');
const offsetDisplay = document.getElementById('offset-display');

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    render(); 
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Start a new stroke at 0,0
currentStroke.push({ ...pen });

// ==========================================
// 4. THE RENDER ENGINE (The "View Port")
// ==========================================
function render() {
    // A. Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // B. Sync Inputs
    inputScale.value = camera.zoom.toFixed(1);
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2); 
    
    // C. Offset Monitor
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `Offset: ${dist.toFixed(2)} ft`;

    // D. Math Helper: World(ft) -> Screen(px)
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy 
    });

    // --- VISUAL AID: THE ORIGIN (0,0) ---
    const origin = toScreen(0,0);
    
    // 1. The Axis Lines (Crosshairs)
    ctx.strokeStyle = '#3d340a'; // Dark Gold
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal Axis
    ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
    // Vertical Axis
    ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();

    // 2. The Red Target Dot (So you can find it)
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // --- DRAWING HISTORY ---
    ctx.strokeStyle = '#f3e2a0'; // Bright Gold Ink
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

    // --- THE PEN (Cursor) ---
    const p = toScreen(pen.x, pen.y);
    ctx.strokeStyle = '#d99e33'; // Orange
    ctx.fillStyle = '#d99e33';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
}

// ==========================================
// 5. CONTROLS: PAN & ZOOM (Mouse)
// ==========================================
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dxPx = e.clientX - lastMouse.x;
    const dyPx = e.clientY - lastMouse.y;
    
    // Move Camera (Pan)
    camera.x -= dxPx / camera.zoom;
    camera.y += dyPx / camera.zoom; 
    
    lastMouse = { x: e.clientX, y: e.clientY };
    render();
});

// Zoom Wheel
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.5;
    if (e.deltaY < 0) camera.zoom += zoomSpeed; 
    else camera.zoom = Math.max(0.5, camera.zoom - zoomSpeed);
    render();
}, { passive: false });

// ==========================================
// 6. CONTROLS: DRAWING (Keyboard)
// ==========================================
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'c', 'C', 'r', 'R', 'b', 'B'];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 1; // 1 Foot per tap
    
    let dx = 0; 
    let dy = 0;

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
    
    // --- LIFT PEN / NEW LINE (Spacebar) ---
    if (e.key === ' ') {
        if (currentStroke.length > 0) {
            history.push([...currentStroke]);
        }
        currentStroke = []; // Empty current stroke
        // Start waiting for next move
        // We don't push a point yet, so no line connects to the old one
        currentStroke.push({ ...pen }); 
        render();
    }
    
    // --- BUTTONS ---
    btnGo.onclick = () => {
        pen.x = parseFloat(inputX.value);
        pen.y = parseFloat(inputY.value);
        currentStroke.push({ ...pen });
        render();
        canvas.focus();
    };
    
    // --- FIX: RECENTER ON 0,0 ---
    btnRecenter.onclick = () => {
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 5; // Reset zoom to default
        render();
        canvas.focus();
    };
});

// Initial Render
render();

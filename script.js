// ==========================================
// 1. THE DATABASE (Vector Storage)
// ==========================================
// We store "strokes" instead of pixels. 
// Each stroke is a list of points: [{x, y}, {x, y}...]
let history = []; 
let currentStroke = []; // The line you are currently drawing

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

// Set canvas to full screen resolution
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    render(); // Redraw immediately on resize
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Init

// STYLING
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// ==========================================
// 4. THE PEN (World Coordinates)
// ==========================================
// The pen exists in "World Space" (Feet), not "Screen Space" (Pixels)
let pen = { x: 0, y: 0 }; 

// Start a new stroke at 0,0
currentStroke.push({ ...pen });

// ==========================================
// 5. THE RENDER ENGINE (The "View Port")
// ==========================================
function render() {
    // A. Clear the "Screen" (Glass)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // B. Sync Inputs
    inputScale.value = camera.zoom;
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2); // Inverted Y logic handled in display
    
    // C. Calculate Offset Monitor
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `Offset: ${dist.toFixed(2)} ft`;

    // D. Math: Convert World(ft) -> Screen(px)
    // ScreenX = (WorldX - CameraX) * Zoom + ScreenCenterX
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const toScreen = (x, y) => ({
        x: (x - camera.x) * camera.zoom + cx,
        y: (camera.y - y) * camera.zoom + cy // Flip Y for surveying (Up is +)
    });

    // E. Draw History (The "Old" Lines)
    ctx.strokeStyle = '#f3e2a0'; // Gold
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Draw all saved strokes
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

    // F. Draw the "Crosshair" (Pen Position)
    const p = toScreen(pen.x, pen.y);
    ctx.strokeStyle = '#d99e33'; // Orange
    ctx.fillStyle = '#d99e33';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Grid Axis Lines (Optional, helps orientation)
    ctx.strokeStyle = '#3d340a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const origin = toScreen(0,0);
    // X Axis
    ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
    // Y Axis
    ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();
}

// ==========================================
// 6. CONTROLS: PAN & ZOOM (Mouse)
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
    
    // Calculate drag distance in pixels
    const dxPx = e.clientX - lastMouse.x;
    const dyPx = e.clientY - lastMouse.y;
    
    // Convert to World Feet (Reverse scale)
    // Dragging RIGHT moves camera LEFT (Standard Pan logic)
    camera.x -= dxPx / camera.zoom;
    camera.y += dyPx / camera.zoom; // Y flip
    
    lastMouse = { x: e.clientX, y: e.clientY };
    render();
});

// Zoom Wheel
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.5;
    if (e.deltaY < 0) camera.zoom += zoomSpeed; // Zoom In
    else camera.zoom = Math.max(1, camera.zoom - zoomSpeed); // Zoom Out
    render();
}, { passive: false });

// ==========================================
// 7. CONTROLS: DRAWING (Keyboard)
// ==========================================
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'c', 'C', 'r', 'R', 'b', 'B'];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 1; // 1 Foot per tap (Logic is strictly feet now)
    const isOrtho = e.shiftKey; 

    let dx = 0; 
    let dy = 0;

    if (e.key === 'ArrowUp') dy = step;
    if (e.key === 'ArrowDown') dy = -step;
    if (e.key === 'ArrowLeft') dx = -step;
    if (e.key === 'ArrowRight') dx = step;

    // Apply Move
    if (dx !== 0 || dy !== 0) {
        if (isOrtho) {
            // Straight Edge Logic would go here, simpler for now to just move
        }
        pen.x += dx;
        pen.y += dy;
        currentStroke.push({ ...pen }); // Save point
        
        // Auto-Follow: If pen goes off screen, move camera?
        // For now, let's keep camera manual so it feels like CAD
        render();
    }
    
    // --- RESET (Spacebar) ---
    if (e.key === ' ') {
        // "Lift Pen" - Start a new separate line
        if (currentStroke.length > 1) {
            history.push([...currentStroke]);
        }
        currentStroke = [{...pen}]; // Start new line at current spot
        // If you want to CLEAR ALL, uncomment these:
        // history = [];
        // currentStroke = [{x:0, y:0}];
        // pen = {x:0, y:0};
        render();
    }
    
    // --- Manual Coordinates (GO Button) ---
    btnGo.onclick = () => {
        pen.x = parseFloat(inputX.value);
        pen.y = parseFloat(inputY.value);
        currentStroke.push({ ...pen });
        render();
        canvas.focus();
    };
    
    // --- Recenter Button ---
    btnRecenter.onclick = () => {
        camera.x = pen.x; // Center view on the PEN, not 0,0
        camera.y = pen.y;
        render();
        canvas.focus();
    };
});

// Initial Render
render();

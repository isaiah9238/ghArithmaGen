// ==========================================
// 1. DUAL CANVASES SETUP
// ==========================================
const siteCanvas = document.getElementById('canvasSite');
const workCanvas = document.getElementById('canvasWork');
const ctxSite = siteCanvas.getContext('2d');
const ctxWork = workCanvas.getContext('2d');

const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const btnGo = document.getElementById('btn-go');
const btnRecenter = document.getElementById('btn-recenter');
const offsetDisplay = document.getElementById('offset-display');

// ==========================================
// 2. THE DATABASE (Vector Storage)
// ==========================================
let history = []; 
let currentStroke = []; 
let pen = { x: 0, y: 0 }; 

// ==========================================
// 3. THE CAMERAS (Two Viewports)
// ==========================================
// We share X/Y (Center) but have different ZOOM levels
let camera = {
    x: 0, // World X at center
    y: 0  // World Y at center
};

// CONSTANT ZOOM SETTINGS (Locked)
const ZOOM_SITE = 2;  // Viewport 1 Scale
const ZOOM_WORK = 10; // Viewport 2 Scale

// ==========================================
// 4. RESIZE & RENDER LOOP
// ==========================================
function resize() {
    siteCanvas.width = siteCanvas.offsetWidth;
    siteCanvas.height = siteCanvas.offsetHeight;
    workCanvas.width = workCanvas.offsetWidth;
    workCanvas.height = workCanvas.offsetHeight;
    renderAll();
}
window.addEventListener('resize', resize);
// Setup styling
[ctxSite, ctxWork].forEach(ctx => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
});

// Start Stroke
currentStroke.push({ ...pen });

// ==========================================
// 5. THE DUAL RENDERER
// ==========================================
function renderAll() {
    // Render Left Screen (Site Plan)
    renderView(ctxSite, siteCanvas, ZOOM_SITE);
    // Render Right Screen (Detail Work)
    renderView(ctxWork, workCanvas, ZOOM_WORK);
    
    // Update Sidebar Data
    inputX.value = pen.x.toFixed(2);
    inputY.value = pen.y.toFixed(2);
    const dist = Math.sqrt(pen.x**2 + pen.y**2);
    offsetDisplay.innerText = `${dist.toFixed(2)} ft`;
}

// The Core Drawing Function (Reused for both screens)
function renderView(ctx, canvas, zoom) {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Math Helper: World -> Screen
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Transform Function
    const toScreen = (x, y) => ({
        x: (x - camera.x) * zoom + cx,
        y: (camera.y - y) * zoom + cy 
    });

    // A. Draw Grid / Origin
    const origin = toScreen(0,0);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Axis Lines
    ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y);
    ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();

    // Red Origin Dot
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // B. Draw Ink History
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

    // C. Draw Pen (Cursor)
    const p = toScreen(pen.x, pen.y);
    ctx.fillStyle = '#d99e33';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // D. Selection Ring (Visual Aid)
    ctx.strokeStyle = 'rgba(217, 158, 51, 0.5)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.stroke();
}

// ==========================================
// 6. CONTROLS (Applied to BOTH screens)
// ==========================================

// PANNING (Drag EITHER screen to move BOTH cameras)
function setupPan(canvas) {
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
        
        // Move Camera (Speed depends on which screen you drag!)
        // If dragging Site Plan (Zoom 2), moves fast.
        // If dragging Work Zone (Zoom 10), moves slow.
        const currentZoom = (canvas === siteCanvas) ? ZOOM_SITE : ZOOM_WORK;
        
        camera.x -= dx / currentZoom;
        camera.y += dy / currentZoom;
        
        lastX = e.clientX; lastY = e.clientY;
        renderAll();
    });
}
// Activate Panning on both
setupPan(siteCanvas);
setupPan(workCanvas);

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
        renderAll();
    }
    
    // LIFT PEN (Space)
    if (e.key === ' ') {
        if (currentStroke.length > 0) history.push([...currentStroke]);
        currentStroke = [];
        currentStroke.push({ ...pen });
        renderAll();
    }
});

// BUTTONS
btnGo.onclick = () => {
    pen.x = parseFloat(inputX.value);
    pen.y = parseFloat(inputY.value);
    currentStroke.push({ ...pen });
    renderAll();
};

btnRecenter.onclick = () => {
    camera.x = 0; camera.y = 0;
    pen.x = 0; pen.y = 0;
    currentStroke = [{x:0, y:0}];
    renderAll();
};

// Init
resize();

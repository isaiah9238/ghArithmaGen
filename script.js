// ==========================================
// 1. SETUP & REALITY LINK
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputScale = document.getElementById('input-scale'); // NEW: Zoom Control
const btnGo = document.getElementById('btn-go');
const btnRecenter = document.getElementById('btn-recenter'); // NEW: Reset Button
const offsetDisplay = document.getElementById('offset-display');

// FIX: Matches drawing resolution to your actual screen size
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// STYLING: The "Golden Earth" Pen
ctx.strokeStyle = '#f3e2a0'; 
ctx.lineWidth = 2;

// ==========================================
// 2. THE ORIGIN (Surveyor's 0,0)
// ==========================================
let startX = canvas.width / 2;
let startY = canvas.height / 2;
let x = startX;
let y = startY;

// Initialize
ctx.beginPath();
ctx.moveTo(x, y);

// ==========================================
// 3. THE MATH ENGINE
// ==========================================
function getScale() {
    // defaults to 5 pixels per foot if box is empty
    return parseFloat(inputScale.value) || 5; 
}

function updateDisplay(curX, curY) {
    const currentScale = getScale();

    // 1. Calculate Real World Coordinates
    const displayX = ((curX - startX) / currentScale).toFixed(2);
    const displayY = ((startY - curY) / currentScale).toFixed(2); 
    
    // 2. Update Input Boxes
    inputX.value = displayX;
    inputY.value = displayY;

    // 3. Offset Monitor
    const dx = curX - startX;
    const dy = curY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy); 
    offsetDisplay.innerText = `Offset: ${(distance / currentScale).toFixed(2)} ft`;
}

// ==========================================
// 4. MANUAL INPUTS & ZOOM
// ==========================================
// "GO" Button Logic
btnGo.addEventListener('click', () => {
    const currentScale = getScale();
    const targetX = parseFloat(inputX.value);
    const targetY = parseFloat(inputY.value);

    // Convert Real World Feet back to Pixels
    x = startX + (targetX * currentScale);
    y = startY - (targetY * currentScale);

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    canvas.focus(); 
});

// "Recenter" Button Logic
btnRecenter.addEventListener('click', () => {
    // Wipes screen and puts 0,0 back in the middle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    startX = canvas.width / 2;
    startY = canvas.height / 2;
    x = startX;
    y = startY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    updateDisplay(x, y);
    canvas.focus();
});

// Redraw if Zoom Changes (Optional: clear screen to prevent distortion)
inputScale.addEventListener('change', () => {
    // For now, we just update the display math, we don't redraw the lines
    updateDisplay(x, y);
    canvas.focus();
});

// ==========================================
// 5. KEYBOARD CONTROLS
// ==========================================
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'c', 'C', 'r', 'R', 'b', 'B'];
    if (keys.includes(e.key)) e.preventDefault(); 

    const currentScale = getScale();
    const step = currentScale; // Move 1 foot per tap (scaled)
    const isOrtho = e.shiftKey; 

    // --- MOVEMENT ENGINE ---
    if (e.key === 'ArrowUp') {
        y -= step;
        if (isOrtho) x = x; 
    }
    if (e.key === 'ArrowDown') {
        y += step;
        if (isOrtho) x = x; 
    }
    if (e.key === 'ArrowLeft') {
        x -= step;
        if (isOrtho) y = y; 
    }
    if (e.key === 'ArrowRight') {
        x += step;
        if (isOrtho) y = y; 
    }
    
    // --- RESET (Spacebar) ---
    if (e.key === ' ') {
        btnRecenter.click(); // Uses the same logic as the button
        return;
    }

    // --- SUMMONERS ---
    if (e.key.toLowerCase() === 'c') {
        ctx.beginPath();
        // Circle radius = 5 feet * scale
        ctx.arc(x, y, 5 * currentScale, 0, Math.PI * 2); 
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y);
        return;
    }

    if (e.key.toLowerCase() === 'r') {
        // 40x20 box
        let w = 40 * currentScale;
        let h = 20 * currentScale;
        ctx.strokeRect(x - (w/2), y - (h/2), w, h);
        ctx.beginPath(); ctx.moveTo(x, y);
        return;
    }

    if (e.key.toLowerCase() === 'b') {
        let w = 40 * currentScale;
        let h = 20 * currentScale;
        let r = 2 * currentScale;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - (w/2), y - (h/2), w, h, r);
            ctx.stroke();
        } else {
            ctx.strokeRect(x - (w/2), y - (h/2), w, h);
        }
        ctx.beginPath(); ctx.moveTo(x, y);
        return;
    }

    // Draw the line
    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
});

// ==========================================
// 6. TOUCH CONTROLS
// ==========================================
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    x = touch.clientX - rect.left;
    y = touch.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    x = touch.clientX - rect.left;
    y = touch.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    e.preventDefault();
}, { passive: false });

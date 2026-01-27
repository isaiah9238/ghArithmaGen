// ==========================================
// 1. SETUP & REALITY LINK
// ==========================================
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const btnGo = document.getElementById('btn-go');
const offsetDisplay = document.getElementById('offset-display');

// FIX: Matches drawing resolution to your actual screen size
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// STYLING: The "Golden Earth" Pen
ctx.strokeStyle = '#f3e2a0'; 
ctx.lineWidth = 2;

// PHOTOGRAMMETRY SCALE: 10 pixels = 1.00 foot
const scale = 10; 

// ==========================================
// 2. THE ORIGIN (Surveyor's 0,0)
// ==========================================
let startX = canvas.width / 2;
let startY = canvas.height / 2;
let x = startX;
let y = startY;

// Initialize the pen at the center
ctx.beginPath();
ctx.moveTo(x, y);

// ==========================================
// 3. THE MATH ENGINE
// ==========================================
function updateDisplay(curX, curY) {
    // 1. Calculate Real World Coordinates
    const displayX = ((curX - startX) / scale).toFixed(2);
    const displayY = ((startY - curY) / scale).toFixed(2); // Flips Y so UP is positive
    
    // 2. Update Input Boxes (Active Monitoring)
    inputX.value = displayX;
    inputY.value = displayY;

    // 3. Offset Monitor: Pythagorean Theorem (Distance from Start)
    const dx = curX - startX;
    const dy = curY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy); 
    offsetDisplay.innerText = `Offset: ${(distance / scale).toFixed(2)} ft`;
}

// ==========================================
// 4. MANUAL INPUT LISTENER (The "GO" Button)
// ==========================================
btnGo.addEventListener('click', () => {
    // Read the numbers from the boxes
    const targetX = parseFloat(inputX.value);
    const targetY = parseFloat(inputY.value);

    // Convert Real World Feet back to Pixels
    // X = start + (feet * 10)
    // Y = start - (feet * 10)  <-- Y is inverted!
    x = startX + (targetX * scale);
    y = startY - (targetY * scale);

    // Move the pen there
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Resync displays just to be safe
    updateDisplay(x, y);
    
    // Focus back on canvas so arrow keys work immediately
    canvas.focus(); 
});

// ==========================================
// 5. KEYBOARD CONTROLS
// ==========================================
window.addEventListener('keydown', (e) => {
    // Prevent browser scrolling when using these keys
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'c', 'C', 'r', 'R', 'b', 'B'];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 10; // Move 1 foot per tap
    const isOrtho = e.shiftKey; // STRAIGHT EDGE: Hold Shift to lock axis!

    // --- MOVEMENT ENGINE ---
    if (e.key === 'ArrowUp' && y > 10) {
        y -= step;
        if (isOrtho) x = x; 
    }
    if (e.key === 'ArrowDown' && y < canvas.height - 10) {
        y += step;
        if (isOrtho) x = x; 
    }
    if (e.key === 'ArrowLeft' && x > 10) {
        x -= step;
        if (isOrtho) y = y; 
    }
    if (e.key === 'ArrowRight' && x < canvas.width - 10) {
        x += step;
        if (isOrtho) y = y; 
    }
    
    // --- RESET (Spacebar) ---
    if (e.key === ' ') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        x = startX; y = startY;
        ctx.beginPath(); ctx.moveTo(x, y);
        updateDisplay(x, y);
        return;
    }

    // --- THE SUMMONERS (Geometry Tools) ---
    
    // 1. Circle Stake (Key: C)
    if (e.key.toLowerCase() === 'c') {
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2); 
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y);
        return;
    }

    // 2. Sharp Rectangle (Key: R)
    if (e.key.toLowerCase() === 'r') {
        ctx.strokeRect(x - 200, y - 100, 400, 200);
        ctx.beginPath(); ctx.moveTo(x, y);
        return;
    }

    // 3. Rounded Rectangle (Key: B)
    if (e.key.toLowerCase() === 'b') {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - 200, y - 100, 400, 200, 20);
            ctx.stroke();
        } else {
            ctx.strokeRect(x - 200, y - 100, 400, 200);
        }
        ctx.beginPath(); ctx.moveTo(x, y);
        return;
    }

    // Draw the line for movement
    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
});

// ==========================================
// 6. TOUCH CONTROLS (Mobile/Tablet)
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
    
    // Touch Boundaries
    if (x < 0) x = 0; if (x > canvas.width) x = canvas.width;
    if (y < 0) y = 0; if (y > canvas.height) y = canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    e.preventDefault();
}, { passive: false });

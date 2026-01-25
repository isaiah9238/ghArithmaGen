const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const posDisplay = document.getElementById('pos-display');

// Initialize size and pen color
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
ctx.strokeStyle = '#f3e2a0';
ctx.lineWidth = 2;

let x, y;
let isDrawing = false;

// Function to update the tracker display
function updateDisplay(curX, curY) {
    posDisplay.innerText = `X: ${(curX/100).toFixed(2)}, Y: ${((canvas.height-curY)/100).toFixed(2)}`;
}

// TOUCH EVENTS for mobile
canvas.addEventListener('touchstart', (e) => {
    isDrawing = true;
    const touch = e.touches[0];
    x = touch.clientX - canvas.offsetLeft;
    y = touch.clientY - canvas.offsetTop;
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault(); // Prevents scrolling while drawing
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!isDrawing) return;
    const touch = e.touches[0];
    x = touch.clientX - canvas.offsetLeft;
    y = touch.clientY - canvas.offsetTop;
    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => isDrawing = false);

// KEEP KEYBOARD EVENTS for desktop
window.addEventListener('keydown', (e) => {
    // ... (Your existing arrow key logic stays here)
});
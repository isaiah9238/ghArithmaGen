const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const posDisplay = document.getElementById('pos-display');

// Initialize canvas size
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// "Golden Earth" Pen Style
ctx.strokeStyle = '#f3e2a0';
ctx.lineWidth = 2;

let x = canvas.width / 2;
let y = canvas.height / 2;
let isDrawing = false;

// This makes the tracker show Y as "Up" from the bottom, not "Down" from the top
function updateDisplay(curX, curY) {
    const surveyX = (curX / 100).toFixed(2);
    // Subtracting from canvas.height flips the math so the bottom is 0
    const surveyY = ((canvas.height - curY) / 100).toFixed(2); 
    
    posDisplay.innerText = `X: ${surveyX}, Y: ${surveyY}`;
}

// THE ENGINE: KEYBOARD LOGIC
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); // STOPS THE JUMPING

    const step = 10;
    if (e.key === 'ArrowUp') y -= step;
    if (e.key === 'ArrowDown') y += step;
    if (e.key === 'ArrowLeft') x -= step;
    if (e.key === 'ArrowRight') x += step;
    
    if (e.key === ' ') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
});

// THE ENGINE: TOUCH LOGIC
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    x = touch.clientX - canvas.offsetLeft;
    y = touch.clientY - canvas.offsetTop;
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    x = touch.clientX - canvas.offsetLeft;
    y = touch.clientY - canvas.offsetTop;
    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    e.preventDefault();
}, { passive: false });
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const posDisplay = document.getElementById('pos-display');
const offsetDisplay = document.querySelector('.card:nth-child(2) p'); // Targets Offset Monitor

// 1. Setup Canvas
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
ctx.strokeStyle = '#f3e2a0'; 
ctx.lineWidth = 2;

// 2. Fix the Starting Point: Start at Center (not 0,0)
let startX = canvas.width / 2;
let startY = canvas.height / 2;
let x = startX;
let y = startY;

ctx.beginPath();
ctx.moveTo(x, y);

function updateDisplay(curX, curY) {
    // Math to show coordinates relative to the center
    const displayX = ((curX - startX) / 10).toFixed(2);
    const displayY = ((startY - curY) / 10).toFixed(2); // Y is now UP
    posDisplay.innerText = `X: ${displayX}, Y: ${displayY}`;

    // 3. Offset Monitor: Calculate distance from start using Pythagorean theorem
    const dist = Math.sqrt(Math.pow(curX - startX, 2) + Math.pow(curY - startY, 2));
    offsetDisplay.innerText = `Offset: ${(dist / 10).toFixed(2)} ft`;
}

// 4. Increase Step Size for "Bold" movement
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 5; // Increased from 0.05 to 5 for visible movement
    
    if (e.key === 'ArrowUp') y -= step;
    if (e.key === 'ArrowDown') y += step;
    if (e.key === 'ArrowLeft') x -= step;
    if (e.key === 'ArrowRight') x += step;
    
    if (e.key === ' ') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        x = startX;
        y = startY;
        ctx.beginPath();
        ctx.moveTo(x, y);
        updateDisplay(x, y);
        return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
});
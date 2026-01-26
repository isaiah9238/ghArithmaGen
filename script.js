const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const posDisplay = document.getElementById('pos-display');
const offsetDisplay = document.querySelector('.card:nth-child(2) p');

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
ctx.strokeStyle = '#f3e2a0'; 
ctx.lineWidth = 2;

// 2. Origin & Safety Reset
let startX = canvas.width / 2;
let startY = canvas.height / 2;
let x = startX;
let y = startY;

ctx.beginPath();
ctx.moveTo(x, y);

// 3. The Surveyor Math Engine
function updateDisplay(curX, curY) {
    const displayX = ((curX - startX) / 10).toFixed(2);
    const displayY = ((startY - curY) / 10).toFixed(2);
    posDisplay.innerText = `X: ${displayX}, Y: ${displayY}`;

    const dist = Math.sqrt(Math.pow(curX - startX, 2) + Math.pow(curY - startY, 2));
    offsetDisplay.innerText = `Offset: ${(dist / 10).toFixed(2)} ft`;
}

// 4. Desktop Controls (Arrow Keys) with Boundaries
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 10; 
    
    if (e.key === 'ArrowUp' && y > 0) y -= step;
    if (e.key === 'ArrowDown' && y < canvas.height) y += step;
    if (e.key === 'ArrowLeft' && x > 0) x -= step;
    if (e.key === 'ArrowRight' && x < canvas.width) x += step;
    
    if (e.key === ' ') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        x = startX; y = startY;
        ctx.beginPath(); ctx.moveTo(x, y);
        updateDisplay(x, y);
        return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
});

// 5. Mobile/Touch Controls
canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    x = touch.clientX - canvas.offsetLeft;
    y = touch.clientY - canvas.offsetTop;
    
    // Boundary check for touch
    if (x < 0) x = 0; if (x > canvas.width) x = canvas.width;
    if (y < 0) y = 0; if (y > canvas.height) y = canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    e.preventDefault();
}, { passive: false });

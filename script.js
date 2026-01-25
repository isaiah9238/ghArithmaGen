const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const posDisplay = document.getElementById('pos-display');

// Initialize size
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

let x = canvas.width / 2;
let y = canvas.height / 2;

// Antique Cream Pen Color
ctx.strokeStyle = '#f3e2a0';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(x, y);

window.addEventListener('keydown', (e) => {
    const step = 5;
    if(e.key === 'ArrowUp') y -= step;
    if(e.key === 'ArrowDown') y += step;
    if(e.key === 'ArrowLeft') x -= step;
    if(e.key === 'ArrowRight') x += step;
    if(e.key === ' ') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Update Tracker
    posDisplay.innerText = `X: ${(x/100).toFixed(2)}, Y: ${((canvas.height-y)/100).toFixed(2)}`;
});
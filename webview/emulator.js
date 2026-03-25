const canvas = document.getElementById('nes-canvas');
const ctx = canvas.getContext('2d');

// Improved Latency-Stable Audio
let audioContext;
let scriptProcessor;
const AUDIO_BUFFER_SIZE = 1024; // Smaller = less latency
const sampleBuffer = new Float32Array(44100 * 2); // 1 second of buffer
let bufferHead = 0;
let bufferTail = 0;
let audioInitialized = false;

function initAudio() {
    if (audioInitialized) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create script processor to pull samples from our buffer
    scriptProcessor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 0, 2);
    scriptProcessor.onaudioprocess = function(e) {
        const left = e.outputBuffer.getChannelData(0);
        const right = e.outputBuffer.getChannelData(1);
        
        let available = (bufferHead - bufferTail + sampleBuffer.length) % sampleBuffer.length;
        
        // Wait for 2048 samples (~46ms) — balance between lag and stability
        if (available < 2048) {
            left.fill(0);
            right.fill(0);
            return;
        }

        for (let i = 0; i < AUDIO_BUFFER_SIZE; i++) {
            left[i] = sampleBuffer[bufferTail];
            right[i] = sampleBuffer[bufferTail + 1];
            bufferTail = (bufferTail + 2) % sampleBuffer.length;
        }
    };
    scriptProcessor.connect(audioContext.destination);
    audioInitialized = true;
}

// State Persistence
function saveState() {
    try {
        const state = nes.toJSON();
        localStorage.setItem('mario_save_state', JSON.stringify(state));
        showToast('Game Saved! ✅');
    } catch (e) {
        console.error('Save failed', e);
    }
}

function loadState() {
    try {
        const stateStr = localStorage.getItem('mario_save_state');
        if (stateStr) {
            const state = JSON.parse(stateStr);
            nes.fromJSON(state);
            showToast('Game Loaded! 📂');
        } else {
            showToast('No Save Found! ❌');
        }
    } catch (e) {
        console.error('Load failed', e);
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: #333; color: #fff; padding: 10px 20px; border-radius: 5px;
        z-index: 2000; font-family: 'Press Start 2P', cursive; font-size: 10px;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Button Listeners
document.getElementById('save-btn').onclick = saveState;
document.getElementById('load-btn').onclick = loadState;

const imageData = ctx.createImageData(256, 240);
const buf = new Uint32Array(imageData.data.buffer);

let nes = new jsnes.NES({
    onFrame: function(frameBuffer) {
        for (let i = 0; i < 256 * 240; i++) {
            // JSNES provides pixels as 0xBBGGRR. Canvas (LE) wants 0xAABBGGRR.
            buf[i] = 0xFF000000 | frameBuffer[i];
        }
        ctx.putImageData(imageData, 0, 0);
    },
    onStatusUpdate: console.log,
    onAudioSample: function(left, right) {
        if (!audioInitialized) return;
        const nextHead = (bufferHead + 2) % sampleBuffer.length;
        // Prevent buffer overflow: if nearly full, drop oldest sample (no crackle)
        if (nextHead === bufferTail) {
            bufferTail = (bufferTail + 2) % sampleBuffer.length;
        }
        sampleBuffer[bufferHead] = left;
        sampleBuffer[bufferHead + 1] = right;
        bufferHead = nextHead;
    }
});

// Controls
const keyMap = {
    37: jsnes.Controller.BUTTON_LEFT,  65: jsnes.Controller.BUTTON_LEFT,
    39: jsnes.Controller.BUTTON_RIGHT, 68: jsnes.Controller.BUTTON_RIGHT,
    40: jsnes.Controller.BUTTON_DOWN,  83: jsnes.Controller.BUTTON_DOWN,
    87: jsnes.Controller.BUTTON_A,     38: jsnes.Controller.BUTTON_A,
    69: jsnes.Controller.BUTTON_B,     
    13: jsnes.Controller.BUTTON_START, 
    16: jsnes.Controller.BUTTON_SELECT 
};

document.addEventListener('keydown', (e) => {
    initAudio(); 
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    if (e.keyCode === 80) { saveState(); return; }
    if (e.keyCode === 76) { loadState(); return; }
    if (keyMap[e.keyCode] !== undefined) {
        nes.buttonDown(1, keyMap[e.keyCode]);
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (keyMap[e.keyCode] !== undefined) {
        nes.buttonUp(1, keyMap[e.keyCode]);
        e.preventDefault();
    }
});

// ROM Loading via Message
window.addEventListener('message', event => {
    if (event.data.command === 'loadROM') {
        const romData = atob(event.data.data);
        nes.loadROM(romData);
        document.getElementById('rom-input-section').style.display = 'none';
        canvas.focus();
        startEmulation();
    }
});

function startEmulation() {
    function step() {
        nes.frame();
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

canvas.addEventListener('mousedown', () => {
    initAudio();
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
});

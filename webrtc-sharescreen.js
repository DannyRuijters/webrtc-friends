// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

let screenShareStream = null;
let screenShareCanvasId = null;

// Share screen overlay window functions
async function openShareOverlay() {
    document.getElementById('shareOverlay').classList.add('active');
    document.getElementById('screenShareStatus').textContent = '';
    await populateScreenPreviews();
}

function closeShareOverlay() {
    document.getElementById('shareOverlay').classList.remove('active');
    // Clean up any preview streams
    cleanupScreenPreviews();
}

function cleanupScreenPreviews() {
    const grid = document.getElementById('screenPreviewGrid');
    const videos = grid.querySelectorAll('video');
    videos.forEach(video => {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
    });
    grid.innerHTML = '';
}

async function populateScreenPreviews() {
    const grid = document.getElementById('screenPreviewGrid');
    const status = document.getElementById('screenShareStatus');
    
    // Clear previous previews
    cleanupScreenPreviews();
    
    // Show instruction to user
    status.textContent = 'Click "Share Screen" to select a screen or window...';
    
    // Create a button to trigger screen selection
    const selectButton = document.createElement('button');
    selectButton.className = 'screen-select-button';
    selectButton.innerHTML = '<span class="screen-icon">🖥️</span><br>Select Screen or Window';
    selectButton.onclick = async () => {
        try {
            status.textContent = 'Requesting screen access...';
            
            // Request screen capture - this will show browser's native picker
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });
            
            // User selected a screen, now show preview and start sharing
            await startScreenShare(stream);
            closeShareOverlay();
            
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                status.textContent = 'Screen sharing was cancelled.';
            } else {
                console.error('Error accessing screen:', error);
                status.textContent = 'Error: ' + error.message;
            }
        }
    };
    
    grid.appendChild(selectButton);
    
    // If already sharing, show stop button
    if (screenShareStream) {
        const stopButton = document.createElement('button');
        stopButton.className = 'screen-select-button screen-stop-button';
        stopButton.innerHTML = '<span class="screen-icon">⏹️</span><br>Stop Sharing';
        stopButton.onclick = () => {
            stopScreenShare();
            closeShareOverlay();
        };
        grid.appendChild(stopButton);
        status.textContent = 'Currently sharing a screen.';
    }
}

async function startScreenShare(stream) {
    try {
        // Stop any existing screen share
        if (screenShareStream) {
            stopScreenShare();
        }
        
        screenShareStream = stream;
        screenShareCanvasId = 'screenShare-' + Date.now();
        
        // Create canvas for screen share
        if (!canvases[screenShareCanvasId]) {
            canvases[screenShareCanvasId] = createVideoCanvas(screenShareCanvasId, 'Screen Share', false);
        }
        
        const screenCanvas = canvases[screenShareCanvasId].canvas;
        initCanvasGL(screenCanvas);
        initVideoTexture(screenCanvas, stream, screenShareCanvasId);
        
        // Handle stream ending (user clicks browser's stop sharing button)
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            console.log('Screen sharing stopped by user');
            stopScreenShare();
        });
        
        console.log('Screen sharing started');
        
    } catch (error) {
        console.error('Error starting screen share:', error);
        throw error;
    }
}

function stopScreenShare() {
    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
        screenShareStream = null;
    }
    
    if (screenShareCanvasId && canvases[screenShareCanvasId]) {
        removeVideoCanvas(screenShareCanvasId);
        screenShareCanvasId = null;
    }
    
    console.log('Screen sharing stopped');
}

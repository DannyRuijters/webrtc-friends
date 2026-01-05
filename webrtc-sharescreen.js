// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

let screenShareStream = null;
let screenShareCanvasId = null;

async function toggleScreenShare() {
    if (screenShareStream) {
        stopScreenShare();
    } else {
        await startScreenShare();
    }
}

async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: false
        });
        
        screenShareStream = stream;
        screenShareCanvasId = 'screenShare-' + Date.now();
        
        // Create canvas for screen share
        if (!canvases[screenShareCanvasId]) {
            canvases[screenShareCanvasId] = createVideoCanvas(screenShareCanvasId, 'Screen Share', false);
        }
        
        const screenCanvas = canvases[screenShareCanvasId].canvas;
        initCanvasGL(screenCanvas);
        initVideoTexture(screenCanvas, stream, screenShareCanvasId);
        
        // Update button state
        updateShareButton(true);
        
        // Handle stream ending (user clicks browser's stop sharing button)
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            console.log('Screen sharing stopped by user');
            stopScreenShare();
        });
        
        console.log('Screen sharing started');
        
    } catch (error) {
        if (error.name !== 'NotAllowedError') {
            console.error('Error starting screen share:', error);
        }
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
    
    // Update button state
    updateShareButton(false);
    
    console.log('Screen sharing stopped');
}

function updateShareButton(isSharing) {
    const btn = document.getElementById('shareBtn');
    if (btn) {
        btn.textContent = isSharing ? 'Stop Share' : 'Share';
        btn.classList.toggle('sharing', isSharing);
    }
}

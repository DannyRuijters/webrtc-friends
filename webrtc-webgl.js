// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

function setupWebGLContextHandlers(canvas, canvasId) {
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.warn(`WebGL context lost for ${canvasId}`);
        if (canvas.intervalID) clearInterval(canvas.intervalID);
        canvas.contextLost = true;
        canvas.gl.myTexture = null; // Invalidate texture
        canvas.gl = null;
    }, false);
    
    canvas.addEventListener('webglcontextrestored', () => {
        console.log(`WebGL context restored for ${canvasId}`);
        
        try {
            initCanvasGL(canvas);
            canvas.contextLost = false;
            if (!canvas.videoElement?.srcObject) return;
            
            const videoElement = canvas.videoElement;
            canvas.intervalID = setInterval(() => {
                if (!canvas.contextLost && canvas.gl) {
                    handleLoadedImage(canvas, videoElement, videoElement.videoWidth, videoElement.videoHeight);
                }
            }, 15);
        } catch (error) {
            console.error(`Error restoring WebGL context for ${canvasId}:`, error);
        }
    }, false);
}

function initVideoTexture(canvas, stream, canvasId) {
    let intervalID;
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = (canvasId === 'local'); // Only mute local video
    videoElement.srcObject = stream;
    
    videoElement.addEventListener("canplaythrough", () => {
        videoElement.play().catch(err => { 
            console.error("Error playing video:", err); 
        });
        if (intervalID) clearInterval(intervalID);
        intervalID = setInterval(() => {
            // Skip rendering if WebGL context is lost
            if (!canvas.contextLost && canvas.gl && typeof handleLoadedImage === 'function') {
                try {
                    handleLoadedImage(canvas, videoElement, videoElement.videoWidth, videoElement.videoHeight);
                } catch (error) {
                    // If error occurs during rendering, it might be context loss
                    if (!canvas.contextLost) {
                        console.error(`Error rendering ${canvasId}:`, error);
                    }
                }
            }
        }, 15);
        canvas.intervalID = intervalID;
    });
    
    videoElement.addEventListener("ended", () => { 
        if (intervalID) clearInterval(intervalID); 
    });
    
    // Store reference for cleanup and restoration
    canvas.videoElement = videoElement;
}

async function startLocalVideo() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("getUserMedia is not supported in this browser");
        return;
    }
    
    try {
        // Get selected device IDs from dropdowns if available
        const audioSelect = document.getElementById('audioSource');
        const videoSelect = document.getElementById('videoSource');
        
        const constraints = {
            video: { width: videoWidth, height: videoHeight },
            audio: true
        };
        
        // Apply specific device IDs if selected
        if (videoSelect && videoSelect.value) {
            constraints.video = {
                deviceId: { exact: videoSelect.value },
                width: videoWidth,
                height: videoHeight
            };
        }
        
        if (audioSelect && audioSelect.value) {
            constraints.audio = {
                deviceId: { exact: audioSelect.value }
            };
        }
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Create local canvas dynamically if it doesn't exist
        if (!canvases['localVideo']) {
            canvases['localVideo'] = createVideoCanvas('localVideo', 'You', true);
        }
        
        const localCanvas = canvases['localVideo'].canvas;
        initCanvasGL(localCanvas);
        initVideoTexture(localCanvas, localStream, 'local');        
        console.log('Local camera started');
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
}

function webGLStart() {
    addEventHandlers();
    loadCredentialsFromCookies();
    startLocalVideo();
    
    // Add input validation for connection button
    const userName = document.getElementById('userName');
    const roomId = document.getElementById('roomId');
    if (userName && roomId) {
        userName.addEventListener('input', validateConnectionButton);
        roomId.addEventListener('input', validateConnectionButton);
        // Initial validation
        validateConnectionButton();
    }
    
    // Add chat resize functionality
    initChatResize();
    console.log("Ready. Connect to signaling server first.");
}

window.addEventListener('DOMContentLoaded', webGLStart);

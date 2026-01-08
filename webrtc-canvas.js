// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

function initCanvas2D(canvas) {
    let ctx;
    try {
        ctx = canvas.getContext("2d");
        ctx.zoom = 1.0;
        ctx.translateX = 0.0;
        ctx.translateY = 0.0;
        canvas.ctx = ctx;
    } catch (e) {
        console.error("Error initializing 2D context:", e);
    }
    if (!ctx) {
        alert("Could not initialise Canvas 2D context, sorry :-(");
    }
    return ctx;
}

function initCanvasContext(canvas) {
    console.log("Initializing Canvas 2D context for canvas:", canvas.id);
    const devicePixelRatio = window.devicePixelRatio || 1;
    // set the size of the drawingBuffer based on the size it's displayed.
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    
    const ctx = initCanvas2D(canvas);
    return ctx;
}

function freeResources(ctx) {
    // Canvas 2D doesn't need explicit resource cleanup like WebGL
    // Just clear any stored references
    if (ctx) {
        ctx.imageData = null;
    }
}

function renderFrame(canvas, image, imageWidth, imageHeight, mirror) {
    const ctx = canvas.ctx;
    if (!ctx) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Clear canvas with black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Calculate aspect ratio correction - use "cover" mode to fill entire canvas
    const imageAspect = imageWidth / imageHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight;
    if (canvasAspect > imageAspect) {
        // Canvas is wider than image - fit to width (crop top/bottom)
        drawWidth = canvasWidth / ctx.zoom;
        drawHeight = drawWidth / imageAspect;
    } else {
        // Canvas is taller than image - fit to height (crop left/right)
        drawHeight = canvasHeight / ctx.zoom;
        drawWidth = drawHeight * imageAspect;
    }
    
    // Calculate position (centered with translation)
    const offsetX = ((canvasWidth - drawWidth) / 2 - ctx.translateX * canvasWidth) / ctx.zoom;
    const offsetY = ((canvasHeight - drawHeight) / 2 + ctx.translateY * canvasHeight) / ctx.zoom;
    
    ctx.save();
    
    // Apply mirror transform if needed
    if (mirror) {
        ctx.translate(canvasWidth, 0);
        ctx.scale(-1, 1);
        // Adjust offsetX for mirrored rendering
        ctx.drawImage(image, canvasWidth - offsetX - drawWidth, offsetY, drawWidth, drawHeight);
    } else {
        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    }
    
    ctx.restore();
    
    // Store matrix info for event handlers compatibility
    ctx.imageData = {
        width: imageWidth,
        height: imageHeight,
        drawWidth: drawWidth,
        drawHeight: drawHeight,
        matrix: [ctx.zoom, 0, 0, 0, ctx.zoom, 0, ctx.translateX, ctx.translateY, 1]
    };
}

function handleLoadedImage(canvas, image, width, height) {
    renderFrame(canvas, image, width, height, canvas.mirror);
}

function initVideoStream(canvas, stream, canvasId) {
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
            // Skip rendering if canvas context is lost
            if (!canvas.contextLost && canvas.ctx && typeof handleLoadedImage === 'function') {
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
        initCanvasContext(localCanvas);
        initVideoStream(localCanvas, localStream, 'local');        
        console.log('Local camera started');
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
}

function initialize() {
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

window.addEventListener('DOMContentLoaded', initialize);

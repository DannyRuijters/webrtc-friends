// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

function createVideoCanvas(canvasId, title, mirror = false) {
    const videoGrid = document.getElementById('videoGrid');
    const container = document.createElement('div');
    container.className = 'video-box';
    container.id = `${canvasId}-container`;
    
    // Create canvas (will be positioned behind overlays)
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'video-canvas';
    canvas.mirror = mirror;
    container.appendChild(canvas);
    
    // Create title overlay
    const h3 = document.createElement('h3');
    h3.className = 'peer-info';
    h3.textContent = title;
    container.appendChild(h3);
   
    videoGrid.appendChild(container); // Add to grid
    addMouseEvents(canvas); // Add mouse events for the new canvas
    requestAnimationFrame(rebalanceVideoGrid); // Rebalance grid
    
    return { canvas, container };
}

function removeVideoCanvas(canvasId) {
    const canvasData = canvases[canvasId];
    if (canvasData) {
        // Clear interval if exists
        if (canvasData.canvas.intervalID) {
            clearInterval(canvasData.canvas.intervalID);
        }
        // Remove from DOM
        if (canvasData.container && canvasData.container.parentNode) {
            canvasData.container.parentNode.removeChild(canvasData.container);
        }
        delete canvases[canvasId]; // Remove from tracking
        rebalanceVideoGrid(); // Rebalance grid
    }
}

function rebalanceVideoGrid() {
    const numCanvases = Object.keys(canvases).length;
    if (numCanvases === 0) return;
    const shouldUseOverlay = numCanvases > 1 && numCanvases <= 5;
    
    // Handle local video as overlay when appropriate
    const localCanvas = canvases['localVideo'];
    if (localCanvas && shouldUseOverlay) {
        makeLocalVideoOverlay(localCanvas);
    } else if (localCanvas) {
        removeLocalVideoOverlay(localCanvas);
    }
    
    // Defer measurement until after layout reflow
    requestAnimationFrame(() => {
        const videoGrid = document.getElementById('videoGrid');
        const rect = videoGrid.getBoundingClientRect();
        
        // Get gap size from CSS
        const videoGridStyles = window.getComputedStyle(videoGrid);
        const gapSize = parseInt(videoGridStyles.gap) || 10; // fallback to 10 if gap is not set
        
        // Calculate available space accounting for gaps
        const availableWidth = rect.width || (window.innerWidth - 40);
        const availableHeight = rect.height || (window.innerHeight - 200);

        // Count canvases that should participate in the grid (exclude overlay local video)
        const gridCanvases = Object.entries(canvases).filter(([id, data]) => { return !(shouldUseOverlay && id === 'localVideo'); });
        const numGridCanvases = gridCanvases.length;
        if (numGridCanvases === 0) return;

        let numRows = Math.floor(Math.sqrt(numGridCanvases * availableHeight / availableWidth) + 0.65);
        const canvasesPerRow = Math.ceil(numGridCanvases / numRows);
        numRows = Math.ceil(numGridCanvases / canvasesPerRow); // Recalculate rows based on canvases per row to avoid wasting space
        const maxWidth = Math.floor((availableWidth - (canvasesPerRow-1) * gapSize) / canvasesPerRow);
        const maxHeight = Math.floor((availableHeight - (numRows-1) * gapSize) / numRows);

        // Apply size to grid canvases only
        gridCanvases.forEach(([id, { container, canvas }]) => {
            container.style.flex = `0 0 ${maxWidth}px`;
            container.style.width = container.style.maxWidth = container.style.minWidth = `${maxWidth}px`;
            container.style.height = container.style.maxHeight = `${maxHeight}px`;
            canvas.style.width = canvas.style.maxWidth = `${maxWidth}px`;
            canvas.style.height = `${maxHeight}px`;
        });

        // Update drawing buffer after sizes are applied
        requestAnimationFrame(() => {
            Object.values(canvases).forEach(({ canvas }) => {
                const canvasRect = canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const bufferWidth = Math.round(canvasRect.width * dpr);
                const bufferHeight = Math.round(canvasRect.height * dpr);
                if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
                    canvas.width = bufferWidth;
                    canvas.height = bufferHeight;
                    if (canvas.videoElement) { 
                        requestAnimationFrame(() => { renderFrame(canvas, canvas.videoElement, canvas.mirror); });
                    }
                }
            });
        });
    });
}

function initCanvasContext(canvas) {
    console.log("Initializing Canvas 2D context for canvas:", canvas.id);
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

function makeLocalVideoOverlay(localCanvasData) {
    const { container, canvas } = localCanvasData;
    
    // Add overlay class - styles are handled by CSS
    container.classList.add('local-video-overlay');
    
    // Update canvas size for overlay dimensions
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 150 * dpr;
    
    // Re-render if video is playing
    if (canvas.videoElement) { renderFrame(canvas, canvas.videoElement, canvas.mirror); }
}

function removeLocalVideoOverlay(localCanvasData) {
    const { container } = localCanvasData;
    // Remove overlay class - CSS will handle style reset
    container.classList.remove('local-video-overlay');
}

function renderFrame(canvas, videoElement, mirror) {
    const ctx = canvas.ctx;
    if (!ctx) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Clear canvas with black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Calculate scale to cover entire canvas (no black bars)
    const imageAspect = videoElement.videoWidth / videoElement.videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    const baseScale = (canvasAspect > imageAspect) 
        ? canvasWidth / videoElement.videoWidth   // Canvas is wider - scale to width
        : canvasHeight / videoElement.videoHeight; // Canvas is taller - scale to height
    
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2); // Move origin to center
    ctx.translate(-ctx.translateX, ctx.translateY); // Apply panning
    ctx.scale(1 / ctx.zoom, 1 / ctx.zoom); // Apply zoom (user zoom inverts: smaller value = more zoomed in)
    if (mirror) { ctx.scale(-1, 1); } // Apply mirror transform if needed
    ctx.scale(baseScale, baseScale); // Apply base scale to fit/cover canvas

    // Draw image centered at origin
    ctx.drawImage(videoElement, 
        -videoElement.videoWidth / 2, 
        -videoElement.videoHeight / 2, 
        videoElement.videoWidth, 
        videoElement.videoHeight
    );
    ctx.restore();
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
            if (!canvas.contextLost && canvas.ctx) {
                try {
                    renderFrame(canvas, videoElement, canvas.mirror);
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

// Handle window resize to rebalance grid
window.addEventListener('resize', () => {
    if (Object.keys(canvases).length > 0) {
        rebalanceVideoGrid();
    }
});

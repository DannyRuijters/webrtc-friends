// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

function createVideoCanvas(canvasId, title, mirror = false) {
    const videoGrid = document.getElementById('videoGrid');
    
    // Create container div with zero padding
    const container = document.createElement('div');
    container.className = 'video-box';
    container.id = `${canvasId}-container`;
    
    // Create canvas (will be positioned behind overlays)
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'video-canvas';
    canvas.width = 640;
    canvas.height = 640;
    canvas.mirror = mirror;
    container.appendChild(canvas);
    
    // Create title overlay
    const h3 = document.createElement('h3');
    h3.textContent = title;
    container.appendChild(h3);
   
    // Add to grid
    videoGrid.appendChild(container);
    
    // Add mouse events for the new canvas
    addMouseEvents(canvas);
    
    // Add WebGL context lost/restored handlers
    setupWebGLContextHandlers(canvas, canvasId);
    
    // Rebalance grid layout - use requestAnimationFrame to ensure DOM is laid out
    requestAnimationFrame(() => {
        rebalanceVideoGrid();
    });
    
    return { canvas, container };
}

function removeVideoCanvas(canvasId) {
    const canvasData = canvases[canvasId];
    if (canvasData) {
        // Clear interval if exists
        if (canvasData.canvas.intervalID) {
            clearInterval(canvasData.canvas.intervalID);
        }
        // Clean up WebGL context
        if (canvasData.canvas.gl) {
            try {
                const gl = canvasData.canvas.gl;
                // Free WebGL resources
                if (typeof freeResources === 'function') {
                    freeResources(gl);
                }
                // Delete texture if exists
                if (gl.myTexture) {
                    gl.deleteTexture(gl.myTexture);
                    gl.myTexture = null;
                }
            } catch (e) {
                console.error(`Error cleaning up WebGL for ${canvasId}:`, e);
            }
        }
        // Remove from DOM
        if (canvasData.container && canvasData.container.parentNode) {
            canvasData.container.parentNode.removeChild(canvasData.container);
        }
        // Remove from tracking
        delete canvases[canvasId];
        // Rebalance grid
        rebalanceVideoGrid();
    }
}

function rebalanceVideoGrid() {
    const numCanvases = Object.keys(canvases).length;
    if (numCanvases === 0) return;
    
    const videoGrid = document.getElementById('videoGrid');
    const rect = videoGrid.getBoundingClientRect();
    
    // Calculate available space accounting for gaps
    const gapSize = 10;
    const availableWidth = rect.width || (window.innerWidth - 40);
    const availableHeight = rect.height || (window.innerHeight - 200);

    const numRows = Math.floor(Math.sqrt(numCanvases * availableHeight / availableWidth) + 0.65);
    const canvasesPerRow = Math.ceil(numCanvases / numRows);
    const maxWidth = Math.floor((availableWidth - (canvasesPerRow-1) * gapSize) / canvasesPerRow);
    const maxHeight = Math.floor((availableHeight - (numRows-1) * gapSize) / numRows);

    // Apply size to all canvases
    Object.values(canvases).forEach(({ container, canvas }) => {
        container.style.flex = `0 0 ${maxWidth}px`;
        container.style.width = `${maxWidth}px`;
        canvas.style.width = `${maxWidth}px`;
        canvas.style.height = `${maxHeight}px`;
        
        // Update drawing buffer
        const dpr = window.devicePixelRatio || 1;
        const bufferWidth = maxWidth * dpr;
        const bufferHeight = maxHeight * dpr;
        if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
            canvas.width = bufferWidth;
            canvas.height = bufferHeight;
            if (canvas.gl?.myTexture) {
                linearFilter(canvas.gl, canvas.gl.myTexture, canvas.width, canvas.height, canvas.mirror);
            }
        }
    });
}

// Handle window resize to rebalance grid
window.addEventListener('resize', () => {
    if (Object.keys(canvases).length > 0) {
        rebalanceVideoGrid();
    }
});

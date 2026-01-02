// Cookie helper functions
function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function setupWebGLContextHandlers(canvas, canvasId) {
    // Handle WebGL context lost
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.warn(`WebGL context lost for ${canvasId}`);
        
        // Stop the video update interval
        if (canvas.intervalID) {
            clearInterval(canvas.intervalID);
            canvas.intervalID = null;
        }
        
        // Mark context as lost
        canvas.contextLost = true;
    }, false);
    
    // Handle WebGL context restored
    canvas.addEventListener('webglcontextrestored', (event) => {
        console.log(`WebGL context restored for ${canvasId}`);
        
        // Mark context as not lost
        canvas.contextLost = false;
        
        try {
            // Reinitialize WebGL
            initCanvasGL(canvas);
            
            // Restore video if stream exists
            if (canvas.videoElement && canvas.videoElement.srcObject) {
                const stream = canvas.videoElement.srcObject;
                initVideoTexture(canvas, stream, canvasId);
                console.log(`Video stream restored for ${canvasId}`);
            }
        } catch (error) {
            console.error(`Error restoring WebGL context for ${canvasId}:`, error);
        }
    }, false);
}

function createVideoCanvas(canvasId, title) {
    const videoGrid = document.getElementById('videoGrid');
    
    // Create container div with zero padding
    const container = document.createElement('div');
    container.className = 'video-box';
    container.id = `${canvasId}-container`;
    
    // Create canvas (will be positioned behind overlays)
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'gl.cubicinterpolation';
    canvas.width = 640;
    canvas.height = 640;
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
    const videoGrid = document.getElementById('videoGrid');
    const numCanvases = Object.keys(canvases).length;
    
    if (numCanvases === 0) {
        return;
    }
    
    // Calculate maximum size based on viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxCanvasWidth = Math.floor((viewportWidth - 100) / numCanvases); // Account for padding/margins
    const maxCanvasHeight = viewportHeight - 300; // Account for controls and other UI
    const maxSize = Math.min(maxCanvasWidth, maxCanvasHeight);
    
    // Set all canvases to exactly the same size
    Object.keys(canvases).forEach(canvasId => {
        const container = canvases[canvasId].container;
        const canvas = canvases[canvasId].canvas;
        // Set equal flex basis for all containers (container matches canvas size exactly)
        container.style.flex = `0 0 ${maxSize}px`;
        container.style.width = `${maxSize}px`;
        container.style.minWidth = `${maxSize}px`;
        container.style.maxWidth = `${maxSize}px`;
        // Force canvas to be exactly the same size
        canvas.style.width = `${maxSize}px`;
        canvas.style.height = `${maxSize}px`;
        canvas.style.minWidth = `${maxSize}px`;
        canvas.style.maxWidth = `${maxSize}px`;
        canvas.style.minHeight = `${maxSize}px`;
        canvas.style.maxHeight = `${maxSize}px`;
        
        // Update canvas drawing buffer size to match display size
        const devicePixelRatio = window.devicePixelRatio || 1;
        const bufferWidth = maxSize * devicePixelRatio;
        const bufferHeight = maxSize * devicePixelRatio;
        if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
            canvas.width = bufferWidth;
            canvas.height = bufferHeight;
            // Re-render if GL context exists
            if (canvas.gl && canvas.gl.myTexture) {
                const texture = canvas.gl.myTexture;
                cubicFilter(canvas.gl, texture, canvas.width, canvas.height);
            }
        }
    });
}

function updateConnectionButton(connected) {
    const btn = document.getElementById('connectionBtn');
    if (connected) {
        btn.textContent = 'Disconnect';
        btn.classList.add('disconnect');
        btn.disabled = false;
    } else {
        btn.textContent = 'Connect';
        btn.classList.remove('disconnect');
        validateConnectionButton();
    }
}

function validateConnectionButton() {
    const btn = document.getElementById('connectionBtn');
    const userName = document.getElementById('userName');
    const roomId = document.getElementById('roomId');
    
    // Only validate if button is in connect mode (not disconnect)
    if (!btn.classList.contains('disconnect')) {
        const isValid = userName.value.trim() !== '' && roomId.value.trim() !== '';
        btn.disabled = !isValid;
    }
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
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 }, 
            audio: true 
        });
        
        // Create local canvas dynamically if it doesn't exist
        if (!canvases['localVideo']) {
            canvases['localVideo'] = createVideoCanvas('localVideo', 'You');
        }
        
        const localCanvas = canvases['localVideo'].canvas;
        initCanvasGL(localCanvas);
        initVideoTexture(localCanvas, localStream, 'local');        
        console.log('Local camera started');
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
}

function displayChatMessage(text, sender, isOwn, timestamp) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : 'remote'}`;
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = sender;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.textContent = text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'timestamp';
    const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    timeDiv.textContent = time;
    
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function loadCredentialsFromCookies() {
    const savedUsername = getCookie('webrtc_username');
    const urlRoomId = getUrlParameter('roomid');
    const savedRoomId = getCookie('webrtc_roomId');
    
    if (savedUsername) {
        const userNameInput = document.getElementById('userName');
        if (userNameInput) {
            userNameInput.value = savedUsername;
        }
    }
    
    // Prioritize URL parameter over cookie for roomId
    const roomIdToUse = urlRoomId || savedRoomId;
    if (roomIdToUse) {
        const roomIdInput = document.getElementById('roomId');
        if (roomIdInput) {
            roomIdInput.value = roomIdToUse;
        }
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

function initChatResize() {
    const resizeHandle = document.getElementById('chatResizeHandle');
    const chatContainer = document.getElementById('chatContainer');
    
    if (!resizeHandle || !chatContainer) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    function startResize(clientX) {
        isResizing = true;
        startX = clientX;
        startWidth = chatContainer.offsetWidth;
        resizeHandle.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    }
    
    function doResize(clientX) {
        if (!isResizing) return;
        
        const deltaX = startX - clientX; // Reversed because we're dragging the left edge
        const newWidth = startWidth + deltaX;
        
        // Set min and max width constraints
        const minWidth = Math.max(200, window.innerWidth * 0.1);
        const maxWidth = window.innerWidth * 0.6;
        
        const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        chatContainer.style.flex = `0 0 ${constrainedWidth}px`;
        chatContainer.style.minWidth = `${constrainedWidth}px`;
        chatContainer.style.maxWidth = `${constrainedWidth}px`;
        chatContainer.style.width = `${constrainedWidth}px`;
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }
    
    // Mouse events
    resizeHandle.addEventListener('mousedown', (e) => {
        startResize(e.clientX);
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        doResize(e.clientX);
    });
    
    document.addEventListener('mouseup', stopResize);
    
    // Touch events
    resizeHandle.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startResize(e.touches[0].clientX);
            e.preventDefault();
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            doResize(e.touches[0].clientX);
        }
    }, { passive: false });
    
    document.addEventListener('touchend', stopResize);
    document.addEventListener('touchcancel', stopResize);
}

// Handle window resize to rebalance grid
window.addEventListener('resize', () => {
    if (Object.keys(canvases).length > 0) {
        rebalanceVideoGrid();
    }
});

window.addEventListener('DOMContentLoaded', webGLStart);

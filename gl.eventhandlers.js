let lastMouseX = 0;
let lastMouseY = 0;
let lastCanvas = null;
let lastTouchDistance = 0;
let touchStartZoom = 1.0;
let lastTouchCenterX = 0;
let lastTouchCenterY = 0;

function handleMouseDown(event) {
    lastCanvas = event.target;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function handleMouseUp(event) {
    lastCanvas = null;
}

function handleMouseMove(event) {
    if (lastCanvas != null) {
        const newX = event.clientX;
        const newY = event.clientY;
        const deltaX = newX - lastMouseX;
        const deltaY = newY - lastMouseY;
        lastMouseX = newX;
        lastMouseY = newY;

        const canvas = lastCanvas;
        const gl = canvas.gl;
        const texture = gl.myTexture;
        gl.translateX -= deltaX * texture.matrix[0] / canvas.width;
        gl.translateY += deltaY * texture.matrix[4] / canvas.height;
        
        linearFilter(gl, texture, canvas.width, canvas.height, canvas.mirror);
        //window.requestAnimFrame(tick);
        event.preventDefault();
    }
}

function handleMouseWheel(event) {
    // cross-browser wheel delta
    event = window.event || event; // old IE support
    const delta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)));
    const canvas = event.target;
    const gl = canvas.gl;
    gl.zoom -= 0.1 * delta;
    if (gl.zoom < 0.001) gl.zoom = 0.001;  //prevent negative or zero zoom
    const texture = gl.myTexture;
    linearFilter(gl, texture, canvas.width, canvas.height, canvas.mirror);
    event.preventDefault();
    return false;
}

function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touch1, touch2) {
    return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
    };
}

function handleTouchStart(event) {
    const canvas = event.target;
    if (event.touches.length === 1) {
        // Single touch - don't handle, let browser handle default behavior
        lastCanvas = null;
    } else if (event.touches.length === 2) {
        // Two touches - handle pan and zoom
        lastCanvas = canvas;
        lastTouchDistance = getTouchDistance(event.touches[0], event.touches[1]);
        touchStartZoom = canvas.gl ? canvas.gl.zoom : 1.0;
        const center = getTouchCenter(event.touches[0], event.touches[1]);
        lastTouchCenterX = center.x;
        lastTouchCenterY = center.y;
        event.preventDefault();
    }
}

function handleTouchMove(event) {
    if (lastCanvas != null && event.touches.length === 2) {
        const canvas = lastCanvas;
        const gl = canvas.gl;
        const texture = gl.myTexture;
        
        // Calculate current distance and center
        const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
        const center = getTouchCenter(event.touches[0], event.touches[1]);
        
        // Check if this is primarily a zoom gesture (distance change > 5px)
        const distanceChange = Math.abs(currentDistance - lastTouchDistance);
        
        if (distanceChange > 15) {
            // Pinch to zoom
            const scale = currentDistance / lastTouchDistance;
            gl.zoom = touchStartZoom / scale;
            if (gl.zoom < 0.001) gl.zoom = 0.001;  // prevent negative or zero zoom
        } else {
            // Pan (two-finger drag)
            const deltaX = center.x - lastTouchCenterX;
            const deltaY = center.y - lastTouchCenterY;
            
            gl.translateX -= 2.0 * deltaX * texture.matrix[0] / canvas.width;
            gl.translateY += 2.0 * deltaY * texture.matrix[4] / canvas.height;
        }
        
        lastTouchCenterX = center.x;
        lastTouchCenterY = center.y;
        
        linearFilter(gl, texture, canvas.width, canvas.height, canvas.mirror);
        event.preventDefault();
    }
}

function handleTouchEnd(event) {
    if (event.touches.length === 0) {
        lastCanvas = null;
        lastTouchDistance = 0;
    } else if (event.touches.length < 2) {
        // Less than 2 fingers remaining, stop handling
        lastCanvas = null;
        lastTouchDistance = 0;
    }
}

function addMouseEvents(element) {
    if (element.addEventListener) {
        // IE9, Chrome, Safari, Opera
        element.addEventListener("mousewheel", handleMouseWheel, false);
        element.onmousedown = handleMouseDown;
        // Firefox
        element.addEventListener("DOMMouseScroll", handleMouseWheel, false);
        
        // Touch events
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd, false);
        element.addEventListener("touchcancel", handleTouchEnd, false);
    }
    // IE 6/7/8
    else element.attachEvent("onmousewheel", handleMouseWheel);
}

function windowResize() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const canvasArray = document.getElementsByClassName("video-canvas");
    for (let index = 0; index < canvasArray.length; ++index) {
        const canvas = canvasArray[index];
        // set the size of the drawingBuffer based on the size it's displayed.
        const width = canvas.clientWidth * devicePixelRatio;
        const height = canvas.clientHeight * devicePixelRatio;
        if (width != canvas.width || height != canvas.height) {
            canvas.width = width;
            canvas.height = height;
            const gl = canvas.gl;
            linearFilter(gl, gl.myTexture, canvas.width, canvas.height, canvas.mirror);
        }
    }
}

function addEventHandlers() {
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;
    window.addEventListener('resize', windowResize, true);
}

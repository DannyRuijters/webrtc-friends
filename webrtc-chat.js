// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

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

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    if (!signalingSocket || signalingSocket.readyState !== WebSocket.OPEN) {
        console.error('Not connected to server. Cannot send message.');
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    // Send to server
    sendSignalingMessage({
        type: 'chat',
        text: text,
        senderName: myName,
        roomId: roomId,
        timestamp: timestamp
    });
    
    // Display own message
    displayChatMessage(text, 'You', true, timestamp);
    
    // Clear input
    input.value = '';
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
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

        rebalanceVideoGrid();
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
    
    // Reset chat container size when switching out of wide screen layout
    const mediaQuery = window.matchMedia('(min-aspect-ratio: 1/1)');
    function handleLayoutChange(e) {
        if (!e.matches) {
            // Not in wide screen mode - remove inline resize styles
            chatContainer.style.flex = '';
            chatContainer.style.minWidth = '';
            chatContainer.style.maxWidth = '';
            chatContainer.style.width = '';
        }
    }
    
    mediaQuery.addEventListener('change', handleLayoutChange);
    // Check initial state
    handleLayoutChange(mediaQuery);
}

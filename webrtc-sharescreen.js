// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

let screenShareStream = null;
let screenShareCanvasId = null;
let screenShareSenders = {}; // Track RTCRtpSenders for screen share tracks by peer ID

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
        initCanvasContext(screenCanvas);
        initVideoStream(screenCanvas, stream, screenShareCanvasId);
        
        // Update button state
        updateShareButton(true);
        
        // Handle stream ending (user clicks browser's stop sharing button)
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            console.log('Screen sharing stopped by user');
            stopScreenShare();
        });
        
        // Add screen share tracks to all peer connections
        await addScreenShareToPeers();
        
        console.log('Screen sharing started');
        
    } catch (error) {
        if (error.name !== 'NotAllowedError') {
            console.error('Error starting screen share:', error);
        }
    }
}

async function stopScreenShare() {
    // Remove screen share tracks from all peer connections
    await removeScreenShareFromPeers();
    
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

async function addScreenShareToPeers() {
    if (!screenShareStream) return;
    
    const videoTrack = screenShareStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    // Add screen share track to all existing peer connections
    for (const peerId of Object.keys(peerConnections)) {
        const pc = peerConnections[peerId];
        if (pc && pc.connectionState !== 'closed') {
            try {
                const sender = pc.addTrack(videoTrack, screenShareStream);
                screenShareSenders[peerId] = sender;
                await sendRenegotiationOffer(peerId);
                console.log(`Added screen share track to peer ${peerId}`);
            } catch (error) {
                console.error(`Error adding screen share to peer ${peerId}:`, error);
            }
        }
    }
}

async function removeScreenShareFromPeers() {
    // Remove screen share tracks from all peer connections and renegotiate
    for (const peerId of Object.keys(screenShareSenders)) {
        const sender = screenShareSenders[peerId];
        const pc = peerConnections[peerId];
        
        if (pc && sender && pc.connectionState !== 'closed') {
            try {
                pc.removeTrack(sender);
                await sendRenegotiationOffer(peerId);
                
                // Also send explicit screen-share-stopped message for reliability
                sendSignalingMessage({
                    type: 'screen-share-stopped',
                    targetId: peerId,
                    roomId: roomId
                });
                
                console.log(`Removed screen share track from peer ${peerId}`);
            } catch (error) {
                console.error(`Error removing screen share from peer ${peerId}:`, error);
            }
        }
    }
    screenShareSenders = {};
}

function isScreenShareSupported() {
    return navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
}

function initShareButton() {
    const btn = document.getElementById('shareBtn');
    if (btn && !isScreenShareSupported()) {
        btn.disabled = true;
        console.log('Screen sharing not supported - Share button disabled');
    }
}

function updateShareButton(isSharing) {
    const btn = document.getElementById('shareBtn');
    if (btn) {
        btn.textContent = isSharing ? 'Stop Share' : 'Share';
        btn.classList.toggle('sharing', isSharing);
    }
}

// Initialize share button state when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareButton);
} else {
    initShareButton();
}

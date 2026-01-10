// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

let localStream = null;
let peerConnections = {}; // Track peer connections by peer ID
let peerMeta = {}; // Track remote peers meta data: { peerId: { name: 'name', isMuted: false, ... } }
let canvases = {}; // Track canvases by id: { local: {canvas, container}, remote-{peerId}: {canvas, container} }
let signalingSocket = null;
let myClientId = null;
let myName = '';
let roomId = '';
let chatEnabled = false;
let isMuted = false;

const SIGNALING_SERVER = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port}/ws`;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Helper functions
function updatePeerMeta(peerId, name, isMuted) {
    peerMeta[peerId] = { name: name || `Peer-${peerId}`, isMuted: isMuted || false };
}

function addScreenShareTracks(pc, peerId) {
    if (!screenShareStream) return;
    
    screenShareStream.getTracks().forEach(track => {
        const existingTrack = pc.getSenders().find(sender => sender.track === track);
        if (!existingTrack) {
            const sender = pc.addTrack(track, screenShareStream);
            if (!screenShareSenders[peerId]) {
                screenShareSenders[peerId] = sender;
            }
        }
    });
}

function createSignalingMessage(type, data = {}) {
    return {
        type,
        peerName: myName,
        roomId: roomId,
        isMuted: isMuted,
        ...data
    };
}

function toggleConnection() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        disconnectFromServer();
    } else {
        connectToSignalingServer();
    }
}

function connectToSignalingServer() {
    myName = document.getElementById('userName').value.trim() || `User-${Date.now() % 10000}`;
    roomId = document.getElementById('roomId').value.trim();
    
    // Store username and roomId in cookies
    setCookie('webrtc_username', myName);
    setCookie('webrtc_roomId', roomId);
    
    try {
        signalingSocket = new WebSocket(SIGNALING_SERVER);
        
        signalingSocket.onopen = () => {
            // Send initial message with peer name and room ID
            sendSignalingMessage({
                type: 'register',
                peerName: myName,
                roomId: roomId
            });
            updateConnectionButton(true);
        };
        
        signalingSocket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                await handleSignalingMessage(message);
            } catch (error) {
                console.error('Error handling signaling message:', error);
            }
        };
        
        signalingSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        signalingSocket.onclose = () => {
            updateConnectionButton(false);
            document.getElementById('chatInput').disabled = true;
            document.getElementById('sendChatBtn').disabled = true;
            updateMuteButton(true);
            chatEnabled = false;
            signalingSocket = null;
            myClientId = null;
        };
    } catch (error) {
        console.error(`Connection error: ${error.message}`);
    }
}

function disconnectFromServer() {
    if (signalingSocket) signalingSocket.close();
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc?.close());
    peerConnections = {};
    screenShareSenders = {};
    
    // Remove all remote canvases
    Object.keys(canvases)
        .filter(id => id.startsWith('remote-'))
        .forEach(removeVideoCanvas);
    
    // Reset mute state and disable button
    isMuted = false;
    updateMuteButton(true);
    
    peerMeta = {};
    console.log('Disconnected from server');
}

async function handleSignalingMessage(message) {
    console.log('Received signaling message:', message.type);
    
    const handlers = {
        'welcome': handleWelcome,
        'room-redirect': handleRoomRedirect,
        'peer-connected': handlePeerConnected,
        'peer-disconnected': handlePeerDisconnected,
        'offer': handleOfferMessage,
        'answer': handleAnswerMessage,
        'ice-candidate': handleIceCandidate,
        'chat': handleChatMessage,
        'mute-state': handleMuteState,
        'screen-share-stopped': handleScreenShareStopped
    };
    
    const handler = handlers[message.type];
    if (handler) {
        await handler(message);
    } else {
        console.warn('Unknown message type:', message.type);
    }
}

function handleWelcome(message) {
    myClientId = message.clientId;
    if (message.roomId) {
        roomId = message.roomId;
        document.getElementById('roomId').value = roomId;
    }
    
    console.log(`You are "${myName}" (Client ${myClientId}) in room "${roomId}"`);
    
    const localPeerInfo = document.getElementById('localVideoPeerInfo');
    if (localPeerInfo) {
        localPeerInfo.textContent = `${myName} (ID: ${myClientId}) - Room: ${roomId}`;
    }
    
    chatEnabled = true;
    document.getElementById('chatInput').disabled = false;
    document.getElementById('sendChatBtn').disabled = false;
    updateMuteButton(false);
    updateLocalPeerDisplay();
}

function handleRoomRedirect(message) {
    alert(message.message);
}

async function handlePeerConnected(message) {
    if (message.clientId === myClientId) return;
    
    const { clientId: peerId, peerName, isMuted } = message;
    updatePeerMeta(peerId, peerName, isMuted);
    
    console.log(`"${peerMeta[peerId].name}" (Client ${peerId}) joined room "${roomId}"`);
    
    // Auto-call if we have local stream
    if (localStream && !peerConnections[peerId]) {
        setTimeout(() => createAndSendOffer(peerId, peerMeta[peerId].name), 1000);
    }
    
    // Send screen share if active
    if (screenShareStream && peerConnections[peerId]) {
        setTimeout(() => sendRenegotiationOffer(peerId), 2000);
    }
}

function handlePeerDisconnected(message) {
    const peerId = message.clientId;
    console.log(`Peer ${peerId} disconnected`);
    
    if (peerMeta[peerId]) {
        removeVideoCanvas(`remote-${peerId}`);
        removeVideoCanvas(`remote-${peerId}-screen`);
        
        peerConnections[peerId]?.close();
        delete peerConnections[peerId];
        delete screenShareSenders[peerId];
        delete peerMeta[peerId];
    }
}

async function handleOfferMessage(message) {
    updatePeerMeta(message.senderId, message.peerName, message.isMuted);
    await handleOffer(message.offer, message.senderId, peerMeta[message.senderId].name);
}

async function handleAnswerMessage(message) {
    if (message.peerName) {
        updatePeerMeta(message.senderId, message.peerName, message.isMuted);
    }
    await handleAnswer(message.answer, message.senderId);
}

async function handleIceCandidate(message) {
    if (message.candidate && peerConnections[message.senderId]) {
        await peerConnections[message.senderId].addIceCandidate(new RTCIceCandidate(message.candidate));
    }
}

function handleChatMessage(message) {
    const senderName = message.senderName || `Client ${message.senderId}`;
    displayChatMessage(message.text, senderName, false, message.timestamp);
}

function handleMuteState(message) {
    if (peerMeta[message.senderId]) {
        peerMeta[message.senderId].isMuted = message.isMuted;
        updateRemotePeerDisplay(message.senderId);
    }
}

function handleScreenShareStopped(message) {
    const screenCanvasId = `remote-${message.senderId}-screen`;
    if (canvases[screenCanvasId]) {
        removeVideoCanvas(screenCanvasId);
    }
}

function sendSignalingMessage(message) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify(message));
    } else {
        console.error('Cannot send message: WebSocket not connected');
    }
}

// Helper function to send a renegotiation offer to a peer
async function sendRenegotiationOffer(peerId) {
    const pc = peerConnections[peerId];
    if (!pc || pc.connectionState === 'closed') return false;
    
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendSignalingMessage(createSignalingMessage('offer', {
            offer: offer,
            targetId: peerId
        }));
        return true;
    } catch (error) {
        console.error(`Error sending renegotiation offer to peer ${peerId}:`, error);
        return false;
    }
}

async function createPeerConnection(peerId, peerName) {
    const pc = new RTCPeerConnection(configuration);
    peerConnections[peerId] = pc;
    
    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    
    // Add screen share tracks
    addScreenShareTracks(pc, peerId);
    
    // Setup event handlers
    setupPeerConnectionHandlers(pc, peerId, peerName);
    
    return pc;
}

function setupPeerConnectionHandlers(pc, peerId, peerName) {
    pc.ontrack = (event) => handleIncomingTrack(event, peerId, peerName);
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log(`Sending ICE candidate to peer ${peerId}`);
            sendSignalingMessage(createSignalingMessage('ice-candidate', {
                candidate: event.candidate,
                targetId: peerId
            }));
        }
    };
    
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with peer ${peerId}:`, pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            console.error(`Connection with peer ${peerId} ${pc.connectionState}`);
        }
    };
}

function handleIncomingTrack(event, peerId, peerName) {
    const stream = event.streams[0];
    if (!stream) return;
    
    const streamId = stream.id;
    const existingCanvas = canvases[`remote-${peerId}`];
    const isScreenShare = event.track.kind === 'video' && 
        existingCanvas?.streamId && existingCanvas.streamId !== streamId;
    
    const canvasId = isScreenShare ? `remote-${peerId}-screen` : `remote-${peerId}`;
    const displayName = isScreenShare ? 
        `${peerName || `Peer ${peerId}`} (Screen)` : 
        (peerName || `Peer ${peerId}`);
    
    if (!canvases[canvasId]) {
        canvases[canvasId] = createVideoCanvas(canvasId, displayName);
    }
    canvases[canvasId].streamId = streamId;
    
    if (isScreenShare) {
        const cleanup = () => canvases[canvasId] && removeVideoCanvas(canvasId);
        event.track.onended = cleanup;
        stream.onremovetrack = () => stream.getTracks().length === 0 && cleanup();
    } else {
        updateRemotePeerDisplay(peerId);
    }
    
    const canvas = canvases[canvasId].canvas;
    initCanvasContext(canvas);
    initVideoStream(canvas, stream, canvasId);
}

async function createAndSendOffer(targetId, peerName) {
    try {
        const pc = await createPeerConnection(targetId, peerName);
        
        // Screen share tracks are already added in createPeerConnection
        // but ensure they're added if connection was created earlier
        addScreenShareTracks(pc, targetId);
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendSignalingMessage(createSignalingMessage('offer', {
            offer: offer,
            targetId: targetId
        }));
        
        console.log(`Sent offer to "${peerName}" (Client ${targetId})`);
    } catch (error) {
        console.error("Error creating offer:", error);
    }
}

async function handleAnswer(answer, peerId) {
    const pc = peerConnections[peerId];
    if (!pc) return;
    
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error("Error handling answer:", error);
    }
}

async function handleOffer(offer, senderId, peerName) {
    try {
        if (!localStream) await startLocalVideo();
        
        // Check if we already have a connection with this peer (renegotiation)
        let pc = peerConnections[senderId];
        const isRenegotiation = pc && pc.connectionState !== 'closed';
        
        if (!isRenegotiation) {
            pc = await createPeerConnection(senderId, peerName);
        } else if (pc.signalingState === 'have-local-offer') {
            // Rollback local offer for glare handling
            await pc.setLocalDescription({ type: 'rollback' });
        }
        
        // Ensure screen share tracks are added
        addScreenShareTracks(pc, senderId);
        
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        sendSignalingMessage(createSignalingMessage('answer', {
            answer: answer,
            targetId: senderId
        }));
    } catch (error) {
        console.error("Error handling offer:", error);
    }
}

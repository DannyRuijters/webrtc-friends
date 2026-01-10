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
    
    switch (message.type) {
        case 'welcome':
            myClientId = message.clientId;
            // Update roomId if server assigned a different room (due to overflow)
            if (message.roomId) {
                roomId = message.roomId;
                document.getElementById('roomId').value = roomId;
            }
            const peersInRoom = message.peersInRoom || (message.totalClients - 1);
            console.log(`You are "${myName}" (Client ${myClientId}) in room "${roomId}"`);
            // Update local peer info if canvas exists
            const localPeerInfo = document.getElementById('localVideoPeerInfo');
            if (localPeerInfo) {
                localPeerInfo.textContent = `${myName} (ID: ${myClientId}) - Room: ${roomId}`;
            }
            chatEnabled = true;
            document.getElementById('chatInput').disabled = false;
            document.getElementById('sendChatBtn').disabled = false;
            updateMuteButton(false);
            updateLocalPeerDisplay();
            break;
            
        case 'room-redirect':
            // Display alert notification that user was redirected to an overflow room
            alert(message.message);
            break;
            
        case 'peer-connected':
            if (message.clientId !== myClientId) {
                const peerName = message.peerName || `Peer-${message.clientId}`;
                const peerId = message.clientId;
                const peersInRoom = message.peersInRoom || message.totalClients;
                const isMuted = message.isMuted;
                
                // Track the new peer with mute state
                peerMeta[peerId] = { name: peerName, isMuted: isMuted };
                console.log(`"${peerName}" (Client ${peerId}) joined room "${roomId}". Peers in room: ${peersInRoom}`);
                
                // If we have local stream and no existing connection to this peer, automatically call
                if (localStream && !peerConnections[peerId]) {
                    setTimeout(() => {
                        createAndSendOffer(peerId, peerName);
                    }, 1000);
                }
            }
            break;
            
        case 'peer-disconnected':
            const disconnectedPeerId = message.clientId;
            console.log(`Peer ${disconnectedPeerId} disconnected`);
            
            if (peerMeta[disconnectedPeerId]) {
                // Remove remote canvases for this peer (camera and screen share)
                removeVideoCanvas(`remote-${disconnectedPeerId}`);
                removeVideoCanvas(`remote-${disconnectedPeerId}-screen`);
                
                // Close and clean up peer connection
                peerConnections[disconnectedPeerId]?.close();
                delete peerConnections[disconnectedPeerId];
                delete screenShareSenders[disconnectedPeerId];
                delete peerMeta[disconnectedPeerId];
            }
            break;
            
        case 'offer':
            const peerNameOffer = message.peerName || `Peer-${message.senderId}`;
            peerMeta[message.senderId] = { name: peerNameOffer, isMuted: message.isMuted };
            await handleOffer(message.offer, message.senderId, peerNameOffer);
            break;
            
        case 'answer':
            const peerNameAnswer = message.peerName || peerMeta[message.senderId]?.name || `Peer-${message.senderId}`;
            if (message.peerName) peerMeta[message.senderId] = { name: peerNameAnswer, isMuted: message.isMuted };
            await handleAnswer(message.answer, message.senderId);
            break;
            
        case 'ice-candidate':
            if (message.candidate && peerConnections[message.senderId]) {
                await peerConnections[message.senderId].addIceCandidate(new RTCIceCandidate(message.candidate));
            }
            break;
            
        case 'chat':
            const senderName = message.senderName || `Client ${message.senderId}`;
            displayChatMessage(message.text, senderName, false, message.timestamp);
            break;
            
        case 'mute-state':
            if (peerMeta[message.senderId]) {
                peerMeta[message.senderId].isMuted = message.isMuted;
                updateRemotePeerDisplay(message.senderId);
            }
            break;
            
        case 'screen-share-stopped':
            const screenCanvasId = `remote-${message.senderId}-screen`;
            if (canvases[screenCanvasId]) {
                removeVideoCanvas(screenCanvasId);
            }
            break;
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
        
        sendSignalingMessage({
            type: 'offer',
            offer: offer,
            targetId: peerId,
            peerName: myName,
            roomId: roomId,
            isMuted: isMuted
        });
        return true;
    } catch (error) {
        console.error(`Error sending renegotiation offer to peer ${peerId}:`, error);
        return false;
    }
}

async function createPeerConnection(peerId, peerName) {
    const pc = new RTCPeerConnection(configuration);
    peerConnections[peerId] = pc;
    
    // Add local stream tracks to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
    
    // Add screen share stream tracks if screen sharing is active
    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => {
            const sender = pc.addTrack(track, screenShareStream);
            screenShareSenders[peerId] = sender;
        });
    }
    
    // Handle incoming tracks
    pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        
        // Check if this is an additional stream (screen share) vs the main camera stream
        const streamId = stream.id;
        const existingCanvas = canvases[`remote-${peerId}`];
        const isScreenShare = event.track.kind === 'video' && 
            existingCanvas?.streamId && 
            existingCanvas.streamId !== streamId;
        
        let canvasId;
        if (isScreenShare) {
            // This is a screen share stream - create a separate canvas
            canvasId = `remote-${peerId}-screen`;
            
            if (!canvases[canvasId]) {
                canvases[canvasId] = createVideoCanvas(canvasId, `${peerName || `Peer ${peerId}`} (Screen)`);
                canvases[canvasId].streamId = streamId;
            }
            
            // Cleanup function for when screen share ends
            const cleanupScreenShare = () => {
                if (canvases[canvasId]) {
                    removeVideoCanvas(canvasId);
                }
            };
            
            event.track.onended = cleanupScreenShare;
            stream.onremovetrack = () => {
                if (stream.getTracks().length === 0) cleanupScreenShare();
            };
        } else {
            // This is the main camera stream
            canvasId = `remote-${peerId}`;
            
            if (!canvases[canvasId]) {
                canvases[canvasId] = createVideoCanvas(canvasId, peerName || `Peer ${peerId}`);
            }
            canvases[canvasId].streamId = streamId;
            updateRemotePeerDisplay(peerId);
        }
        
        const remoteCanvas = canvases[canvasId].canvas;
        initCanvasContext(remoteCanvas);
        initVideoStream(remoteCanvas, stream, canvasId);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log(`Sending ICE candidate to peer ${peerId}`);
            sendSignalingMessage({
                type: 'ice-candidate',
                candidate: event.candidate,
                targetId: peerId,
                roomId: roomId
            });
        }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with peer ${peerId}:`, pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            console.error(`Connection with peer ${peerId} ${pc.connectionState}`);
        }
    };
    
    return pc;
}

async function createAndSendOffer(targetId, peerName) {
    try {
        const pc = await createPeerConnection(targetId, peerName);
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendSignalingMessage({
            type: 'offer',
            offer: offer,
            targetId: targetId,
            peerName: myName,
            roomId: roomId,
            isMuted: isMuted
        });
        
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
        
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        sendSignalingMessage({
            type: 'answer',
            answer: answer,
            targetId: senderId,
            peerName: myName,
            roomId: roomId,
            isMuted: isMuted
        });
    } catch (error) {
        console.error("Error handling offer:", error);
    }
}

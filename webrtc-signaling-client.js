// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

let localStream = null;
let peerConnections = {}; // Track peer connections by peer ID
let canvases = {}; // Track canvases by id: { local: {canvas, container}, remote-{peerId}: {canvas, container} }
let signalingSocket = null;
let myClientId = null;
let myName = '';
let roomId = '';
let remotePeers = {}; // Track remote peers: { peerId: { name: 'name', ... } }
let chatEnabled = false;

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
            chatEnabled = false;
            signalingSocket = null;
            myClientId = null;
        };
    } catch (error) {
        console.error(`Connection error: ${error.message}`);
    }
}

function disconnectFromServer() {
    if (signalingSocket) {
        signalingSocket.close();
    }
    
    // Close all peer connections
    Object.keys(peerConnections).forEach(peerId => {
        if (peerConnections[peerId]) {
            peerConnections[peerId].close();
        }
    });
    peerConnections = {};
    
    // Clean up screen share senders
    screenShareSenders = {};
    
    // Remove all remote canvases
    Object.keys(canvases).forEach(canvasId => {
        if (canvasId.startsWith('remote-')) {
            removeVideoCanvas(canvasId);
        }
    });
    
    remotePeers = {};
    console.log('Disconnected from server');
}

async function handleSignalingMessage(message) {
    console.log('Received signaling message:', message.type);
    
    switch (message.type) {
        case 'welcome':
            myClientId = message.clientId;
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
            break;
            
        case 'peer-connected':
            if (message.clientId !== myClientId) {
                const peerName = message.peerName || `Peer-${message.clientId}`;
                const peerId = message.clientId;
                const peersInRoom = message.peersInRoom || message.totalClients;
                
                // Track the new peer
                remotePeers[peerId] = { name: peerName };                
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
            
            if (remotePeers[disconnectedPeerId]) {
                const peerName = remotePeers[disconnectedPeerId].name;
                
                // Remove remote canvas for this peer (both camera and screen share)
                removeVideoCanvas(`remote-${disconnectedPeerId}`);
                removeVideoCanvas(`remote-${disconnectedPeerId}-screen`);
                
                // Close peer connection
                if (peerConnections[disconnectedPeerId]) {
                    peerConnections[disconnectedPeerId].close();
                    delete peerConnections[disconnectedPeerId];
                }
                
                // Clean up screen share sender reference
                if (screenShareSenders[disconnectedPeerId]) {
                    delete screenShareSenders[disconnectedPeerId];
                }
                
                // Remove from tracking
                delete remotePeers[disconnectedPeerId];
            }
            break;
            
        case 'offer':
            const senderIdOffer = message.senderId;
            const peerNameOffer = message.peerName || `Peer-${senderIdOffer}`;
            remotePeers[senderIdOffer] = { name: peerNameOffer };
            console.log(`Received offer from "${peerNameOffer}" (Client ${senderIdOffer})`);
            await handleOffer(message.offer, senderIdOffer, peerNameOffer);
            break;
            
        case 'answer':
            const senderIdAnswer = message.senderId;
            const peerNameAnswer = message.peerName || remotePeers[senderIdAnswer]?.name || `Peer-${senderIdAnswer}`;
            if (message.peerName) {
                remotePeers[senderIdAnswer] = { name: peerNameAnswer };
            }
            console.log(`Received answer from "${peerNameAnswer}" (Client ${senderIdAnswer})`);
            await handleAnswer(message.answer, senderIdAnswer);
            break;
            
        case 'ice-candidate':
            const senderIdIce = message.senderId;
            if (message.candidate && peerConnections[senderIdIce]) {
                await peerConnections[senderIdIce].addIceCandidate(new RTCIceCandidate(message.candidate));
                console.log(`Added ICE candidate from peer ${senderIdIce}`);
            }
            break;
            
        case 'chat':
            const senderName = message.senderName || `Client ${message.senderId}`;
            displayChatMessage(message.text, senderName, false, message.timestamp);
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
        console.log(`Received remote track from peer ${peerId}:`, event.track.kind, 'stream:', event.streams[0]?.id);
        
        const stream = event.streams[0];
        if (!stream) return;
        
        // Check if this is an additional stream (screen share) vs the main camera stream
        // We track streams by their ID to create separate canvases for each
        const streamId = stream.id;
        const isScreenShare = event.track.kind === 'video' && 
            canvases[`remote-${peerId}`] && 
            canvases[`remote-${peerId}`].streamId !== streamId;
        
        let canvasId;
        if (isScreenShare) {
            // This is a screen share stream - create a separate canvas
            canvasId = `remote-${peerId}-screen`;
            
            if (!canvases[canvasId]) {
                canvases[canvasId] = createVideoCanvas(canvasId, `${peerName || `Peer ${peerId}`} (Screen)`);
                canvases[canvasId].streamId = streamId;
            }
            
            // Handle screen share track ending
            event.track.onended = () => {
                console.log(`Screen share track from peer ${peerId} ended`);
                if (canvases[canvasId]) {
                    removeVideoCanvas(canvasId);
                }
            };
        } else {
            // This is the main camera stream
            canvasId = `remote-${peerId}`;
            
            if (!canvases[canvasId]) {
                canvases[canvasId] = createVideoCanvas(canvasId, peerName || `Peer ${peerId}`);
            }
            canvases[canvasId].streamId = streamId;
        }
        
        const remoteCanvas = canvases[canvasId].canvas;
        initCanvasGL(remoteCanvas);
        initVideoTexture(remoteCanvas, stream, canvasId);
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
    
    pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with peer ${peerId}:`, pc.iceConnectionState);
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
            roomId: roomId
        });
        
        console.log(`Sent offer to "${peerName}" (Client ${targetId})`);
    } catch (error) {
        console.error("Error creating offer:", error);
    }
}

async function handleAnswer(answer, peerId) {
    try {
        const pc = peerConnections[peerId];
        if (!pc) {
            console.error(`No peer connection found for peer ${peerId}`);
            return;
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        const peerName = remotePeers[peerId]?.name || `Peer ${peerId}`;
        console.log(`Connection established with "${peerName}"`);
        
        // Update remote peer info if canvas exists
        const remotePeerInfo = document.getElementById(`remote-${peerId}PeerInfo`);
        if (remotePeerInfo) {
            remotePeerInfo.textContent = `${peerName} (ID: ${peerId})`;
        }
    } catch (error) {
        console.error("Error handling answer:", error);
    }
}

async function handleOffer(offer, senderId, peerName) {
    try {
        if (!localStream) {
            console.log(`Received call from "${peerName}" but camera not started. Starting camera...`);
            await startLocalVideo();
        }
        
        const pc = await createPeerConnection(senderId, peerName);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        sendSignalingMessage({
            type: 'answer',
            answer: answer,
            targetId: senderId,
            peerName: myName,
            roomId: roomId
        });
        
        console.log(`Answered call from "${peerName}"`);
        
        // Update remote peer info if canvas exists
        const remotePeerInfo = document.getElementById(`remote-${senderId}PeerInfo`);
        if (remotePeerInfo) {
            remotePeerInfo.textContent = `${peerName} (ID: ${senderId})`;
        }
    } catch (error) {
        console.error("Error handling offer:", error);
    }
}

function updateConnectionButton(connected) {
    const btn = document.getElementById('connectionBtn');
    const userNameInput = document.getElementById('userName');
    const roomIdInput = document.getElementById('roomId');
    
    if (connected) {
        btn.textContent = 'Disconnect';
        btn.classList.add('disconnect');
        btn.disabled = false;
        userNameInput.disabled = true;
        roomIdInput.disabled = true;
    } else {
        btn.textContent = 'Connect';
        btn.classList.remove('disconnect');
        userNameInput.disabled = false;
        roomIdInput.disabled = false;
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

// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

function toggleMute() {
    const audioTracks = localStream?.getAudioTracks();
    if (audioTracks?.length === 0) {
        console.log('No audio tracks available to mute');
        return;
    }
    
    isMuted = !isMuted;
    audioTracks.forEach(track => {
        track.enabled = !isMuted;
    });
    
    updateButtonState();
    updateLocalPeerDisplay();
    
    // Send mute state to other peers
    sendSignalingMessage({
        type: 'mute-state',
        isMuted: isMuted,
        roomId: roomId
    });
    
    console.log(`Audio ${isMuted ? 'muted' : 'unmuted'}`);
}

function updateButtonState(disabled = false) {
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) { 
        shareBtn.disabled = disabled || !isScreenShareSupported();
        if (shareBtn.disabled) { shareBtn.textContent = 'Share'; }
    }

    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
        muteBtn.title = isMuted ? 'Unmute microphone' : 'Mute microphone';
        muteBtn.disabled = disabled;
    }
}

function updateLocalPeerDisplay() {
    // Update local canvas
    if (canvases['localVideo']) {
        const peerInfo = canvases['localVideo'].container.querySelector('.peer-info');
        if (peerInfo) {
            peerInfo.textContent = isMuted ? 'You (muted)' : 'You';
        }
    }
}

function updateRemotePeerDisplay(peerId) {
    const peer = peerMeta[peerId];
    if (!peer) return;
    
    const mutedSuffix = peer.isMuted ? ' (muted)' : '';
    const displayName = `${peer.name}${mutedSuffix}`;
    
    // Update main camera canvas
    const mainCanvasId = `remote-${peerId}`;
    if (canvases[mainCanvasId]) {
        const peerInfo = canvases[mainCanvasId].container.querySelector('.peer-info');
        if (peerInfo) {
            peerInfo.textContent = displayName;
        }
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
    const linkBtn = document.getElementById('linkBtn');
    
    // Only validate if button is in connect mode (not disconnect)
    if (!btn.classList.contains('disconnect')) {
        const isValid = userName.value.trim() !== '' && roomId.value.trim() !== '';
        btn.disabled = !isValid;
        linkBtn.disabled = !isValid;
    }
}

function createLink() {
    // copy to clipboard
    const enteredRoomId = document.getElementById('roomId').value.trim();
    const link = `${window.location.origin}${window.location.pathname}?roomid=${encodeURIComponent(enteredRoomId)}`;
    navigator.clipboard.writeText(link).then(() => {
        console.log('Link copied to clipboard');
        alert('Call link copied to clipboard:\n' + link + '\nShare it with others to invite them to the call.');
    }).catch(err => {
        console.error('Failed to copy link: ', err);
    });
}

// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

// Settings overlay window functions
function openOverlay() {
    populateMediaDevices();
    document.getElementById('overlay').classList.add('active');
}

function closeOverlay() {
    document.getElementById('overlay').classList.remove('active');
}

// Populate audio and video source dropdowns
async function populateMediaDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioSelect = document.getElementById('audioSource');
        const videoSelect = document.getElementById('videoSource');
        
        // Get currently active device IDs if local stream exists
        let currentAudioId = null;
        let currentVideoId = null;
        
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            const videoTrack = localStream.getVideoTracks()[0];
            
            if (audioTrack) {
                const settings = audioTrack.getSettings();
                currentAudioId = settings.deviceId;
            }
            
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                currentVideoId = settings.deviceId;
            }
        }
        
        // Clear existing options
        audioSelect.innerHTML = '';
        videoSelect.innerHTML = '';
        
        // Add audio sources
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        audioDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Microphone ${index + 1}`;
            if (device.deviceId === currentAudioId) {
                option.selected = true;
            }
            audioSelect.appendChild(option);
        });
        
        // Add video sources
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            if (device.deviceId === currentVideoId) {
                option.selected = true;
            }
            videoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error enumerating devices:', error);
    }
}

// Handle audio source change
async function handleAudioSourceChange() {
    const audioSelect = document.getElementById('audioSource');
    const selectedDeviceId = audioSelect.value;
    console.log('Audio source changed to:', audioSelect.options[audioSelect.selectedIndex].text, selectedDeviceId);
    
    if (localStream) {
        try {
            // Get new audio stream with selected device
            const newAudioStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: selectedDeviceId } }
            });
            
            const newAudioTrack = newAudioStream.getAudioTracks()[0];
            const oldAudioTrack = localStream.getAudioTracks()[0];
            
            // Replace audio track in local stream
            if (oldAudioTrack) {
                localStream.removeTrack(oldAudioTrack);
                oldAudioTrack.stop();
            }
            localStream.addTrack(newAudioTrack);
            
            // Update all peer connections with new audio track
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                if (sender) {
                    sender.replaceTrack(newAudioTrack);
                }
            });
            
            console.log('Audio source switched successfully');
        } catch (error) {
            console.error('Error switching audio source:', error);
        }
    }
}

// Handle video source change
async function handleVideoSourceChange() {
    const videoSelect = document.getElementById('videoSource');
    const selectedDeviceId = videoSelect.value;
    console.log('Video source changed to:', videoSelect.options[videoSelect.selectedIndex].text, selectedDeviceId);
    
    if (localStream) {
        try {
            // Get new video stream with selected device
            const newVideoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: selectedDeviceId },
                    width: 1280,
                    height: 720
                }
            });
            
            const newVideoTrack = newVideoStream.getVideoTracks()[0];
            const oldVideoTrack = localStream.getVideoTracks()[0];
            
            // Replace video track in local stream
            if (oldVideoTrack) {
                localStream.removeTrack(oldVideoTrack);
                oldVideoTrack.stop();
            }
            localStream.addTrack(newVideoTrack);
            
            // Update all peer connections with new video track
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(newVideoTrack);
                }
            });
            
            // Update local canvas with new video track
            if (canvases['localVideo']) {
                const localCanvas = canvases['localVideo'].canvas;
                initVideoTexture(localCanvas, localStream, 'local');
            }
            
            console.log('Video source switched successfully');
        } catch (error) {
            console.error('Error switching video source:', error);
        }
    }
}

// Close overlay when clicking outside the content
window.addEventListener('click', (event) => {
    const overlay = document.getElementById('overlay');
    if (event.target === overlay) {
        closeOverlay();
    }
    const shareOverlay = document.getElementById('shareOverlay');
    if (event.target === shareOverlay) {
        closeShareOverlay();
    }
});

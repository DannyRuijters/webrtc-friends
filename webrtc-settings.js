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

// Helper function to replace a track in localStream and all peer connections
async function replaceTrackInConnections(kind, newTrack) {
    const oldTrack = localStream.getTracks().find(t => t.kind === kind);
    
    if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
    }
    localStream.addTrack(newTrack);
    
    // Update all peer connections with new track
    Object.values(peerConnections).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === kind);
        if (sender) {
            sender.replaceTrack(newTrack);
        }
    });
}

// Handle audio source change
async function handleAudioSourceChange() {
    const audioSelect = document.getElementById('audioSource');
    const selectedDeviceId = audioSelect.value;
    console.log('Audio source changed to:', audioSelect.options[audioSelect.selectedIndex].text, selectedDeviceId);
    
    if (localStream) {
        try {
            const newAudioStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: selectedDeviceId } }
            });
            
            await replaceTrackInConnections('audio', newAudioStream.getAudioTracks()[0]);
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
            const newVideoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: selectedDeviceId },
                    width: 1280,
                    height: 720
                }
            });
            
            await replaceTrackInConnections('video', newVideoStream.getVideoTracks()[0]);
            
            // Update local canvas with new video track
            if (canvases['localVideo']) {
                initVideoTexture(canvases['localVideo'].canvas, localStream, 'local');
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
});

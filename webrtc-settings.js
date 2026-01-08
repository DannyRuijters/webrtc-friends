// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

let videoWidth = 1280;
let videoHeight = 720;

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
        let currentAudioId = null;
        let currentVideoId = null;
        
        // Get currently active device IDs if local stream exists
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            const videoTrack = localStream.getVideoTracks()[0];
            if (audioTrack) { currentAudioId = audioTrack.getSettings().deviceId; }
            if (videoTrack) { currentVideoId = videoTrack.getSettings().deviceId; }
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
            option.selected = (device.deviceId === currentAudioId);
            audioSelect.appendChild(option);
        });
        
        // Add video sources
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            option.selected = (device.deviceId === currentVideoId);
            videoSelect.appendChild(option);
        });

        // Set video resolution dropdown to current settings
        const resolutionSelect = document.getElementById('videoResolution');
        const currentResolution = `${videoWidth}x${videoHeight}`;
        resolutionSelect.value = currentResolution;
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
                    width: videoWidth,
                    height: videoHeight
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

// Handle video resolution change
function handleVideoResolutionChange() {
    const resolutionSelect = document.getElementById('videoResolution');
    const selectedResolution = resolutionSelect.value;
    console.log('Video resolution changed to:', selectedResolution);

    const [width, height] = selectedResolution.split('x').map(Number);
    videoWidth = width;
    videoHeight = height;
    setCookie('webrtc_videoWidth', String(videoWidth));
    setCookie('webrtc_videoHeight', String(videoHeight));

    handleVideoSourceChange();  // Apply video source with new resolution
}

// Close overlay when clicking outside the content
window.addEventListener('click', (event) => {
    const overlay = document.getElementById('overlay');
    if (event.target === overlay) {
        closeOverlay();
    }
});

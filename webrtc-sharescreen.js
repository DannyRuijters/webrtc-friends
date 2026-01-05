// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

// Share screen overlay window functions
function openShareOverlay() {
    const roomId = document.getElementById('roomId').value;
    const userName = document.getElementById('userName').value;
    
    // Build share link with current URL and parameters
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    if (userName) {
        url.searchParams.set('name', userName);
    }
    
    document.getElementById('shareLink').value = url.toString();
    document.getElementById('shareOverlay').classList.add('active');
}

function closeShareOverlay() {
    document.getElementById('shareOverlay').classList.remove('active');
}

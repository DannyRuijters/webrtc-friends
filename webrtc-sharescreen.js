// Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.
// See LICENSE file for terms and conditions.
// https://github.com/dannyruijters/webrtc-friends

// Share screen overlay window functions
function openShareOverlay() {
    document.getElementById('shareOverlay').classList.add('active');
}

function closeShareOverlay() {
    document.getElementById('shareOverlay').classList.remove('active');
}

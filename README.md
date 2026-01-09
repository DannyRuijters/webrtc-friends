# WebRTC Friends

A lightweight, self-hosted WebRTC video communication application for peer-to-peer video calls with integrated chat, screen sharing, and collaborative canvas features.

## Features

- **Peer-to-Peer Video Calls**: Direct WebRTC connections for low-latency video communication
- **Room-Based Sessions**: Multiple users can join the same room for group video calls
- **Real-time Chat**: Built-in text chat with all participants
- **Screen Sharing**: Share your screen with other participants
- **Customizable Settings**: Configure audio/video sources and resolution
- **Responsive Layout**: Adaptive video grid that adjusts to the number of participants
- **Cookie Persistence**: Remembers your username and room preferences

## Architecture

The application consists of:
- **Client-side**: Pure HTML/CSS/JavaScript (no frameworks required)
  - WebRTC peer connection handling
  - Video grid management
  - Chat interface
  - Settings management
- **Server-side**: Python-based WebSocket signaling server using FastAPI
  - Handles WebRTC signaling (SDP offer/answer, ICE candidates)
  - Room management
  - Peer discovery

## Prerequisites

- Python 3.8 or higher
- Modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)
- Network connectivity for STUN servers (for NAT traversal)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/dannyruijters/webrtc-friends.git
cd webrtc-friends
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Starting the Server

Run the signaling server:
```bash
python webrtc-signaling-server.py
```

By default, the server runs on port 8080. To use a different port:
```bash
python webrtc-signaling-server.py --port 3000
```

### Accessing the Application

1. Open your web browser and navigate to:
   ```
   http://localhost:8080
   ```

2. Enter your name and a room identifier
3. Click "Connect" to join the room
4. Share the same room ID with others to join the same video session

### Screen Sharing

Click the "Share" button to start sharing your screen with other participants.

### Settings

Click the settings button (⚙) to:
- Select audio input device
- Select video input device
- Change video resolution (320x240 to 1920x1080)

### Chat

Use the chat panel on the right to send text messages to all participants in the room.

### E-mail meeting invite

You can send a meeting invite using your favorite e-mail or agenda software with a link to open the WebRTC-Friends meeting.
The link format should be: `https://your-server/?roomid=ROOM_ID`, whereby you replace `your-server` with the URL to your server and `ROOM_ID` with a freely chosen string.

## Running as a System Service (Linux)

A systemd service file (`webrtc.service`) is included for running the server as a background service:

1. Edit the service file to set the correct paths
2. Copy to systemd directory:
   ```bash
   sudo cp webrtc.service /etc/systemd/system/
   ```
3. Enable and start the service:
   ```bash
   sudo systemctl enable webrtc
   sudo systemctl start webrtc
   ```

## File Structure

- `webrtc.html` - Main HTML interface
- `webrtc.css` - Styling for the application
- `webrtc-signaling-server.py` - Python WebSocket signaling server
- `webrtc-signaling-client.js` - WebRTC connection and signaling logic
- `webrtc-videogrid.js` - Dynamic video grid layout management
- `webrtc-chat.js` - Chat functionality
- `webrtc-canvas.js` - Collaborative canvas implementation
- `webrtc-settings.js` - Settings and device management
- `webrtc-sharescreen.js` - Screen sharing functionality
- `webrtc-cookie.js` - Cookie handling for persistence
- `mouse.eventhandlers.js` - Mouse event handling for canvas
- `requirements.txt` - Python dependencies
- `webrtc.service` - Systemd service file

## Network Requirements

- The application uses Google's public STUN servers for NAT traversal (you can change the ice servers in `webrtc-signaling-client.js` if you want to use other STUN or TURN servers, such as your [own](https://github.com/coturn/coturn))
- For connections across different networks, ensure WebRTC ports are not blocked by firewalls
- For production use behind strict firewalls, consider setting up a TURN server
- When the `webrtc-signaling-server.py` runs on a HTTPS address (e.g. using [Let's Encrypt](https://letsencrypt.org/)), it will also use secure websockets for encrypted sharing of WebRTC handshakes and chat messages

## License

Copyright (c) 2025-2026, Danny Ruijters. All rights reserved.

This software is provided under a BSD-style license. See the LICENSE file for full terms and conditions.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

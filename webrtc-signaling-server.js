#!/usr/bin/env node

/**
 * WebSocket Signaling Server for WebRTC
 * Simple signaling server to exchange SDP offers/answers and ICE candidates
 * 
 * Usage: node signaling-server.js [port]
 * Default port: 8080
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebRTC Signaling Server is running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients with their IDs
const clients = new Map();
let clientIdCounter = 0;

wss.on('connection', (ws) => {
    const clientId = ++clientIdCounter;
    clients.set(clientId, ws);
    
    console.log(`[${new Date().toISOString()}] Client ${clientId} connected. Total clients: ${clients.size}`);
    
    // Send welcome message with client ID
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId: clientId,
        totalClients: clients.size
    }));
    
    // Broadcast to all other clients that a new peer is available
    broadcast({
        type: 'peer-connected',
        clientId: clientId,
        totalClients: clients.size
    }, clientId);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[${new Date().toISOString()}] Client ${clientId} sent:`, data.type);
            
            // Handle different message types
            switch (data.type) {
                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    // Forward to specific peer if targetId is provided, otherwise broadcast
                    if (data.targetId) {
                        const targetClient = clients.get(data.targetId);
                        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                            targetClient.send(JSON.stringify({
                                ...data,
                                senderId: clientId
                            }));
                            console.log(`  → Forwarded to client ${data.targetId}`);
                        } else {
                            console.log(`  ✗ Target client ${data.targetId} not found or not ready`);
                        }
                    } else {
                        // Broadcast to all other clients
                        broadcast({
                            ...data,
                            senderId: clientId
                        }, clientId);
                        console.log(`  → Broadcasted to all peers`);
                    }
                    break;
                    
                case 'get-peers':
                    // Send list of available peers
                    const peerList = Array.from(clients.keys()).filter(id => id !== clientId);
                    ws.send(JSON.stringify({
                        type: 'peer-list',
                        peers: peerList
                    }));
                    break;
                    
                default:
                    console.log(`  ? Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error parsing message from client ${clientId}:`, error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`[${new Date().toISOString()}] Client ${clientId} disconnected. Total clients: ${clients.size}`);
        
        // Notify other clients
        broadcast({
            type: 'peer-disconnected',
            clientId: clientId,
            totalClients: clients.size
        }, clientId);
    });
    
    ws.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error for client ${clientId}:`, error);
    });
});

// Broadcast message to all clients except the sender
function broadcast(message, excludeClientId) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client, clientId) => {
        if (clientId !== excludeClientId && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`WebRTC Signaling Server`);
    console.log(`========================================`);
    console.log(`WebSocket server listening on port ${PORT}`);
    console.log(`ws://localhost:${PORT}`);
    console.log(`========================================\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

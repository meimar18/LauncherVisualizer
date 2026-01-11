const dgram = require('dgram');
const WebSocket = require('ws');

// Create a UDP server
const udpServer = dgram.createSocket('udp4');
const PORT = 41234;

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8081 });

udpServer.on('message', (msg) => {
    console.log('Raw UDP message:', msg.toString());
    try {
        const data = JSON.parse(msg);
        console.log('Received UDP data:', data);

        // Broadcast the data to all WebSocket clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    } catch (error) {
        console.error('Error parsing UDP message:', error);
    }
});

udpServer.bind(PORT, () => {
    console.log(`UDP server listening on port ${PORT}`);
});

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('message', (message) => {
        console.log('Received message from WebSocket client:', message);
    });
});
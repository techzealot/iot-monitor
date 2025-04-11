import * as net from 'net';

const PORT = 8080;
const HOST = '127.0.0.1'; // Server host

// Create a new TCP client socket
const client = new net.Socket();

// Connect to the server
client.connect(PORT, HOST, () => {
    console.log(`[Client] Connected to server at ${HOST}:${PORT}`);

    // Send a message to the server
    const message = 'Hi from TCP client!';
    console.log(`[Client] Sending: ${message}`);
    client.write(message);
});

// 'data' listener: executes when data is received from the server
client.on('data', (data) => {
    console.log(`[Client] Received from server: ${data}`);
    // Since the server closes the connection after sending, 
    // we might receive the 'close' event shortly after this.
    // We can optionally destroy the client socket here if needed.
    // client.destroy(); 
});

// 'close' listener: executes when the server closes the connection
client.on('close', () => {
    console.log('[Client] Connection closed by server.');
});

// 'end' listener: (less common for client unless server calls socket.end() without writing)
client.on('end', () => {
    console.log('[Client] Server ended the connection gracefully (end packet).');
});

// 'error' listener: handles client socket errors
client.on('error', (err) => {
    console.error('[Client] Connection Error:', err);
    // Destroy the socket on error
    client.destroy();
});

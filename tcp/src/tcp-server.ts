import * as net from 'net';

const PORT = 8080;
const HOST = '0.0.0.0'; // Listen on localhost

// Create a new TCP server instance
const server = net.createServer((socket) => {
    // 'connection' listener: executes when a new client connects
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Server] Client connected: ${clientAddress}`);

    // Set encoding for received data (usually utf8 for text)
    socket.setEncoding('utf8');

    // 'data' listener: executes when data is received from the client
    socket.on('data', (data) => {
        console.log(`[Server] Received from ${clientAddress}: ${data}`);

        // Reply to the client
        const reply = 'hello, tcp client';
        console.log(`[Server] Sending to ${clientAddress}: ${reply}`);
        socket.write(reply);

        // Close the client connection after replying
        // .end() sends any remaining data and then closes the socket
        console.log(`[Server] Closing connection for ${clientAddress}`);
        socket.end();
    });

    // 'end' listener: executes when the client disconnects (client initiated .end())
    socket.on('end', () => {
        console.log(`[Server] Client disconnected: ${clientAddress}`);
    });

    // 'close' listener: executes when the socket is fully closed (either party)
    socket.on('close', (hadError) => {
        console.log(`[Server] Connection fully closed for ${clientAddress}${hadError ? ' due to transmission error' : ''}`);
    });

    // 'error' listener: handles socket errors
    socket.on('error', (err) => {
        console.error(`[Server] Socket Error for ${clientAddress}:`, err);
        // Ensure the socket is closed on error
        socket.destroy();
    });
});

// 'error' listener for the server itself (e.g., EADDRINUSE)
server.on('error', (err) => {
    console.error('[Server] Server Error:', err);
    throw err; // Optional: rethrow or handle specific errors like EADDRINUSE
});

// Start listening for connections
server.listen(PORT, HOST, () => {
    console.log(`[Server] TCP server listening on ${HOST}:${PORT}`);
});

// Handle server shutdown gracefully (e.g., on Ctrl+C)
process.on('SIGINT', () => {
    console.log('[Server] Shutting down server...');
    server.close(() => {
        console.log('[Server] Server closed.');
        process.exit(0);
    });

    // Force close remaining connections after a timeout if needed
    setTimeout(() => {
        console.error('[Server] Forcing shutdown after timeout.');
        process.exit(1);
    }, 5000); // 5 seconds timeout
});

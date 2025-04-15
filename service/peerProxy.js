const { WebSocketServer } = require('ws');

/**
 * Creates a WebSocket server that handles real-time communication between clients.
 * @param {http.Server} httpServer - The HTTP server to attach the WebSocket server to
 */
function peerProxy(httpServer) {
  // Create a new WebSocket server instance
  const socketServer = new WebSocketServer({ server: httpServer });

  // Handle new WebSocket connections
  socketServer.on('connection', (socket) => {
    // Mark the connection as alive
    socket.isAlive = true;

    // Log new connection
    console.log('New WebSocket connection established');

    // Handle incoming messages
    socket.on('message', function message(data) {
      try {
        // Parse the incoming message
        const message = JSON.parse(data);
        
        // Broadcast the message to all connected clients except the sender
        socketServer.clients.forEach((client) => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        // Send error back to the client
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Handle connection close
    socket.on('close', () => {
      console.log('WebSocket connection closed');
    });

    // Respond to pong messages by marking the connection alive
    socket.on('pong', () => {
      socket.isAlive = true;
    });
  });

  // Periodically check for dead connections
  const interval = setInterval(() => {
    socketServer.clients.forEach((client) => {
      if (client.isAlive === false) {
        console.log('Terminating dead WebSocket connection');
        return client.terminate();
      }

      client.isAlive = false;
      client.ping();
    });
  }, 10000);

  // Clean up interval when server is closed
  socketServer.on('close', () => {
    clearInterval(interval);
  });
}

module.exports = { peerProxy }; 
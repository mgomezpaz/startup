import React, { useEffect, useState } from 'react';
import WebSocketClient from '../utils/websocket';

const WebSocketDemo = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [wsClient, setWsClient] = useState(null);

  useEffect(() => {
    // Initialize WebSocket client
    const client = new WebSocketClient('ws://localhost:3000/ws');
    setWsClient(client);

    // Set up connection handlers
    client.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setError(null);
      }
    });

    // Set up error handlers
    client.onError((error) => {
      setError(error.message);
    });

    // Set up message handlers
    client.onMessage('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Connect to WebSocket server
    client.connect();

    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (wsClient && input.trim()) {
      wsClient.send('message', { content: input.trim() });
      setInput('');
    }
  };

  return (
    <div className="websocket-demo">
      <h2>WebSocket Demo</h2>
      
      <div className="connection-status">
        Status: {isConnected ? (
          <span className="connected">Connected</span>
        ) : (
          <span className="disconnected">Disconnected</span>
        )}
      </div>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className="message">
            {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected}>
          Send
        </button>
      </form>

      <style jsx>{`
        .websocket-demo {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .connection-status {
          margin-bottom: 10px;
        }

        .connected {
          color: green;
        }

        .disconnected {
          color: red;
        }

        .error {
          color: red;
          margin-bottom: 10px;
        }

        .messages {
          height: 300px;
          overflow-y: auto;
          border: 1px solid #ccc;
          padding: 10px;
          margin-bottom: 20px;
        }

        .message {
          margin-bottom: 5px;
          padding: 5px;
          background-color: #f0f0f0;
          border-radius: 4px;
        }

        form {
          display: flex;
          gap: 10px;
        }

        input {
          flex: 1;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        button {
          padding: 8px 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default WebSocketDemo; 
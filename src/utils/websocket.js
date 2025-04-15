/**
 * WebSocket client utility class for handling real-time communication
 */
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Map();
    this.connectionHandlers = new Set();
    this.errorHandlers = new Set();
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    try {
      this.socket = new WebSocket(this.url);
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleError(error);
    }
  }

  /**
   * Set up WebSocket event listeners
   */
  setupEventListeners() {
    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      this.reconnectAttempts = 0;
      this.connectionHandlers.forEach(handler => handler(true));
    };

    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
      this.connectionHandlers.forEach(handler => handler(false));
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.errorHandlers.forEach(handler => handler(error));
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handlers = this.messageHandlers.get(message.type) || [];
        handlers.forEach(handler => handler(message));
      } catch (error) {
        console.error('Error processing message:', error);
        this.handleError(error);
      }
    };
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.errorHandlers.forEach(handler => handler(new Error('Max reconnection attempts reached')));
    }
  }

  /**
   * Send a message to the WebSocket server
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  send(type, data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({ type, ...data });
        this.socket.send(message);
      } catch (error) {
        console.error('Error sending message:', error);
        this.handleError(error);
      }
    } else {
      console.warn('WebSocket is not connected');
      this.handleError(new Error('WebSocket is not connected'));
    }
  }

  /**
   * Add a message handler for a specific message type
   * @param {string} type - Message type to handle
   * @param {Function} handler - Handler function
   */
  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type).add(handler);
  }

  /**
   * Add a connection state change handler
   * @param {Function} handler - Handler function
   */
  onConnectionChange(handler) {
    this.connectionHandlers.add(handler);
  }

  /**
   * Add an error handler
   * @param {Function} handler - Handler function
   */
  onError(handler) {
    this.errorHandlers.add(handler);
  }

  /**
   * Handle errors
   * @param {Error} error - Error to handle
   */
  handleError(error) {
    this.errorHandlers.forEach(handler => handler(error));
  }

  /**
   * Close the WebSocket connection
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

export default WebSocketClient; 
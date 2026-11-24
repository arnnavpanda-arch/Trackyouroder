import { Server } from 'socket.io';
import { Order } from './models/Order.js';

let ioInstance = null;

export function initSocket(httpServer, clientOrigin) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    // console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Listen for agent GPS updates
    socket.on('agentLocation', async (data) => {
      if (!data || !data.orderId || data.lat == null || data.lng == null) return;
      try {
        const agentLoc = {
          lat: Number(data.lat),
          lng: Number(data.lng),
          isExact: Boolean(data.isExact),
          accuracy: data.accuracy || null,
          lastUpdate: Date.now(),
        };
        await Order.findOneAndUpdate({ id: data.orderId }, { $set: { agentLoc } });
        ioInstance.emit('agentLocationUpdated', {
          orderId: data.orderId,
          agentId: data.agentId,
          lat: Number(data.lat),
          lng: Number(data.lng),
          isExact: Boolean(data.isExact),
          accuracy: data.accuracy || null,
        });
      } catch (err) {
        console.error('Socket agentLocation error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      // console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

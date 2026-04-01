const { Server } = require('socket.io');
const logger = require('../utils/logger');

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    logger.debug('Socket connected', { id: socket.id });

    // Join a personal room keyed by userId (sent on connect)
    socket.on('join', ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        logger.debug('Socket joined room', { userId });
      }
    });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { id: socket.id });
    });
  });

  return io;
}

module.exports = { initSocket };

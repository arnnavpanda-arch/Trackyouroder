import { io } from 'socket.io-client';
import { MOCK } from '../utils/helpers';
import { bus } from './mock';

let real = null;
const getSocketUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5001`;
  }
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
};

// Returns an object exposing on / off / emit (socket.io-client or the demo bus).
export const getSocket = (token) => {
  if (MOCK) return bus;
  if (!real) real = io(getSocketUrl(), { auth: { token }, transports: ['websocket'] });
  return real;
};
export const closeSocket = () => { real?.disconnect(); real = null; };

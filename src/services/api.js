import axios from 'axios';
import { MOCK, TK } from '../utils/helpers';
import { mockApi } from './mock';

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return import.meta.env.VITE_API_URL || '/api';
};

export const http = axios.create({ baseURL: getApiBaseUrl(), timeout: 60000 });
http.interceptors.request.use((c) => {
  const t = sessionStorage.getItem(TK);
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
http.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401) {
    sessionStorage.removeItem(TK);
    const p = window.location.pathname || '';
    const isPublic = p === '/login' || p === '/register' || p === '/' || p.includes('/pay/demo') || p.startsWith('/track');
    if (!isPublic && !e.config?.url?.includes('/auth/login') && !e.config?.url?.includes('/auth/me')) {
      window.location.assign('/login');
    }
  }
  e.message = e.response?.data?.message || e.message;
  return Promise.reject(e);
});

const d = (r) => r.data;
const real = {
  login: (email, password) => http.post('/auth/login', { email, password }).then(d),
  register: (b) => http.post('/auth/register', b).then(d),
  me: () => http.get('/auth/me').then(d),
  publicStats: () => http.get('/orders/public-stats').then(d),
  listOrders: () => http.get('/orders').then(d),
  myOrders: () => http.get('/orders/my').then(d),
  assignedOrders: () => http.get('/orders/assigned').then(d),
  getOrder: (id) => http.get(`/orders/${id}`).then(d),
  createOrder: (b) => http.post('/orders', b).then(d),
  updateStatus: (id, status) => http.patch(`/orders/${id}/status`, { status }).then(d),
  assignAgent: (id, agentId) => http.patch(`/orders/${id}/assign`, { agentId }).then(d),
  listUsers: () => http.get('/users').then(d),
  saveUser: (u) => (u.id ? http.put(`/users/${u.id}`, u) : http.post('/users', u)).then(d),
  deleteUser: (id) => http.delete(`/users/${id}`).then(d),
  toggleUser: (id) => http.patch(`/users/${id}/toggle`).then(d),
  deleteOrder: (id) => http.delete(`/orders/${id}`).then(d),
  deleteAllOrders: () => http.delete('/orders/all').then(d),
  getPricing: () => http.get('/pricing').then(d),
  savePricing: (p) => http.post('/pricing', p).then(d),
  saveOffer: (offer) => http.post('/pricing/offer', offer).then(d),
  verifyPayment: (id, verified, b) => http.patch(`/orders/${id}/payment-verification`, { verified, ...b }).then(d),
  updateItemValue: (id, b) => http.patch(`/orders/${id}/item-value`, b).then(d),
  resubmitPayment: (id, b) => http.patch(`/orders/${id}/resubmit-payment`, b).then(d),
  cancelOrder: (id, b) => http.post(`/orders/${id}/cancel`, b).then(d),
  collectPickupPayment: (id, b) => http.post(`/orders/${id}/collect-payment`, b).then(d),
  updateOrderLocation: (id, b) => http.patch(`/orders/${id}/location`, b).then(d),
  resolveLocation: (input) => http.post('/orders/resolve-location', { input }).then(d),
  sendInvoiceEmail: (id) => http.post(`/orders/${id}/send-invoice`).then(d),
  sendDeliveredEmail: (id) => http.post(`/orders/${id}/send-delivered-email`).then(d),
  submitFeedback: (id, b) => http.post(`/orders/${id}/feedback`, b).then(d),
  getSettings: () => http.get('/settings').then(d),
  saveSettings: (s) => http.post('/settings', s).then(d),
};
export const api = MOCK ? mockApi : real;

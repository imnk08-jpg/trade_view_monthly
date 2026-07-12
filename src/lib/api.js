import { getAdminSession } from './session.js';

async function request(path, { method = 'GET', body, admin = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) {
    const session = getAdminSession();
    if (session) {
      headers['x-admin-phone'] = session.phone;
      headers['x-admin-pin'] = session.pin;
    }
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  checkPhone: (phone, pin) => request('/api/auth', { method: 'POST', body: { phone, pin } }),

  getUserByPhone: (phone) => request(`/api/users?phone=${encodeURIComponent(phone)}`),
  listUsers: () => request('/api/users', { admin: true }),
  createUser: (payload) => request('/api/users', { method: 'POST', body: payload, admin: true }),
  updateUser: (payload) => request('/api/users', { method: 'PUT', body: payload, admin: true }),
  removeUser: (id) => request(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE', admin: true }),

  getFeed: () => request('/api/feed'),

  listOverrides: () => request('/api/overrides'),
  addOverride: (payload) => request('/api/overrides', { method: 'POST', body: payload, admin: true }),
  removeOverride: (id) => request(`/api/overrides?id=${encodeURIComponent(id)}`, { method: 'DELETE', admin: true }),

  listMonthlyReturns: () => request('/api/monthly-returns'),
  upsertMonthlyReturn: (payload) => request('/api/monthly-returns', { method: 'POST', body: payload, admin: true }),
  removeMonthlyReturn: (id) =>
    request(`/api/monthly-returns?id=${encodeURIComponent(id)}`, { method: 'DELETE', admin: true }),

  getSettings: () => request('/api/settings'),
  updateSettings: (payload) => request('/api/settings', { method: 'PUT', body: payload, admin: true }),

  listAdmins: () => request('/api/admins', { admin: true }),
  addAdmin: (payload) => request('/api/admins', { method: 'POST', body: payload, admin: true }),
};

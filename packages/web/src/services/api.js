import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

// Track access token in memory (not localStorage)
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
          accessToken = data.accessToken;
          isRefreshing = false;
          onRefreshed(data.accessToken);
        } catch (refreshError) {
          isRefreshing = false;
          accessToken = null;
          window.dispatchEvent(new Event('auth:logout'));
          return Promise.reject(refreshError);
        }
      }

      return new Promise((resolve) => {
        refreshSubscribers.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

// API modules
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const charactersAPI = {
  list: () => api.get('/characters'),
  add: (data) => api.post('/characters', data),
  setPrimary: (id) => api.put(`/characters/${id}/primary`),
  remove: (id) => api.delete(`/characters/${id}`),
};

export const reportsAPI = {
  import: (url) => api.post('/reports/import', { url }),
  list: () => api.get('/reports'),
  get: (code) => api.get(`/reports/${code}`),
};

export const analysisAPI = {
  overview: (weeks = 8) => api.get(`/analysis/overview?weeks=${weeks}`),
  character: (id, weeks = 8) => api.get(`/analysis/character/${id}?weeks=${weeks}`),
  mplusHistory: (id, weeks = 12) => api.get(`/analysis/character/${id}/mplus-history?weeks=${weeks}`),
  build: (id) => api.get(`/analysis/character/${id}/build`),
};

export const publicAPI = {
  character: (region, realm, name, weeks = 8) =>
    api.get(`/public/character/${region}/${realm}/${name}?weeks=${weeks}`),
  mplusHistory: (region, realm, name, weeks = 12) =>
    api.get(`/public/character/${region}/${realm}/${name}/mplus-history?weeks=${weeks}`),
  build: (region, realm, name) =>
    api.get(`/public/character/${region}/${realm}/${name}/build`),
  meta: (className, spec) => api.get(`/public/meta/${encodeURIComponent(className)}/${encodeURIComponent(spec)}`),
};

export const guildsAPI = {
  list: () => api.get('/guilds'),
  create: (data) => api.post('/guilds', data),
  get: (id) => api.get(`/guilds/${id}`),
  join: (id, inviteCode) => api.post(`/guilds/${id}/join`, { inviteCode }),
  regenerateInviteCode: (id) => api.post(`/guilds/${id}/invite-code`),
  leave: (id) => api.post(`/guilds/${id}/leave`),
  updateMemberRole: (guildId, userId, role) => api.put(`/guilds/${guildId}/members/${userId}`, { role }),
  kickMember: (guildId, userId) => api.delete(`/guilds/${guildId}/members/${userId}`),
  updateSettings: (id, settings) => api.patch(`/guilds/${id}/settings`, settings),
};

export default api;

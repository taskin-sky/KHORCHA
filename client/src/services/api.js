import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', timeout: 15000 });
api.interceptors.request.use(config => { const token = localStorage.getItem('khorocha-token') || sessionStorage.getItem('khorocha-token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(r => r.data, error => { if (error.response?.status === 401 && !location.pathname.match(/^\/(login|register)/)) { localStorage.removeItem('khorocha-token'); sessionStorage.removeItem('khorocha-token'); location.assign('/login'); } return Promise.reject(error); });

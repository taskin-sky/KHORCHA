import axios from "axios";

export const API_BASE_URL = (
  import.meta.env.API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("khorocha-token") ||
    sessionStorage.getItem("khorocha-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (
      error.response?.status === 401 &&
      !location.pathname.match(/^\/(login|register)/)
    ) {
      localStorage.removeItem("khorocha-token");
      sessionStorage.removeItem("khorocha-token");
      location.assign("/login");
    }
    return Promise.reject(error);
  },
);

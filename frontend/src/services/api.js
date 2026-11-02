import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 90000,
  headers: { "Content-Type": "application/json" },
});

export const getHealth = () => api.get("/health").then((r) => r.data);

export const getStats = () => api.get("/stats").then((r) => r.data);

export const getTransactions = (params = {}) =>
  api.get("/transactions", { params }).then((r) => r.data);

export const getTransaction = (txnId) =>
  api.get(`/transactions/${txnId}`).then((r) => r.data);

export const getCycles = (params = {}) =>
  api.get("/cycles", { params }).then((r) => r.data);

export const getCycle = (id) => api.get(`/cycles/${id}`).then((r) => r.data);

export const updateCycleStatus = (id, status) =>
  api.patch(`/cycles/${id}/status`, { status }).then((r) => r.data);

export const getGraph = (params = {}) =>
  api.get("/graph", { params }).then((r) => r.data);

export const generateLedger = (payload) =>
  api.post("/generation/generate", payload).then((r) => r.data);

export const runDetection = (payload = { contamination: 0.03 }) =>
  api.post("/detection/run", payload).then((r) => r.data);

export const getErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.message ||
  "Something went wrong. Please try again.";

export default api;

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Auto-attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ─────────────────────────────────────────────────────────
export const registerUser = (email, password) =>
  api.post("/auth/register", { email, password });

export const loginUser = (email, password) =>
  api.post("/auth/login", { email, password });

// ── Stock ─────────────────────────────────────────────────────────
export const getStockOverview = (ticker) =>
  api.get(`/stock/${ticker}/overview`);

export const getStockTechnicals = (ticker) =>
  api.get(`/stock/${ticker}/technicals`);

// ── Signal ────────────────────────────────────────────────────────
export const getSignal = (ticker) =>
  api.get(`/signal/${ticker}`);

// ── Sentiment ─────────────────────────────────────────────────────
// Note: sentiment takes company name, not ticker (e.g. "Reliance Industries")
export const getSentiment = (company) =>
  api.get(`/sentiment/${company}`);

// ── Watchlist (protected) ─────────────────────────────────────────
export const getWatchlist = () =>
  api.get("/watchlist");

export const addToWatchlist = (ticker) =>
  api.post(`/watchlist/${ticker}`);

export const removeFromWatchlist = (ticker) =>
  api.delete(`/watchlist/${ticker}`);

// ── Portfolio (protected) ─────────────────────────────────────────
export const addHolding = (ticker, quantity, avg_buy_price) =>
  api.post("/portfolio/holding", { ticker, quantity, avg_buy_price });

export const removeHolding = (ticker) =>
  api.delete(`/portfolio/holding/${ticker}`);

export const getPortfolioAnalysis = () =>
  api.get("/portfolio/analyze");

export const optimizePortfolio = (tickers) =>
  api.post("/portfolio/optimize", { tickers });

// ── Paper Trading (protected) ─────────────────────────────────────
export const paperTrade = (ticker, action, quantity) =>
  api.post(`/paper/trade/${ticker}`, null, {
    params: { action, quantity },
  });

export const getPaperPortfolio = () =>
  api.get("/paper/portfolio");

// ── Health ────────────────────────────────────────────────────────
export const healthCheck = () =>
  api.get("/health");

export const getTechnicalSignal = (ticker) =>
  api.get(`/stock/${ticker}/technical-signal`);

export default api;
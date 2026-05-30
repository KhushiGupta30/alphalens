import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getWatchlist, removeFromWatchlist, getStockOverview } from "../api";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown } from "lucide-react";

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec });
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />;
}

function WatchlistCard({ item, onRemove, onNavigate }) {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockOverview(item.ticker)
      .then((res) => setStock(res.data))
      .catch(() => setStock(null))
      .finally(() => setLoading(false));
  }, [item.ticker]);

  const change = stock?.percent_change ?? stock?.change_pct;
  const isUp = change >= 0;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-300 transition-colors">
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      ) : (
        <div
          className="cursor-pointer"
          onClick={() => onNavigate(item.ticker)}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{item.ticker}</p>
              <p className="text-sm font-medium text-gray-700 leading-tight">
                {stock?.name || item.ticker}
              </p>
            </div>
            {change != null && (
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </div>

          <p className="text-2xl font-semibold text-gray-900 tabular-nums mb-3">
            ₹{fmt(stock?.current_price)}
          </p>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
            <div>
              <p className="text-xs text-gray-400">RSI</p>
              <p className="text-sm font-medium text-gray-700">{fmt(stock?.rsi)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">P/E</p>
              <p className="text-sm font-medium text-gray-700">{fmt(stock?.pe_ratio)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">52W High</p>
              <p className="text-sm font-medium text-gray-700">₹{fmt(stock?.week_52_high)}</p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(item.ticker); }}
        className="mt-4 flex items-center gap-1.5 text-xs text-gray-400
                   hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Remove
      </button>
    </div>
  );
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    getWatchlist()
      .then((res) => setWatchlist(res.data?.watchlist || []))
      .catch(() => setError("Could not load watchlist."))
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (ticker) => {
    try {
      await removeFromWatchlist(ticker);
      setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900">Watchlist</span>
        </div>
        <span className="text-xs text-gray-400">{watchlist.length} stocks</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {!loading && watchlist.length === 0 && !error && (
          <div className="text-center py-24">
            <p className="text-gray-400 mb-4">Your watchlist is empty.</p>
            <button
              onClick={() => navigate("/")}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Search stocks
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {watchlist.map((item) => (
              <WatchlistCard
                key={item.ticker}
                item={item}
                onRemove={handleRemove}
                onNavigate={(t) => navigate(`/dashboard/${t}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
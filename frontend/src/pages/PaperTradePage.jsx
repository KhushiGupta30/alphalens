import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPaperPortfolio, paperTrade } from "../api";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec });
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />;
}

export default function PaperTradePage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ticker: "", action: "BUY", quantity: "" });
  const [submitting, setSubmitting] = useState(false);
  const [lastTrade, setLastTrade] = useState(null);
  const navigate = useNavigate();

  const fetchPortfolio = () => {
    getPaperPortfolio()
      .then((res) => setPortfolio(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchPortfolio();
  }, []);

  const handleTrade = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLastTrade(null);
    try {
      const res = await paperTrade(
        form.ticker.toUpperCase(),
        form.action,
        parseInt(form.quantity)
      );
      setLastTrade(res.data);
      setForm({ ticker: "", action: "BUY", quantity: "" });
      fetchPortfolio();
    } catch (err) {
      alert(err.response?.data?.detail || "Trade failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900">Paper Trading</span>
        </div>
        {portfolio && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Virtual Balance</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              ₹{fmt(portfolio.balance)}
            </p>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Trade form */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-900 mb-4">Execute Trade</p>
          <form onSubmit={handleTrade} className="flex gap-3 flex-wrap">
            <input
              placeholder="Ticker (e.g. RELIANCE.NS)"
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              required
            />
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <input
              placeholder="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                form.action === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-red-500 hover:bg-red-400 text-white"
              }`}
            >
              {submitting ? "Executing..." : form.action}
            </button>
          </form>
        </div>

        {/* Last trade result */}
        {lastTrade && (
          <div className="bg-white border border-emerald-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Trade Executed</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Action", value: lastTrade.action },
                { label: "Market Price", value: `₹${fmt(lastTrade.market_price)}` },
                { label: "Executed Price", value: `₹${fmt(lastTrade.executed_price)}` },
                { label: "Slippage", value: `₹${fmt(lastTrade.slippage)}` },
                { label: "Fees", value: `₹${fmt(lastTrade.fees)}` },
                { label: "Total Cost", value: `₹${fmt(lastTrade.total_cost)}` },
                { label: "Quantity", value: lastTrade.quantity },
                { label: "Remaining Balance", value: `₹${fmt(lastTrade.remaining_balance)}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-800 tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade history */}
        {loading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Trade History</p>
              <span className="text-xs text-gray-400">{portfolio?.trades_count || 0} trades</span>
            </div>
            {!portfolio?.trades?.length ? (
              <p className="text-sm text-gray-400 text-center py-8">No trades yet. Execute your first trade above.</p>
            ) : (
              <div className="space-y-2">
                {portfolio.trades.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        t.action === "BUY" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {t.action === "BUY"
                          ? <TrendingUp className="w-3 h-3" />
                          : <TrendingDown className="w-3 h-3" />}
                        {t.action}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{t.ticker}</span>
                      <span className="text-xs text-gray-400">{t.quantity} shares</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 tabular-nums">₹{fmt(t.total_cost)}</p>
                      <p className="text-xs text-gray-400">@ ₹{fmt(t.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
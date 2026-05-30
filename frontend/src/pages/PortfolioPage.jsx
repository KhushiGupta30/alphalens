import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getPortfolioAnalysis, addHolding, removeHolding } from "../api";
import {
  ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown,
  Pencil, X, Sparkles, ChevronDown, ChevronUp, BarChart3,
  Wallet, Activity, Target
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import api from "../api";

/* ── helpers ───────────────────────────────────────────── */
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec });
}

function pct(n) {
  if (n == null || isNaN(n)) return "—";
  const val = Number(n) * 100;
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

/* ── Skeleton ───────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

/* ── Modal backdrop ─────────────────────────────────────── */
function Modal({ onClose, children }) {
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 relative animate-modal-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-300 hover:text-gray-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ── HoldingCard ────────────────────────────────────────── */
function HoldingCard({ h, analysis, onEdit, onRemove }) {
  const currentPrice = analysis?.current_prices?.[h.ticker] ?? null;
  const pnl = analysis?.pnl_per_stock?.[h.ticker] ?? null;
  const allocation = analysis?.current_allocation?.[h.ticker] ?? null;
  const isUp = pnl != null ? pnl >= 0 : null;
  const pnlPct = currentPrice != null
    ? ((currentPrice - h.avg_buy_price) / h.avg_buy_price) * 100
    : null;

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-gray-200 transition-all duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900 tracking-tight">{h.ticker}</span>
            {isUp != null && (
              <span className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
              }`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {pnlPct != null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{h.quantity} shares · avg ₹{fmt(h.avg_buy_price)}</p>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(h)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemove(h.ticker)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Price row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Current</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">
            {currentPrice != null ? `₹${fmt(currentPrice)}` : "—"}
          </p>
        </div>
        <div className={`rounded-xl px-3 py-2 ${
          pnl == null ? "bg-gray-50" : pnl >= 0 ? "bg-emerald-50" : "bg-red-50"
        }`}>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">P&L</p>
          <p className={`text-sm font-semibold tabular-nums ${
            pnl == null ? "text-gray-400" : pnl >= 0 ? "text-emerald-600" : "text-red-500"
          }`}>
            {pnl != null ? `${pnl >= 0 ? "+" : ""}₹${fmt(Math.abs(pnl))}` : "—"}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Weight</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">
            {allocation != null ? `${(allocation * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── AllocationPie ──────────────────────────────────────── */
function AllocationPie({ title, weights }) {
  if (!weights) return null;
  const data = Object.entries(weights)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }));
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%" outerRadius={75} innerRadius={35}
            label={({ name, value }) => `${name.split(".")[0]} ${value}%`} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => `${v}%`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── OptimizeCard ───────────────────────────────────────── */
function OptimizeCard({ analysis }) {
  const [open, setOpen] = useState(false);
  if (!analysis?.optimized_allocation) return null;

  const currentSharpe = analysis.current_performance?.sharpe_ratio;
  const optimizedSharpe = analysis.optimized_performance?.sharpe_ratio;
  const improvement = currentSharpe != null && optimizedSharpe != null
    ? ((optimizedSharpe - currentSharpe) / Math.abs(currentSharpe)) * 100
    : null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Portfolio Optimization</p>
            <p className="text-xs text-gray-500">
              {improvement != null
                ? `Sharpe ratio can improve by ~${improvement.toFixed(0)}%`
                : "View suggested rebalancing"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {improvement != null && improvement > 0 && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
              +{improvement.toFixed(0)}%
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-indigo-100">
          {/* Metrics comparison */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              {
                label: "Current Return",
                value: pct(analysis.current_performance?.expected_annual_return),
                sub: "Annual expected",
              },
              {
                label: "Optimized Return",
                value: pct(analysis.optimized_performance?.expected_annual_return),
                sub: "Annual expected",
                highlight: true,
              },
              {
                label: "Current Volatility",
                value: pct(analysis.current_performance?.annual_volatility),
                sub: "Annual risk",
              },
              {
                label: "Optimized Volatility",
                value: pct(analysis.optimized_performance?.annual_volatility),
                sub: "Annual risk",
                highlight: true,
              },
            ].map(({ label, value, sub, highlight }) => (
              <div key={label} className={`rounded-xl px-4 py-3 ${highlight ? "bg-indigo-50 border border-indigo-100" : "bg-white border border-gray-100"}`}>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-base font-semibold tabular-nums ${highlight ? "text-indigo-700" : "text-gray-800"}`}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Suggested weights */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">Suggested Allocation</p>
            <div className="space-y-2">
              {Object.entries(analysis.optimized_allocation)
                .sort(([, a], [, b]) => b - a)
                .map(([ticker, weight], i) => {
                  const current = analysis.current_allocation?.[ticker] ?? 0;
                  const diff = (weight - current) * 100;
                  const reasonData = analysis.signal_reasons?.[ticker];
                  return (
                    <div key={ticker} className="mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-gray-600 w-28 truncate">{ticker.split(".")[0]}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(weight * 100).toFixed(1)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 tabular-nums w-10 text-right">
                          {(weight * 100).toFixed(1)}%
                        </span>
                        <span className={`text-[10px] font-medium tabular-nums w-12 text-right ${
                          diff > 0.5 ? "text-emerald-600" : diff < -0.5 ? "text-red-500" : "text-gray-400"
                        }`}>
                          {diff > 0.5 ? `+${diff.toFixed(1)}%` : diff < -0.5 ? `${diff.toFixed(1)}%` : "≈"}
                        </span>
                      </div>
                      {reasonData?.reasons?.length > 0 && (
                        <div className="ml-5 mt-1 space-y-0.5">
                          {reasonData.reasons.map((r, j) => (
                            <p key={j} className="text-[10px] text-gray-400 leading-relaxed">· {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── HoldingFormModal ───────────────────────────────────── */
function HoldingFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(
    initial
      ? { ticker: initial.ticker, quantity: String(initial.quantity), avg_buy_price: String(initial.avg_buy_price) }
      : { ticker: "", quantity: "", avg_buy_price: "" }
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form.ticker.toUpperCase(), parseInt(form.quantity), parseFloat(form.avg_buy_price));
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900 mb-5">
        {initial ? `Edit ${initial.ticker}` : "Add Holding"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Ticker</label>
          <input
            placeholder="e.g. RELIANCE.NS"
            value={form.ticker}
            onChange={(e) => setForm({ ...form, ticker: e.target.value })}
            disabled={!!initial}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Quantity</label>
            <input
              placeholder="100"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Avg Buy Price (₹)</label>
            <input
              placeholder="1400.00"
              type="number"
              step="0.01"
              value={form.avg_buy_price}
              onChange={(e) => setForm({ ...form, avg_buy_price: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-2 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {submitting ? (initial ? "Saving..." : "Adding...") : (initial ? "Save Changes" : "Add Holding")}
        </button>
      </form>
    </Modal>
  );
}

/* ── Main Page ──────────────────────────────────────────── */
export default function PortfolioPage() {
  const [holdings, setHoldings] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | "add" | {editing: holdingObj}
  const navigate = useNavigate();

  const fetchHoldings = () => {
    setLoadingHoldings(true);
    api.get("/portfolio/holdings")
      .then((res) => setHoldings(res.data?.holdings || []))
      .catch(() => setHoldings([]))
      .finally(() => setLoadingHoldings(false));
  };

  const fetchAnalysis = (holdingsList) => {
    if (!holdingsList || holdingsList.length < 2) { setAnalysis(null); return; }
    setLoadingAnalysis(true);
    getPortfolioAnalysis()
      .then((res) => setAnalysis(res.data))
      .catch((err) => {
        if (err.response?.status !== 400) setError("Could not load analysis.");
        setAnalysis(null);
      })
      .finally(() => setLoadingAnalysis(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchHoldings();
  }, []);

  useEffect(() => {
    if (!loadingHoldings) fetchAnalysis(holdings);
  }, [holdings, loadingHoldings]);

  const refresh = () => fetchHoldings();

  const handleAdd = async (ticker, quantity, avg_buy_price) => {
    await addHolding(ticker, quantity, avg_buy_price);
    refresh();
  };

  const handleEdit = async (ticker, quantity, avg_buy_price) => {
    // Remove and re-add with new values — adjust if your API has a PATCH endpoint
    await removeHolding(ticker);
    await addHolding(ticker, quantity, avg_buy_price);
    refresh();
  };

  const handleRemove = async (ticker) => {
    try { await removeHolding(ticker); refresh(); } catch (e) { console.error(e); }
  };

  /* Summary stats */
  const totalValue = analysis?.total_portfolio_value;
  const totalPnl = analysis?.total_pnl;
  const sharpe = analysis?.current_performance?.sharpe_ratio;

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-in { animation: modal-in 0.18s ease-out; }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900">Portfolio</span>
        </div>
        <button
          onClick={() => setModal("add")}
          className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Holding
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-5">

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {/* Summary strip — shown once analysis loaded */}
        {analysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <Wallet className="w-4 h-4" />, label: "Portfolio Value", value: `₹${fmt(totalValue)}`, color: "text-gray-900" },
              {
                icon: totalPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
                label: "Total P&L",
                value: `${totalPnl >= 0 ? "+" : ""}₹${fmt(Math.abs(totalPnl))}`,
                color: totalPnl >= 0 ? "text-emerald-600" : "text-red-500",
              },
              { icon: <Activity className="w-4 h-4" />, label: "Sharpe Ratio", value: fmt(sharpe), color: "text-gray-900" },
              { icon: <BarChart3 className="w-4 h-4" />, label: "Holdings", value: holdings.length, color: "text-gray-900" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{label}</p>
                  <p className={`text-base font-semibold tabular-nums ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Holdings */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">
            Holdings {holdings.length > 0 && `(${holdings.length})`}
          </p>
          {loadingHoldings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : holdings.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Target className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No holdings yet.</p>
              <p className="text-xs text-gray-300 mt-1">Add your first stock to get started.</p>
              <button
                onClick={() => setModal("add")}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                + Add holding
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {holdings.map((h) => (
                <HoldingCard
                  key={h.ticker}
                  h={h}
                  analysis={analysis}
                  onEdit={(h) => setModal({ editing: h })}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Optimize card */}
        {holdings.length >= 2 && !loadingAnalysis && (
          <OptimizeCard analysis={analysis} />
        )}

        {holdings.length < 2 && !loadingHoldings && holdings.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center">
            <p className="text-sm text-gray-400">Add at least 2 holdings to unlock portfolio analysis and optimization.</p>
          </div>
        )}

        {/* Allocation pies */}
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AllocationPie title="Current Allocation" weights={analysis.current_allocation} />
            <AllocationPie title="Optimized Allocation" weights={analysis.optimized_allocation} />
          </div>
        )}

        {loadingAnalysis && holdings.length >= 2 && (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-56" />
          </div>
        )}
      </main>

      {/* Modals */}
      {modal === "add" && (
        <HoldingFormModal
          onClose={() => setModal(null)}
          onSubmit={handleAdd}
        />
      )}
      {modal?.editing && (
        <HoldingFormModal
          initial={modal.editing}
          onClose={() => setModal(null)}
          onSubmit={(ticker, qty, price) => handleEdit(ticker, qty, price)}
        />
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getPaperPortfolio, paperTrade } from "../api";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Activity, Clock } from "lucide-react";

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec });
}



function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-2xl ${className}`} />;
}

/* ── WebSocket live prices ───────────────────────────────── */
function useLivePrices(tickers) {
  const [prices, setPrices] = useState({});
  const socketsRef = useRef({});

  useEffect(() => {
    Object.values(socketsRef.current).forEach((ws) => ws.close());
    socketsRef.current = {};

    tickers.forEach((ticker) => {
      const ws = new WebSocket(`ws://localhost:8000/ws/live/${ticker}`);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setPrices((prev) => ({ ...prev, [data.ticker]: data }));
        } catch {}
      };
      socketsRef.current[ticker] = ws;
    });

    return () => Object.values(socketsRef.current).forEach((ws) => ws.close());
  }, [tickers.join(",")]);

  return prices;
}

/* ── Stat card ───────────────────────────────────────────── */
function StatCard({ icon, label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-base font-semibold tabular-nums ${color}`}>{value}</p>
      </div>
    </div>
  );
}

/* ── Trade confirmation flash ────────────────────────────── */
function TradeFlash({ trade, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, []);

  const isBuy = trade.action === "BUY";
  return (
    <div className={`border rounded-2xl p-5 ${isBuy ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isBuy ? "bg-emerald-500" : "bg-red-500"}`}>
            {isBuy ? <TrendingUp className="w-3.5 h-3.5 text-white" /> : <TrendingDown className="w-3.5 h-3.5 text-white" />}
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {trade.action} {trade.ticker} — Executed
          </span>
        </div>
        <button onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600">dismiss</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Qty",          value: `${trade.quantity} shares` },
          { label: "Price",        value: `₹${fmt(trade.executed_price)}` },
          { label: "Slippage",     value: `₹${fmt(trade.slippage)}` },
          { label: "Fees",         value: `₹${fmt(trade.fees)}` },
          { label: "Total",        value: `₹${fmt(trade.total_cost)}` },
          { label: "Balance left", value: `₹${fmt(trade.remaining_balance)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/70 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-800 tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Open positions ──────────────────────────────────────── */
function HoldingsTable({ holdings, livePrices }) {
  if (!holdings || Object.keys(holdings).length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Open Positions</p>
        <span className="flex items-center gap-1 text-[10px] text-emerald-500">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Live
        </span>
      </div>
      <div className="space-y-0">
        {Object.entries(holdings).map(([ticker, h]) => {
          const liveData     = livePrices?.[ticker];
          const displayPrice = liveData?.price ?? h.current_price;
          const currentVal   = displayPrice != null ? Math.round(displayPrice * h.quantity * 100) / 100 : h.current_value;
          const pnl          = displayPrice != null ? Math.round((currentVal - h.cost_basis) * 100) / 100 : h.unrealized_pnl;
          const changePct    = liveData?.change_pct;
          const isUp         = pnl != null ? pnl >= 0 : null;

          return (
            <div key={ticker} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{ticker.split(".")[0]}</span>
                  {changePct != null && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      changePct >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                    }`}>
                      {changePct >= 0 ? "+" : ""}{changePct}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {h.quantity} shares · avg ₹{fmt(h.avg_price)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {currentVal != null ? `₹${fmt(currentVal)}` : "—"}
                </p>
                {pnl != null && (
                  <p className={`text-xs tabular-nums ${isUp ? "text-emerald-600" : "text-red-500"}`}>
                    {pnl >= 0 ? "+" : ""}₹{fmt(Math.abs(pnl))}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function PaperTradePage() {
  const [portfolio, setPortfolio]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState({ ticker: "", action: "BUY", quantity: "" });
  const [submitting, setSubmitting] = useState(false);
  const [lastTrade, setLastTrade]   = useState(null);
  const navigate = useNavigate();

  const openTickers = portfolio?.holdings ? Object.keys(portfolio.holdings) : [];
  const livePrices  = useLivePrices(openTickers);

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
      const res = await paperTrade(form.ticker.toUpperCase(), form.action, parseInt(form.quantity));
      setLastTrade({ ...res.data, ticker: form.ticker.toUpperCase() });
      setForm({ ticker: "", action: "BUY", quantity: "" });
      fetchPortfolio();
    } catch (err) {
      alert(err.response?.data?.detail || "Trade failed");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPnl   = portfolio?.total_unrealized_pnl ?? null;
  const totalValue = portfolio?.total_portfolio_value ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900">Paper Trading</span>
        </div>
        {portfolio && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Cash Balance</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">₹{fmt(portfolio.balance)}</p>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* Summary strip */}
        {portfolio && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              icon={<Wallet className="w-4 h-4" />}
              label="Portfolio Value"
              value={totalValue != null ? `₹${fmt(totalValue)}` : `₹${fmt(portfolio.balance)}`}
            />
            <StatCard
              icon={totalPnl != null && totalPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              label="Unrealized P&L"
              value={totalPnl != null ? `${totalPnl >= 0 ? "+" : ""}₹${fmt(Math.abs(totalPnl))}` : "—"}
              color={totalPnl == null ? "text-gray-900" : totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}
            />
            <StatCard
              icon={<Activity className="w-4 h-4" />}
              label="Total Trades"
              value={portfolio.trades_count ?? portfolio.trades?.length ?? 0}
            />
          </div>
        )}

        {/* Trade form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4">Execute Trade</p>
          <form onSubmit={handleTrade} className="flex gap-3 flex-wrap">
            <input
              placeholder="Ticker (e.g. RELIANCE.NS)"
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="flex-1 min-w-40 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              required
            />
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <input
              placeholder="Qty"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                form.action === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-red-500 hover:bg-red-400 text-white"
              }`}
            >
              {submitting ? "Executing..." : form.action}
            </button>
          </form>
        </div>

        {/* Trade flash */}
        {lastTrade && <TradeFlash trade={lastTrade} onDismiss={() => setLastTrade(null)} />}

        {/* Open positions */}
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <HoldingsTable holdings={portfolio?.holdings} livePrices={livePrices} />
        )}

        {/* Trade history */}
        {loading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Trade History</p>
              <span className="text-xs text-gray-400">
                {portfolio?.trades_count ?? portfolio?.trades?.length ?? 0} trades
              </span>
            </div>

            {!portfolio?.trades?.length ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">No trades yet.</p>
                <p className="text-xs text-gray-300 mt-1">Execute your first trade above.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {portfolio.trades.map((t, i) => {
                  const isBuy = t.action === "BUY";
                  return (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isBuy ? "bg-emerald-50" : "bg-red-50"
                      }`}>
                        {isBuy
                          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{t.ticker}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isBuy ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                          }`}>{t.action}</span>
                          <span className="text-xs text-gray-400">{t.quantity} shares</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-300" />
                          <span className="text-[10px] text-gray-400">{t.timestamp}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">
                          ₹{fmt(t.total_cost)}
                        </p>
                        <p className="text-[10px] text-gray-400 tabular-nums">
                          @ ₹{fmt(t.price)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
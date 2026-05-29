import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getStockOverview,
  getStockTechnicals,
  getSignal,
  getSentiment,
  getTechnicalSignal,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
} from "../api";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, Brush,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Minus,
         BookmarkPlus, BookmarkCheck, AlertCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────

function TechnicalSignalCard({ data, loading }) {
  if (loading) return <Skeleton className="h-36" />;
  if (!data) return null;

  const isBuy = data.decision === "BUY";
  const isSell = data.decision === "SELL";
  

  return (
    <div className={`rounded-xl border p-5 ${
      isBuy ? "border-emerald-200 bg-emerald-50" :
      isSell ? "border-red-200 bg-red-50" :
      "border-gray-200 bg-gray-50"
    }`}>
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Technical Signal</p>
      <div className="flex items-center gap-3 mb-2">
        {isBuy && <TrendingUp className="text-emerald-500 w-8 h-8" />}
        {isSell && <TrendingDown className="text-red-500 w-8 h-8" />}
        {!isBuy && !isSell && <Minus className="text-gray-400 w-8 h-8" />}
        <span className={`text-3xl font-bold ${
          isBuy ? "text-emerald-600" : isSell ? "text-red-600" : "text-gray-600"
        }`}>
          {data.decision}
        </span>
      </div>
      <div className="space-y-0.5 mb-2">
        {data.reasons?.map((r, i) => (
          <p key={i} className="text-xs text-gray-500">· {r}</p>
        ))}
      </div>
      {data.disclaimer && (
        <p className="text-xs text-gray-400 mt-2 flex gap-1.5 items-start">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {data.disclaimer}
        </p>
      )}
    </div>
  );
}

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec });
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short",
  });
}

// Skeleton loader block
function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
  );
}

// ── Signal Card ───────────────────────────────────────────────────

function SignalCard({ data, loading }) {
  if (loading) return <Skeleton className="h-36" />;
  if (!data) return null;

  const isUp = data.signal === "UP";
  const isDown = data.signal === "DOWN";
  const [techSignal, setTechSignal] = useState(null);

  return (
    <div className={`rounded-xl border p-5 ${
      isUp ? "border-emerald-200 bg-emerald-50" :
      isDown ? "border-red-200 bg-red-50" :
      "border-gray-200 bg-gray-50"
    }`}>
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">ML Signal</p>
      <div className="flex items-center gap-3 mb-2">
        {isUp && <TrendingUp className="text-emerald-500 w-8 h-8" />}
        {isDown && <TrendingDown className="text-red-500 w-8 h-8" />}
        {!isUp && !isDown && <Minus className="text-gray-400 w-8 h-8" />}
        <span className={`text-3xl font-bold ${
          isUp ? "text-emerald-600" : isDown ? "text-red-600" : "text-gray-600"
        }`}>
          {data.signal}
        </span>
      </div>
      <p className="text-sm text-gray-500">
        Confidence: <span className="font-medium text-gray-700">
          {(data.confidence * 100).toFixed(1)}%
        </span>
      </p>
      {data.disclaimer && (
        <p className="text-xs text-gray-400 mt-2 flex gap-1.5 items-start">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {data.disclaimer}
        </p>
      )}
    </div>
  );
}

// ── Sentiment Card ────────────────────────────────────────────────

function SentimentCard({ data, loading }) {
  if (loading) return <Skeleton className="h-36" />;
  if (!data) return null;

  const score = data.aggregate_score;
  const isPos = data.overall_sentiment === "positive";
  const isNeg = data.overall_sentiment === "negative";

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">News Sentiment</p>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-3xl font-bold ${
          isPos ? "text-emerald-600" : isNeg ? "text-red-600" : "text-gray-600"
        }`}>
          {score != null ? score.toFixed(3) : "—"}
        </span>
        <span className={`text-sm font-medium capitalize ${
          isPos ? "text-emerald-500" : isNeg ? "text-red-500" : "text-gray-400"
        }`}>
          {data.overall_sentiment}
        </span>
      </div>
      {/* Score bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
        <div
          className={`h-1.5 rounded-full transition-all ${
            isPos ? "bg-emerald-400" : isNeg ? "bg-red-400" : "bg-gray-400"
          }`}
          style={{ width: `${Math.min(Math.abs(score || 0) * 100, 100)}%` }}
        />
      </div>
      {/* Headlines preview */}
      {data.headlines?.slice(0, 3).map((h, i) => (
  <p key={i} className="text-xs text-gray-500 truncate mb-1">
    · {typeof h === "string" ? h : h.title}
  </p>
))}
    </div>
  );
}

// ── Overview Card ─────────────────────────────────────────────────

function OverviewCard({ data, loading }) {
  if (loading) return <Skeleton className="h-28" />;
  if (!data) return null;

  const change = data.percent_change ?? data.change_pct;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs text-gray-400">{data.company_name || data.ticker}</p>
          <p className="text-3xl font-semibold text-gray-900 tabular-nums mt-1">
            ₹{fmt(data.current_price)}
          </p>
        </div>
        <span className={`text-sm font-medium px-2.5 py-1 rounded-lg ${
          change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        }`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
        {[
          { label: "52W High", value: `₹${fmt(data.week_52_high)}` },
          { label: "52W Low", value: `₹${fmt(data.week_52_low)}` },
          { label: "P/E Ratio", value: fmt(data.pe_ratio) },
          { label: "RSI (14)", value: fmt(data.rsi) },
          { label: "MACD", value: fmt(data.macd) },
          { label: "Volume", value: fmt(data.volume, 0) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-medium text-gray-800 tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────
// ── Charts ────────────────────────────────────────────────────────

const INDICATORS = ["RSI", "MACD", "EMA", "SMA", "Bollinger"];

function PriceChart({ data, loading }) {
  if (loading) return <Skeleton className="h-64" />;
  if (!data?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Price — 200 days</p>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }}
                 interval={29} stroke="#e5e7eb" />
          <YAxis tick={{ fontSize: 11 }} stroke="#e5e7eb"
       tickFormatter={(v) => `₹${fmt(v, 0)}`} width={70}
       domain={['auto', 'auto']} />
          <Tooltip formatter={(v) => [`₹${fmt(v)}`, "Close"]}
                   labelFormatter={fmtDate}
                   contentStyle={{ fontSize: 12, border: "1px solid #e5e7eb" }} />
          <Area type="monotone" dataKey="close" stroke="#10b981"
                strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SignalBadge({ decision }) {
  if (!decision) return null;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
      decision === "BUY" ? "bg-emerald-100 text-emerald-700" :
      decision === "SELL" ? "bg-red-100 text-red-700" :
      "bg-gray-100 text-gray-600"
    }`}>{decision}</span>
  );
}

// ── Indicator Charts (tall, with Brush for zoom/pan) ──────────────

function RSIIndicatorChart({ data, signal }) {
  const rsi = signal?.indicators?.rsi;
  const decision = rsi < 30 ? "BUY" : rsi > 70 ? "SELL" : "HOLD";
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">RSI (14)</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Above 70 = overbought · Below 30 = oversold
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rsi && <span className="text-sm font-medium text-gray-700 tabular-nums">{rsi.toFixed(1)}</span>}
          <SignalBadge decision={decision} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }}
                 interval={19} stroke="#e5e7eb" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#e5e7eb" width={35} />
          <Tooltip formatter={(v) => [fmt(v), "RSI"]} labelFormatter={fmtDate}
                   contentStyle={{ fontSize: 12 }} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4"
                         label={{ value: "Overbought 70", fontSize: 10, fill: "#ef4444", position: "insideTopRight" }} />
          <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4"
                         label={{ value: "Oversold 30", fontSize: 10, fill: "#10b981", position: "insideBottomRight" }} />
          <Line type="monotone" dataKey="rsi" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Brush dataKey="date" height={24} stroke="#e5e7eb" tickFormatter={fmtDate}
                 fill="#f9fafb" travellerWidth={6} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MACDIndicatorChart({ data, signal }) {
  const macd = signal?.indicators?.macd;
  const macdSig = signal?.indicators?.macd_signal;
  const decision = macd != null && macdSig != null
    ? (macd > macdSig ? "BUY" : macd < macdSig ? "SELL" : "HOLD") : null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">MACD (12, 26, 9)</p>
          <p className="text-xs text-gray-400 mt-0.5">
            MACD above signal = bullish · below = bearish
          </p>
        </div>
        <div className="flex items-center gap-2">
          {macd != null && (
            <span className="text-xs text-gray-500 tabular-nums">
              {macd.toFixed(2)} / {macdSig.toFixed(2)}
            </span>
          )}
          <SignalBadge decision={decision} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }}
                 interval={19} stroke="#e5e7eb" />
          <YAxis tick={{ fontSize: 11 }} stroke="#e5e7eb" width={50} />
          <Tooltip labelFormatter={fmtDate} contentStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Bar dataKey="macd_histogram" fill="#d1d5db" name="Histogram" />
          <Line type="monotone" dataKey="macd" stroke="#6366f1"
                strokeWidth={2} dot={false} name="MACD" />
          <Line type="monotone" dataKey="macd_signal" stroke="#f59e0b"
                strokeWidth={2} dot={false} name="Signal" />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Brush dataKey="date" height={24} stroke="#e5e7eb" tickFormatter={fmtDate}
                 fill="#f9fafb" travellerWidth={6} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function EMAIndicatorChart({ data, signal }) {
  // EMA12 crossing above EMA26 = BUY, below = SELL
  const last = data[data.length - 1];
  const ema12 = last?.ema12;
  const ema26 = last?.ema26;
  const decision = ema12 != null && ema26 != null
    ? ema12 > ema26 ? "BUY" : ema12 < ema26 ? "SELL" : "HOLD"
    : null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">EMA 12 / 26</p>
          <p className="text-xs text-gray-400 mt-0.5">
            EMA 12 above EMA 26 = bullish momentum
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-violet-500 inline-block rounded" /> EMA 12
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-orange-400 inline-block rounded" /> EMA 26
            </span>
          </div>
          <SignalBadge decision={decision} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }}
                 interval={19} stroke="#e5e7eb" />
          <YAxis tick={{ fontSize: 11 }} stroke="#e5e7eb"
       tickFormatter={(v) => `₹${fmt(v, 0)}`} width={70}
       domain={['auto', 'auto']} />
          <Tooltip labelFormatter={fmtDate}
                   formatter={(v, name) => [`₹${fmt(v)}`, name]}
                   contentStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="close" stroke="#10b981"
                strokeWidth={1} dot={false} name="Price" opacity={0.3} />
          <Line type="monotone" dataKey="ema12" stroke="#8b5cf6"
                strokeWidth={2} dot={false} name="EMA 12" />
          <Line type="monotone" dataKey="ema26" stroke="#f97316"
                strokeWidth={2} dot={false} name="EMA 26" />
          <Brush dataKey="date" height={24} stroke="#e5e7eb" tickFormatter={fmtDate}
                 fill="#f9fafb" travellerWidth={6} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SMAIndicatorChart({ data, signal }) {
  const sma50 = signal?.indicators?.sma_50;
  const sma200 = signal?.indicators?.sma_200;
  const crossDecision = sma50 && sma200 ? (sma50 > sma200 ? "BUY" : "SELL") : null;
  const crossLabel = crossDecision === "BUY" ? "⚡ Golden Cross" : "☠ Death Cross";
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">SMA 50 / 200</p>
          {crossDecision && (
            <p className={`text-xs font-medium mt-0.5 ${
              crossDecision === "BUY" ? "text-emerald-500" : "text-red-500"
            }`}>{crossLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> SMA 50
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-red-400 inline-block rounded" /> SMA 200
            </span>
          </div>
          <SignalBadge decision={crossDecision} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }}
                 interval={19} stroke="#e5e7eb" />
          <YAxis tick={{ fontSize: 11 }} stroke="#e5e7eb"
       tickFormatter={(v) => `₹${fmt(v, 0)}`} width={70}
       domain={['auto', 'auto']} />
          <Tooltip labelFormatter={fmtDate}
                   formatter={(v, name) => [`₹${fmt(v)}`, name]}
                   contentStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="close" stroke="#10b981"
                strokeWidth={1} dot={false} name="Price" opacity={0.3} />
          <Line type="monotone" dataKey="sma50" stroke="#60a5fa"
                strokeWidth={2} dot={false} name="SMA 50" />
          <Line type="monotone" dataKey="sma200" stroke="#f87171"
                strokeWidth={2} dot={false} name="SMA 200" />
          <Brush dataKey="date" height={24} stroke="#e5e7eb" tickFormatter={fmtDate}
                 fill="#f9fafb" travellerWidth={6} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BollingerIndicatorChart({ data }) {
  const last = data[data.length - 1];
  const price = last?.close;
  const upper = last?.bb_upper;
  const lower = last?.bb_lower;
  const mid = last?.bb_mid;

  // Price near upper band = SELL, near lower = BUY
  let decision = null;
  if (price != null && upper != null && lower != null) {
    const range = upper - lower;
    const pos = (price - lower) / range;
    decision = pos > 0.85 ? "SELL" : pos < 0.15 ? "BUY" : "HOLD";
  }

  const bbWidth = upper != null && lower != null && mid != null
    ? ((upper - lower) / mid * 100).toFixed(1) : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Bollinger Bands (20, 2σ)</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {bbWidth ? `Band width ${bbWidth}% · ` : ""}
            Price near upper = overbought · near lower = oversold
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-300 inline-block rounded" /> Bands
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" /> Price
            </span>
          </div>
          <SignalBadge decision={decision} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }}
                 interval={19} stroke="#e5e7eb" />
          <YAxis tick={{ fontSize: 11 }} stroke="#e5e7eb"
       tickFormatter={(v) => `₹${fmt(v, 0)}`} width={70}
       domain={['auto', 'auto']} />
          <Tooltip labelFormatter={fmtDate}
                   formatter={(v, name) => [`₹${fmt(v)}`, name]}
                   contentStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="bb_upper" fill="#eef2ff"
                stroke="#a5b4fc" strokeWidth={1} dot={false} name="Upper" />
          <Area type="monotone" dataKey="bb_lower" fill="#fff"
                stroke="#a5b4fc" strokeWidth={1} dot={false} name="Lower" />
          <Line type="monotone" dataKey="bb_mid" stroke="#6366f1"
                strokeWidth={1} dot={false} strokeDasharray="4 4" name="Mid" />
          <Line type="monotone" dataKey="close" stroke="#10b981"
                strokeWidth={2} dot={false} name="Price" />
          <Brush dataKey="date" height={24} stroke="#e5e7eb" tickFormatter={fmtDate}
                 fill="#f9fafb" travellerWidth={6} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [techSignal, setTechSignal] = useState(null);
  const [selectedIndicator, setSelectedIndicator] = useState(null);

  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [signal, setSignal] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const wsRef = useRef(null);

  // Live price via WebSocket
  const [livePrice, setLivePrice] = useState(null);

  useEffect(() => {
    if (!ticker) return;

    setLoading(true);
    setError(null);

    
    // Fire all requests in parallel — signal failure won't kill the page
    Promise.all([
  getStockOverview(ticker),
  getStockTechnicals(ticker),
  getSignal(ticker).catch(() => ({ data: null })),
  getTechnicalSignal(ticker).catch(() => ({ data: null })),
])
  .then(([ovRes, techRes, sigRes, techSigRes]) => {
    setOverview(ovRes.data);
    setSignal(sigRes.data);
    setTechSignal(techSigRes.data);

    const raw = techRes.data?.data || techRes.data || [];
    const formatted = raw.map((row) => ({
      date: row.date || row.Date,
      close: row.close ?? row.Close,
      rsi: row.rsi ?? row.RSI,
      macd: row.macd ?? row.MACD,
      macd_signal: row.macd_signal ?? row.MACD_signal,
      macd_histogram: row.macd_histogram ?? row.MACD_histogram,
      sma50: row.sma50 ?? row.SMA_50,
      sma200: row.sma200 ?? row.SMA_200,
      ema12: row.ema12 ?? row.EMA_12,
  ema26: row.ema26 ?? row.EMA_26,
  bb_upper: row.bb_upper ?? row.BB_upper,
  bb_lower: row.bb_lower ?? row.BB_lower,
  bb_mid: row.bb_mid ?? row.BB_mid,
    }));
    setChartData(formatted);

    const company = ovRes.data?.name || ovRes.data?.company_name || ticker.replace(".NS", "");
    return getSentiment(encodeURIComponent(company)).catch(() => ({ data: null }));
  })
  .then((sentRes) => {
    if (sentRes?.data) setSentiment(sentRes.data);
  })
  .catch((err) => {
    console.error(err);
    setError("Could not load data. Check the ticker and try again.");
  })
  .finally(() => setLoading(false));
  
    // Check watchlist status
    const token = localStorage.getItem("token");
    if (token) {
      getWatchlist()
        .then((res) => {
          const list = res.data?.watchlist || [];
          setInWatchlist(list.some((w) => w.ticker === ticker));
        })
        .catch(() => {});
    }
    

    // WebSocket for live price
    const ws = new WebSocket(`ws://localhost:8000/ws/live/${encodeURIComponent(ticker)}`);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.price) setLivePrice(d.price);
    };
    wsRef.current = ws;

    return () => ws.close();
  }, [ticker]);

  const handleWatchlist = async () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    try {
      if (inWatchlist) {
        await removeFromWatchlist(ticker);
        setInWatchlist(false);
      } else {
        await addToWatchlist(ticker);
        setInWatchlist(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => navigate("/")}
            className="text-sm text-gray-500 hover:text-gray-900 underline">
            ← Back to search
          </button>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-gray-50">

    {/* Navbar */}
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="font-semibold text-gray-900">{ticker}</span>
          {livePrice && (
            <span className="ml-3 text-sm text-emerald-600 font-medium tabular-nums">
              ₹{fmt(livePrice)} <span className="text-xs text-gray-400">live</span>
            </span>
          )}
        </div>
      </div>
      <button onClick={handleWatchlist}
        className="flex items-center gap-2 text-sm border border-gray-200
                   hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors text-gray-600">
        {inWatchlist
          ? <><BookmarkCheck className="w-4 h-4 text-emerald-500" /> Saved</>
          : <><BookmarkPlus className="w-4 h-4" /> Watchlist</>
        }
      </button>
    </header>

    <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">

      {/* Row 1 — Overview + ML Signal + Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OverviewCard data={overview} loading={loading} />
        <SignalCard data={signal} loading={loading} />
        <SentimentCard data={sentiment} loading={loading} />
      </div>

      {/* Indicator selector bar */}
      {!loading && chartData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 uppercase tracking-widest mr-2">Indicators</span>
          {INDICATORS.map((ind) => (
            <button
              key={ind}
              onClick={() => setSelectedIndicator(selectedIndicator === ind ? null : ind)}
              className={`text-sm px-4 py-1.5 rounded-lg border transition-all ${
                selectedIndicator === ind
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800"
              }`}
            >
              {ind}
            </button>
          ))}
          {selectedIndicator && (
            <button
              onClick={() => setSelectedIndicator(null)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ Close
            </button>
          )}
        </div>
      )}

      {/* Selected indicator chart */}
      {selectedIndicator === "RSI" && <RSIIndicatorChart data={chartData} signal={techSignal} />}
      {selectedIndicator === "MACD" && <MACDIndicatorChart data={chartData} signal={techSignal} />}
      {selectedIndicator === "EMA" && <EMAIndicatorChart data={chartData} signal={techSignal} />}
      {selectedIndicator === "SMA" && <SMAIndicatorChart data={chartData} signal={techSignal} />}
      {selectedIndicator === "Bollinger" && <BollingerIndicatorChart data={chartData} />}

      {/* Row 2 — Price chart */}
      <PriceChart data={chartData} loading={loading} />

    </main>
  </div>
);
}
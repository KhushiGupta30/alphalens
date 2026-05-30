import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { healthCheck } from "../api";

const SUGGESTIONS = [
  "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS",
  "WIPRO.NS", "SBIN.NS", "TATAMOTORS.NS", "ADANIENT.NS",
];

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

export default function SearchPage() {
  const [ticker, setTicker] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [indices, setIndices] = useState(null);
  const navigate = useNavigate();

  const nifty = useCountUp(indices?.nifty?.price);
  const sensex = useCountUp(indices?.sensex?.price);

  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));

    const niftyWs = new WebSocket("ws://localhost:8000/ws/live/%5ENSEI");
    const sensexWs = new WebSocket("ws://localhost:8000/ws/live/%5EBSESN");

    niftyWs.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.price) setIndices(prev => ({
        ...prev,
        nifty: { price: data.price, change_pct: data.change_pct }
    }));
};

sensexWs.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.price) setIndices(prev => ({
        ...prev,
        sensex: { price: data.price, change_pct: data.change_pct }
    }));
};

    return () => {
      niftyWs.close();
      sensexWs.close();
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) return;
    navigate(`/dashboard/${cleaned}`);
  };

  const token = localStorage.getItem("token");
const userEmail = localStorage.getItem("email");
const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("email");
  window.location.reload();
};

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{
      backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    }}>

      {/* Top bar */}
<header className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
  <span className="text-base font-semibold text-gray-900 tracking-tight">AlphaLens</span>
  <div className="flex items-center gap-6">
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${
        apiStatus === "online" ? "bg-emerald-500" :
        apiStatus === "offline" ? "bg-red-400" : "bg-yellow-400"
      }`} />
      <span className="text-xs text-gray-400">
        {apiStatus === "online" ? "API online" : apiStatus === "offline" ? "API offline" : "Checking"}
      </span>
    </div>
    <a href="/portfolio" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Portfolio</a>
    <a href="/watchlist" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Watchlist</a>
    {token ? (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">{userEmail}</span>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Logout
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <a href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Login</a>
        <a href="/register" className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">Register</a>
      </div>
    )}
  </div>
</header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        <div className="w-full max-w-lg">

          {/* Live index cards */}
{indices && (
  <div className="flex gap-4 mb-10">
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex-1">
      <p className="text-xs text-gray-400 mb-1">NIFTY 50</p>
      <p className="text-xl font-semibold text-gray-900 tabular-nums">
        {nifty.toLocaleString("en-IN")}
      </p>
      {indices.nifty?.change_pct !== undefined && (
        <p className={`text-xs mt-1 font-medium ${indices.nifty.change_pct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
          {indices.nifty.change_pct >= 0 ? "▲" : "▼"} {Math.abs(indices.nifty.change_pct)}% today
        </p>
      )}
    </div>
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex-1">
      <p className="text-xs text-gray-400 mb-1">SENSEX</p>
      <p className="text-xl font-semibold text-gray-900 tabular-nums">
        {sensex.toLocaleString("en-IN")}
      </p>
      {indices.sensex?.change_pct !== undefined && (
        <p className={`text-xs mt-1 font-medium ${indices.sensex.change_pct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
          {indices.sensex.change_pct >= 0 ? "▲" : "▼"} {Math.abs(indices.sensex.change_pct)}% today
        </p>
      )}
    </div>
  </div>
)}

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-4xl font-semibold text-gray-900 tracking-tight mb-2">
              Stock research,<br />powered by AI.
            </h1>
            <p className="text-gray-400 text-base">
              Technical indicators, ML signals, and sentiment — all in one place.
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g. RELIANCE.NS or AAPL"
                className="flex-1 bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-xl
                           focus:outline-none focus:border-gray-400
                           placeholder-gray-400 text-sm transition"
              />
              <button
                type="submit"
                className="bg-gray-900 hover:bg-gray-700 text-white font-medium
                           px-5 py-3 rounded-xl transition-colors text-sm"
              >
                Analyze
              </button>
            </div>
          </form>

          {/* Suggestions */}
          <div>
            <p className="text-xs text-gray-400 mb-2.5 uppercase tracking-widest">Popular</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => navigate(`/dashboard/${s}`)}
                  className="text-xs text-gray-500 border border-gray-200 hover:border-gray-400
                             hover:text-gray-800 px-3 py-1.5 rounded-lg transition-colors bg-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="px-8 py-5 border-t border-gray-100 bg-white/80">
        <span className="text-xs text-gray-300">Not financial advice.</span>
      </footer>
    </div>
  );
}
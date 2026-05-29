import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api";
import { TrendingUp } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerUser(email, password);
      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Registration failed. Try a different email."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{
  backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
  backgroundSize: "24px 24px",
}}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <TrendingUp className="text-emerald-500 w-6 h-6" />
          <span className="text-xl font-semibold text-gray-900">
            Alpha<span className="text-emerald-500">Lens</span>
          </span>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Create account</h1>
          <p className="text-sm text-gray-400 mb-6">Start researching stocks with AI</p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm
                            rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900
                           px-4 py-2.5 rounded-lg text-sm focus:outline-none
                           focus:border-gray-400 placeholder-gray-400 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900
                           px-4 py-2.5 rounded-lg text-sm focus:outline-none
                           focus:border-gray-400 placeholder-gray-400 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50
                         text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-gray-700 hover:text-gray-900 font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
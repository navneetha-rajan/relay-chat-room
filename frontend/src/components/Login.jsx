import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const RelayIcon = ({ className = "h-6 w-6" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const LockIcon = () => (
  <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const Spinner = () => (
  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const initialTab = location.pathname === "/register" ? "register" : "login";
  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const next = location.pathname === "/register" ? "register" : "login";
    if (next !== tab) {
      setTab(next);
      setError("");
      setUsername("");
      setPassword("");
    }
  }, [location.pathname]);

  function switchTab(target) {
    if (target === tab || loading) return;
    setError("");
    setUsername("");
    setPassword("");
    navigate(target === "register" ? "/register" : "/login", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (tab === "register") {
        await api.post("/api/auth/register", { username, password });
      }
      const { data } = await api.post("/api/auth/login", { username, password });

      setSuccess(true);
      setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          login(data.access_token);
          navigate("/");
        }, 300);
      }, 800);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          (tab === "register" ? "Registration failed" : "Login failed"),
      );
      setLoading(false);
    }
  }

  const isLogin = tab === "login";

  return (
    <div className={`landing-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 ${exiting ? "page-exit" : ""}`}>
      {/* Floating orbs */}
      <div className="orb-1 pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-indigo-600/[0.07] blur-3xl" />
      <div className="orb-2 pointer-events-none absolute -right-24 top-1/3 h-[360px] w-[360px] rounded-full bg-violet-500/[0.06] blur-3xl" />
      <div className="orb-3 pointer-events-none absolute -bottom-24 left-1/4 h-[300px] w-[300px] rounded-full bg-blue-600/[0.05] blur-3xl" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Hero section */}
        <div className="hero-enter mb-8 text-center">
          <div className="logo-pulse mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/25">
            <RelayIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Relay
          </h1>
          <p className="mt-2 text-[14px] text-gray-400">
            Real-time conversations, instantly.
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-card-enter rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {success ? (
            /* Success state */
            <div className="flex flex-col items-center py-8">
              <div className="success-circle flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline className="success-check" points="6 12 10 16 18 8" />
                </svg>
              </div>
              <p className="mt-4 text-[15px] font-medium text-white">
                {isLogin ? "Welcome back!" : "Account created!"}
              </p>
              <p className="mt-1 text-[13px] text-gray-400">Redirecting you now...</p>
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="relative mb-7 flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
                <div
                  className="tab-indicator absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-indigo-600 shadow-lg shadow-indigo-500/20"
                  style={{ transform: isLogin ? "translateX(4px)" : "translateX(calc(100% + 4px))" }}
                />
                {["login", "register"].map((t) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={`relative z-10 flex-1 rounded-md py-2 text-[13px] font-semibold transition-colors duration-200 ${
                      tab === t ? "text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {t === "login" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form key={tab} onSubmit={handleSubmit} className="form-enter space-y-4">
                {error && (
                  <div className="error-enter flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2.5 ring-1 ring-red-500/20">
                    <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-[13px] text-red-400">{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-300">Username</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <UserIcon />
                    </div>
                    <input
                      type="text"
                      required
                      minLength={tab === "register" ? 3 : undefined}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-all duration-200 focus:border-indigo-500/50 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder={tab === "register" ? "Choose a username" : "Enter username"}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-300">Password</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <LockIcon />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={tab === "register" ? 6 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-all duration-200 focus:border-indigo-500/50 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder={tab === "register" ? "Min. 6 characters" : "Enter password"}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/35 active:scale-[0.98] disabled:opacity-60 disabled:hover:bg-indigo-600"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      <span>{isLogin ? "Signing in..." : "Creating account..."}</span>
                    </>
                  ) : (
                    <span>{isLogin ? "Sign In" : "Create Account"}</span>
                  )}
                </button>
              </form>

              {/* Footer toggle */}
              <p className="mt-6 text-center text-[13px] text-gray-500">
                {isLogin ? "Don\u2019t have an account? " : "Already have an account? "}
                <button
                  onClick={() => switchTab(isLogin ? "register" : "login")}
                  className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  {isLogin ? "Create one" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>

        {/* Bottom branding */}
        <p className="mt-6 text-center text-[11px] text-gray-600">
          Relay &mdash; Secure, real-time messaging
        </p>
      </div>
    </div>
  );
}

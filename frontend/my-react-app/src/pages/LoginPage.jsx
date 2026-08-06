
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, resetPasswordExpiredApi, forgotPasswordOtpApi, resetPasswordOtpApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/arche-logo2.png";
import loginVideo from "../assets/login-hero.mp4";
import "../styles/LoginPage.css";

function LoginPage() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);


  const [isExpired, setIsExpired] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requireOldPassword, setRequireOldPassword] = useState(true);

  const [isForgotMode, setIsForgotMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");


  const [text1, setText1] = useState("");
  const [cursor1, setCursor1] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const { login } = useAuth();
  const navigate = useNavigate();

  const QUOTES = [
    "Innovation is the ability to see change as an opportunity - not a threat.",
    "Quality means doing it right when no one is looking.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The secret of business is to know something that nobody else knows.",
    "Efficiency is doing better what is already being done.",
    "Great things in business are never done by one person.",
    "Productivity is never an accident. It is always the result of a commitment to excellence.",
    "The only way to do great work is to love what you do.",
    "Management is doing things right; leadership is doing the right things.",
    "Vision is the art of seeing what is invisible to others.",
    "Leadership is the capacity to translate vision into reality.",
    "Your most unhappy customers are your greatest source of learning.",
    "Business opportunities are like buses, there's always another one coming.",
    "Success usually comes to those who are too busy to be looking for it.",
    "Don't sit down and wait for the opportunities to come. Get up and make them.",
    "There's no shortage of remarkable ideas, what's missing is the will to execute them.",
    "Far and away the best prize that life offers is the chance to work hard at work worth doing.",
    "If you really look closely, most overnight successes took a long time.",
    "To succeed in business, to reach the top, an individual must know all it is possible to know about that business."
  ];


  React.useEffect(() => {
    const mainText = "Manage with Clarity and Control";
    const type = (fullText, setFn, charDelay, startDelay, onComplete) => {
      setTimeout(() => {
        let i = 0;
        const interval = setInterval(() => {
          setFn(fullText.slice(0, i + 1));
          i++;
          if (i >= fullText.length) {
            clearInterval(interval);
            if (onComplete) onComplete();
          }
        }, charDelay);
      }, startDelay);
    };

    type(mainText, setText1, 40, 600, () => {
      setCursor1(false);
    });
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [QUOTES.length]);



  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {

      const response = await loginApi(email, password);


      if (response.isFirstLogin) {
        setInfo(response.message);
        setIsExpired(true);
        setRequireOldPassword(false);
        setLoading(false);
        return;
      }


      if (response.passwordExpired) {
        setIsExpired(true);
        setRequireOldPassword(true);
        setInfo(response.message);
        setLoading(false);
        return;
      }


      login(response.data);
      if (response.data.user.role === "ADMIN") {
        navigate("/monitoring", { replace: true });
      } else {
        navigate("/modules/risks?mode=view", { replace: true });
      }

    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await resetPasswordExpiredApi(email, requireOldPassword ? password : "", newPassword);
      setInfo(res.message);
      setIsExpired(false);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await forgotPasswordOtpApi(email);
      setInfo(res.message || "OTP sent successfully!");
      setOtpSent(true);
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetWithOtp = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await resetPasswordOtpApi(email, otp, newPassword);
      setInfo(res.message || "Password updated successfully!");
      setIsForgotMode(false);
      setOtpSent(false);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex font-urbanist relative overflow-hidden">
      { }
      <div className="area"><ul className="circles">{[...Array(10)].map((_, i) => <li key={i}></li>)}</ul></div>

      { }
      <div className="hidden lg:flex w-1/2 relative overflow-hidden z-10">
        <div className="context flex flex-col items-center justify-center h-full w-full px-12">
          { }
          <div className="relative w-full aspect-video max-w-lg rounded-2xl overflow-hidden shadow-2xl mb-8 border border-gray-900/10 group">
            <video className="absolute inset-0 w-full h-full object-cover opacity-90" src={loginVideo} autoPlay loop muted playsInline />
            <div className="absolute inset-0 bg-black/5"></div>
          </div>
          { }
          <div className="stack mb-4">
            <div className={`line line1 ${cursor1 ? "type-cursor" : ""}`}>{text1}</div>
          </div>
          { }
          <div className="h-20 flex items-center justify-center px-4 perspective-container">
            <p className="text-base sm:text-lg text-gray-600 italic font-light drop-shadow-sm text-center" key={quoteIndex}>"{QUOTES[quoteIndex]}"</p>
          </div>
        </div>
      </div>

      { }
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 z-20 relative">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8 sm:p-10 border border-gray-100">

          { }
          <div className="flex flex-col items-center gap-2 mb-8">
            <img src={logo} alt="Arche Logo" className="w-12 h-12 object-contain" />
            <h1 className="pop-text text-xl sm:text-2xl font-bold tracking-tight">RIDE+</h1>
            <div className="h-0.5 w-12 bg-blue-600 rounded-full mt-1"></div>
          </div>

          { }
          {info && <div className="mb-4 bg-blue-50 text-blue-600 px-4 py-2 rounded text-sm border border-blue-100">{info}</div>}
          {error && <div className="mb-4 bg-red-50 text-red-500 px-4 py-2 rounded text-sm border border-red-100">{error}</div>}

          { }
          {isExpired ? (

            <div className="animate-fade-in-up">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {requireOldPassword ? "Update Your Password" : "Set Your Password"}
                </h2>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                {requireOldPassword && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Current Password</label>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded font-bold uppercase tracking-wider text-sm hover:bg-blue-700 transition shadow-md"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpired(false)}
                  className="w-full text-center text-xs font-bold text-gray-500 hover:text-black mt-4 uppercase tracking-wide"
                >
                  Cancel
                </button>
              </form>
            </div>

          ) : isForgotMode ? (

            <div className="animate-fade-in-up">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Reset Password</h2>
                <p className="text-gray-500 text-sm">
                  {!otpSent ? "Enter your email to receive an OTP." : "Enter the OTP sent to your email."}
                </p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@arche.global"
                      className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded font-bold uppercase tracking-wider text-sm hover:bg-blue-700 transition shadow-md"
                  >
                    {loading ? "Sending..." : "Send OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsForgotMode(false); setError(""); setInfo(""); }}
                    className="w-full text-center text-xs font-bold text-gray-500 hover:text-black mt-4 uppercase tracking-wide"
                  >
                    Back to Login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetWithOtp} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">OTP</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none tracking-widest text-center"
                      maxLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded font-bold uppercase tracking-wider text-sm hover:bg-blue-700 transition shadow-md"
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsForgotMode(false); setOtpSent(false); setError(""); setInfo(""); }}
                    className="w-full text-center text-xs font-bold text-gray-500 hover:text-black mt-4 uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>

          ) : (

            <>
              <div className="mb-6 text-center">
                <p className="text-gray-500 text-sm">Please login with your official account.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@arche.global"
                    className="w-full p-3 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Password <span className="font-normal normal-case text-gray-400">(Empty for new accounts)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter Password"
                      className="w-full p-3 pr-10 rounded border border-gray-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3.5 text-xs font-bold text-gray-500 hover:text-black">
                      {showPass ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => { setIsForgotMode(true); setError(""); setInfo(""); }} 
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-3.5 rounded shadow-md text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-all"
                >
                  {loading ? "Processing..." : (!password ? "Continue" : "Login")}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default LoginPage;

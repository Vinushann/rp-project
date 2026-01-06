import { useState } from "react";
import { Search, PenTool, Loader2, AlertCircle, Sparkles, MapPin, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StatsCard from "./components/StatsCard";
import ReviewList from "./components/ReviewList";

// API Base URL - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Types for your API response
interface Review {
  original_text: string;
  sentiment: string[];
  scores: { Positive: number; Negative: number; Neutral: number };
}

interface ApiResponse {
  mode: string;
  total_scraped?: number;
  statistics: {
    [key: string]: {
      count: number;
      percentage: string;
      reviews: Review[];
    };
  };
  message?: string;
}

interface ErrorState {
  message: string;
  details?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<"scrape" | "manual">("scrape");
  const [input, setInput] = useState("");
  const [reviewLimit, setReviewLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setData(null);
    setError(null);

    const endpoint =
      activeTab === "scrape" ? "/analyze_reviews" : "/analyze_text";
    const payload =
      activeTab === "scrape" ? { url: input, limit: reviewLimit } : { text: input };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${res.status}`);
      }

      const result = await res.json();

      // Check for empty results
      if (result.message && !result.statistics) {
        setError({ message: result.message, details: "Try a different URL or input." });
        return;
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError({
        message: "Failed to analyze",
        details: errorMessage.includes("fetch")
          ? "Cannot connect to backend. Make sure the server is running on port 8000."
          : errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to flatten reviews for the list
  const allReviews = data
    ? Object.values(data.statistics).flatMap((stat) => stat.reviews)
    : [];

  const totalReviews = data?.total_scraped || allReviews.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Sentiment Analysis Engine
            </h1>
          </div>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            AI-Powered Analytics for Sri Lankan Businesses • Supports Sinhala, Tamil & English
          </p>
        </motion.header>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/60 p-4 md:p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm shadow-xl"
        >
          {/* Tabs */}
          <div className="flex flex-wrap gap-3 mb-6 border-b border-slate-700/50 pb-4">
            <button
              onClick={() => {
                setActiveTab("scrape");
                setInput("");
                setError(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium ${
                activeTab === "scrape"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
                  : "hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
              }`}
            >
              <MapPin className="w-4 h-4" /> Google Maps Scraper
            </button>
            <button
              onClick={() => {
                setActiveTab("manual");
                setInput("");
                setError(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium ${
                activeTab === "manual"
                  ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/25"
                  : "hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" /> Manual Text Input
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {activeTab === "scrape" ? (
                <motion.div
                  key="scrape"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="url"
                      placeholder="Paste Google Maps URL here (e.g., https://maps.google.com/...)"
                      className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      required
                    />
                  </div>
                  {/* Review Limit Slider */}
                  <div className="flex items-center gap-4 bg-slate-900/30 p-4 rounded-xl">
                    <label className="text-sm text-slate-400 whitespace-nowrap">
                      Reviews to scrape:
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={reviewLimit}
                      onChange={(e) => setReviewLimit(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-blue-400 font-bold min-w-[3ch] text-right">
                      {reviewLimit}
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="relative">
                    <PenTool className="absolute left-4 top-4 w-5 h-5 text-slate-500" />
                    <textarea
                      placeholder="Type or paste text in Sinhala, Tamil, or English...&#10;&#10;Example: කෑම ඉතා රසයි. සේවාව හොඳයි. 😊"
                      className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all placeholder:text-slate-500 min-h-[120px] resize-y"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 ml-1">
                    💡 Tip: You can paste multiple sentences or paragraphs for analysis
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "scrape"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-600"
                  : "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-slate-600 disabled:to-slate-600"
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{activeTab === "scrape" ? "Scraping & Analyzing..." : "Analyzing..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Analyze Sentiment</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6 bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium">{error.message}</p>
                {error.details && (
                  <p className="text-red-400/70 text-sm mt-1">{error.details}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Skeleton */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-10"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 rounded-xl p-4 animate-pulse"
                  >
                    <div className="h-4 bg-slate-700 rounded w-20 mb-3"></div>
                    <div className="h-8 bg-slate-700 rounded w-16"></div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-40 mb-4"></div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-700/50 rounded-lg"></div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Dashboard */}
        <AnimatePresence>
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-10"
            >
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-200">
                  Analysis Results
                </h2>
                <span className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                  {totalReviews} {totalReviews === 1 ? "review" : "reviews"} analyzed
                </span>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatsCard
                  type="Positive"
                  label="Positive"
                  value={data.statistics.Positive?.percentage || "0%"}
                  count={data.statistics.Positive?.count || 0}
                />
                <StatsCard
                  type="Negative"
                  label="Negative"
                  value={data.statistics.Negative?.percentage || "0%"}
                  count={data.statistics.Negative?.count || 0}
                />
                <StatsCard
                  type="Mixed"
                  label="Mixed"
                  value={data.statistics.Mixed?.percentage || "0%"}
                  count={data.statistics.Mixed?.count || 0}
                />
                <StatsCard
                  type="Neutral"
                  label="Neutral"
                  value={data.statistics.Neutral?.percentage || "0%"}
                  count={data.statistics.Neutral?.count || 0}
                />
              </div>

              <ReviewList reviews={allReviews} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-16 text-center text-slate-500 text-sm">
          <p>Built with ❤️ for Sri Lankan Businesses</p>
          <p className="text-xs mt-1 text-slate-600">
            Powered by XLM-RoBERTa • Translation-Based Transfer Learning
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;

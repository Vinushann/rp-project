import { motion } from "framer-motion";
import { MessageSquare, TrendingUp, TrendingDown, Minus, Scale } from "lucide-react";

interface Review {
  original_text: string;
  sentiment: string[];
  scores: { Positive: number; Negative: number; Neutral: number };
}

const ReviewList = ({ reviews }: { reviews: Review[] }) => {
  if (reviews.length === 0) {
    return (
      <div className="mt-8 bg-slate-800/30 rounded-xl p-8 text-center border border-slate-700/50">
        <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No reviews to display</p>
        <p className="text-slate-500 text-sm mt-1">
          Enter a Google Maps URL or text to analyze
        </p>
      </div>
    );
  }

  const getSentimentIcon = (sentiment: string[]) => {
    if (sentiment.includes("Positive") && sentiment.includes("Negative")) {
      return <Scale className="w-4 h-4" />;
    }
    if (sentiment.includes("Positive")) return <TrendingUp className="w-4 h-4" />;
    if (sentiment.includes("Negative")) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "bg-green-500";
    if (score >= 0.4) return "bg-yellow-500";
    return "bg-slate-500";
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-200">Detailed Analysis</h3>
        <span className="text-sm text-slate-500">
          Showing {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((rev, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
            className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/70 transition-all group"
          >
            {/* Sentiment Tags */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">
                {getSentimentIcon(rev.sentiment)}
              </span>
              <div className="flex flex-wrap gap-2">
                {rev.sentiment.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      tag === "Positive"
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : tag === "Negative"
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : tag === "Mixed"
                        ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Text */}
            <p className="text-sm text-slate-300 leading-relaxed mb-4 line-clamp-3">
              {rev.original_text}
            </p>

            {/* Score Bars */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-400 w-16">Positive</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(rev.scores.Positive * 100).toFixed(0)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 + 0.2 }}
                    className={`h-full ${getScoreColor(rev.scores.Positive)} rounded-full`}
                  />
                </div>
                <span className="text-slate-500 w-10 text-right">
                  {(rev.scores.Positive * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-400 w-16">Negative</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(rev.scores.Negative * 100).toFixed(0)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 + 0.3 }}
                    className="h-full bg-red-500 rounded-full"
                  />
                </div>
                <span className="text-slate-500 w-10 text-right">
                  {(rev.scores.Negative * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-16">Neutral</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(rev.scores.Neutral * 100).toFixed(0)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 + 0.4 }}
                    className="h-full bg-slate-500 rounded-full"
                  />
                </div>
                <span className="text-slate-500 w-10 text-right">
                  {(rev.scores.Neutral * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ReviewList;

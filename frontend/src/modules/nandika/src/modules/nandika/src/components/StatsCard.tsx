import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Minus, Scale } from "lucide-react";

interface StatProps {
  label: string;
  value: string; // e.g., "45%"
  count: number;
  type: "Positive" | "Negative" | "Neutral" | "Mixed";
}

const StatsCard = ({ label, value, count, type }: StatProps) => {
  const configs = {
    Positive: {
      bg: "from-green-500/10 to-green-600/5",
      border: "border-green-500/20 hover:border-green-500/40",
      text: "text-green-400",
      iconBg: "bg-green-500/20",
      icon: <ThumbsUp className="w-5 h-5" />,
    },
    Negative: {
      bg: "from-red-500/10 to-red-600/5",
      border: "border-red-500/20 hover:border-red-500/40",
      text: "text-red-400",
      iconBg: "bg-red-500/20",
      icon: <ThumbsDown className="w-5 h-5" />,
    },
    Neutral: {
      bg: "from-slate-500/10 to-slate-600/5",
      border: "border-slate-500/20 hover:border-slate-500/40",
      text: "text-slate-400",
      iconBg: "bg-slate-500/20",
      icon: <Minus className="w-5 h-5" />,
    },
    Mixed: {
      bg: "from-yellow-500/10 to-orange-600/5",
      border: "border-yellow-500/20 hover:border-yellow-500/40",
      text: "text-yellow-400",
      iconBg: "bg-yellow-500/20",
      icon: <Scale className="w-5 h-5" />,
    },
  };

  const config = configs[type];
  const numericValue = parseFloat(value) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden p-4 rounded-xl border bg-gradient-to-br ${config.bg} ${config.border} transition-all cursor-default`}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-xl" />

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <span className={`text-sm font-medium ${config.text} opacity-80`}>
          {label}
        </span>
        <div className={`p-2 rounded-lg ${config.iconBg} ${config.text}`}>
          {config.icon}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-3xl font-bold ${config.text}`}
        >
          {value}
        </motion.span>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-500 mt-1">
        {count} {count === 1 ? "review" : "reviews"}
      </p>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-slate-700/50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${numericValue}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${
            type === "Positive"
              ? "bg-green-500"
              : type === "Negative"
              ? "bg-red-500"
              : type === "Mixed"
              ? "bg-yellow-500"
              : "bg-slate-500"
          }`}
        />
      </div>
    </motion.div>
  );
};

export default StatsCard;

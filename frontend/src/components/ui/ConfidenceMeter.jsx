/**
 * Confidence Meter Component
 * Visual gauge for prediction confidence
 */
import { motion } from 'framer-motion';

export function ConfidenceMeter({ 
  value, 
  size = 'md', 
  showLabel = true,
  thresholds = { low: 0.5, medium: 0.7 }
}) {
  const percentage = value * 100;
  
  const getColor = () => {
    if (value < thresholds.low) return { bg: 'bg-red-100', fill: 'bg-red-500', text: 'text-red-700' };
    if (value < thresholds.medium) return { bg: 'bg-yellow-100', fill: 'bg-yellow-500', text: 'text-yellow-700' };
    return { bg: 'bg-green-100', fill: 'bg-green-500', text: 'text-green-700' };
  };
  
  const colors = getColor();
  
  const sizes = {
    sm: { height: 'h-1.5', width: 'w-16', text: 'text-xs' },
    md: { height: 'h-2', width: 'w-24', text: 'text-sm' },
    lg: { height: 'h-3', width: 'w-32', text: 'text-base' },
  };
  
  const sizeConfig = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeConfig.width} ${sizeConfig.height} ${colors.bg} rounded-full overflow-hidden`}>
        <motion.div
          className={`h-full ${colors.fill} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <span className={`${sizeConfig.text} ${colors.text} font-medium`}>
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export function CircularConfidence({ value, size = 60, strokeWidth = 6 }) {
  const percentage = value * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value * circumference);
  
  const getColor = () => {
    if (value < 0.5) return '#EF4444';
    if (value < 0.7) return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-700">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function ConfidenceBadge({ value }) {
  const percentage = value * 100;
  
  const getStyle = () => {
    if (value < 0.5) return 'bg-red-100 text-red-700 border-red-200';
    if (value < 0.7) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };
  
  const getIcon = () => {
    if (value < 0.5) return '⚠️';
    if (value < 0.7) return '🔶';
    return '✓';
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${getStyle()}`}>
      <span>{getIcon()}</span>
      {percentage.toFixed(1)}%
    </span>
  );
}

export default ConfidenceMeter;

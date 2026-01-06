/**
 * Loading Spinner Component
 * =========================
 * 
 * Animated loading state with progress messages
 * Shows a ~10 second loading experience with step-by-step progress
 */

import { useState, useEffect } from 'react';

const loadingSteps = [
  { message: 'Reading your dataset...', duration: 1500 },
  { message: 'Analyzing column types...', duration: 1500 },
  { message: 'Running semantic profiling...', duration: 1500 },
  { message: 'Inferring business roles...', duration: 1500 },
  { message: 'Performing factor analysis...', duration: 1500 },
  { message: 'Extracting smart KPIs...', duration: 1000 },
  { message: 'Generating insights...', duration: 1000 },
  { message: 'Finalizing results...', duration: 500 },
];

function LoadingSpinner() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress through steps with their durations
    let stepIndex = 0;
    let elapsed = 0;
    const totalDuration = loadingSteps.reduce((sum, s) => sum + s.duration, 0);

    const interval = setInterval(() => {
      elapsed += 100;
      
      // Calculate overall progress
      setProgress(Math.min((elapsed / totalDuration) * 100, 100));
      
      // Determine current step
      let accumulated = 0;
      for (let i = 0; i < loadingSteps.length; i++) {
        accumulated += loadingSteps[i].duration;
        if (elapsed < accumulated) {
          if (i !== stepIndex) {
            stepIndex = i;
            setCurrentStep(i);
          }
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      {/* Animated Spinner */}
      <div className="relative w-24 h-24 mb-8">
        <svg className="w-24 h-24 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="url(#gradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
            className="transition-all duration-300"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
        </svg>
        {/* Percentage in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-700">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Loading Message */}
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        Analyzing Your Data
      </h3>
      <p className="text-gray-500 h-6 transition-opacity duration-300">
        {loadingSteps[currentStep]?.message}
      </p>

      {/* Step Progress */}
      <div className="mt-8 w-full max-w-md px-4">
        <div className="flex items-center justify-between mb-2">
          {loadingSteps.map((step, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i < currentStep
                  ? 'bg-orange-500'
                  : i === currentStep
                  ? 'bg-orange-400 ring-4 ring-orange-100'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tip */}
      <p className="mt-8 text-xs text-gray-400 max-w-sm text-center">
        Our AI is analyzing patterns, correlations, and business metrics in your data
      </p>
    </div>
  );
}

export default LoadingSpinner;

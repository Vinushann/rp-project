/**
 * Confetti Animation Component
 * Celebration effect for successful actions
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const confettiColors = [
  '#10B981', // green
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
];

function ConfettiPiece({ index, originX }) {
  const color = confettiColors[index % confettiColors.length];
  const randomX = (Math.random() - 0.5) * 400;
  const randomRotation = Math.random() * 720 - 360;
  const size = Math.random() * 8 + 6;
  const delay = Math.random() * 0.3;
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: 2,
        left: originX || '50%',
        top: '50%',
      }}
      initial={{ 
        x: 0, 
        y: 0, 
        rotate: 0, 
        opacity: 1,
        scale: 0 
      }}
      animate={{ 
        x: randomX,
        y: Math.random() * -300 - 100,
        rotate: randomRotation,
        opacity: 0,
        scale: 1
      }}
      transition={{ 
        duration: 1.5 + Math.random() * 0.5,
        delay,
        ease: [0.23, 1, 0.32, 1]
      }}
    />
  );
}

export function Confetti({ show, count = 50, originX = '50%' }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (show) {
      setPieces(Array.from({ length: count }, (_, i) => i));
      const timer = setTimeout(() => setPieces([]), 2500);
      return () => clearTimeout(timer);
    }
  }, [show, count]);

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {pieces.map((index) => (
            <ConfettiPiece key={index} index={index} originX={originX} />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export function SuccessCheckmark({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.5, times: [0, 0.6, 1] }}
          >
            <motion.svg
              className="w-12 h-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </motion.svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Confetti;

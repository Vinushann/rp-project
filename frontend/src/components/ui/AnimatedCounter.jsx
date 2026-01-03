/**
 * Animated Counter Component
 * Numbers count up smoothly on load
 */
import { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, useInView } from 'framer-motion';

export function AnimatedCounter({ 
  value, 
  duration = 1, 
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '' 
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  const spring = useSpring(0, { 
    duration: duration * 1000,
    bounce: 0 
  });
  
  const display = useTransform(spring, (val) => 
    `${prefix}${val.toFixed(decimals)}${suffix}`
  );

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [spring, value, isInView]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

export function AnimatedPercentage({ value, className = '' }) {
  return (
    <AnimatedCounter 
      value={value} 
      decimals={1} 
      suffix="%" 
      className={className}
    />
  );
}

export function CountUpOnView({ children, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

export default AnimatedCounter;

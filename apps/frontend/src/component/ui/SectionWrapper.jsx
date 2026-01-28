import React from 'react';
import { motion } from 'framer-motion';

// Stagger container variant
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3, // Delay between each child animation
      delayChildren: 0.2,
    },
  },
};

// Standard vertical slide-up fade-in variant
export const fadeInUp = {
  hidden: { 
    opacity: 0, 
    y: 40, // Reduced distance slightly for subtler motion
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 1.0, // Slower duration
      ease: [0.22, 1, 0.36, 1], // Custom bezier for natural ease-out
    },
  },
};

const SectionWrapper = ({ 
  children, 
  className = "", 
  id = "",
  delay = 0 
}) => {
  return (
    <motion.section
      id={id}
      className={`relative ${className}`}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }} // Trigger when 100px into view
    >
      {children}
    </motion.section>
  );
};

export default SectionWrapper;

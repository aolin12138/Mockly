import React, { useEffect, useRef, useState } from 'react';

const FadeIn = ({ 
  children, 
  delay = 0, 
  className = "", 
  threshold = 0.1, 
  direction = "up",
  duration = 1000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add a small delay to ensure browser doesn't batch the initial paint with the update
          requestAnimationFrame(() => {
             setIsVisible(true);
          });
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: threshold,
      rootMargin: "0px 0px -50px 0px"
    });

    const currentElement = domRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const getTransform = () => {
    // If not visible, we want to be offset
    if (!isVisible) {
      switch(direction) {
          case 'up': return 'translate-y-16 opacity-0'; 
          case 'down': return '-translate-y-16 opacity-0';
          case 'left': return 'translate-x-16 opacity-0';
          case 'right': return '-translate-x-16 opacity-0';
          default: return 'translate-y-16 opacity-0';
      }
    }
    // If visible, return checkmark state
    return 'translate-y-0 translate-x-0 opacity-100';
  };

  return (
    <div
      ref={domRef}
      // transform-gpu forces hardware acceleration
      // duration-1000 and ease-out defined in class for standard performance
      className={`transform transform-gpu transition-all ease-out ${getTransform()} ${className}`}
      style={{ 
        // We only override if strictly necessary, but inline style ensures dynamic values work
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
};

export default FadeIn;

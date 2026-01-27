import React, { useRef, useEffect } from 'react';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export default function ParticleText() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    // Create offscreen canvas to draw logo
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    
    // Draw globe
    const globeX = width / 2;
    const globeY = height * 0.35;
    const globeRadius = Math.min(width, height) * 0.15;
    
    offCtx.strokeStyle = 'white';
    offCtx.lineWidth = 2;
    
    // Circle outline
    offCtx.beginPath();
    offCtx.arc(globeX, globeY, globeRadius, 0, Math.PI * 2);
    offCtx.stroke();
    
    // Longitude lines (meridians)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI;
      offCtx.beginPath();
      offCtx.ellipse(globeX, globeY, globeRadius * Math.abs(Math.sin(angle)), globeRadius, 0, 0, Math.PI * 2);
      offCtx.stroke();
    }
    
    // Latitude lines (parallels)
    for (let lat of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const y = globeY + lat * globeRadius;
      const rx = globeRadius * Math.sqrt(1 - lat * lat);
      offCtx.beginPath();
      offCtx.ellipse(globeX, y, rx, globeRadius * 0.2, 0, 0, Math.PI * 2);
      offCtx.stroke();
    }
    
    // Draw text
    offCtx.font = 'bold 120px sans-serif';
    offCtx.fillStyle = 'white';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.letterSpacing = '0.05em';
    offCtx.fillText('MOCKLY', width / 2, height * 0.7);
    
    // Sample pixels to create particles
    const imageData = offCtx.getImageData(0, 0, width, height);
    const particles = [];
    const step = 4;
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        if (imageData.data[i + 3] > 128) {
          particles.push({
            homeX: x,
            homeY: y,
            x: x + (Math.random() - 0.5) * width,
            y: y + (Math.random() - 0.5) * height,
            vx: 0,
            vy: 0
          });
        }
      }
    }
    
    // Mouse tracking
    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, active: false };
    let mouseInfluence = 0;
    
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      mouse.x = (e.clientX - rect.left) * (canvas.offsetWidth / rect.width);
      mouse.y = (e.clientY - rect.top) * (canvas.offsetHeight / rect.height);
      mouse.active = true;
    };
    
    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.prevX = -9999;
      mouse.prevY = -9999;
    };
    
    const handleMouseEnter = () => {
      mouse.active = true;
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    
    // Animation parameters
    const homeStrength = 0.008;  // Much weaker return force for slower comeback
    const damping = 0.92;  // Higher damping for slower movement
    const maxSpeed = 8;  // Lower max speed
    const influenceRadius = 120;  // Larger influence area
    const mouseStrength = 0.006;  // Gentler push
    
    let lastTime = performance.now();
    
    function animate(currentTime) {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.016);
      lastTime = currentTime;
      
      // Lerp mouse influence - slower fade for trace effect
      const targetInfluence = mouse.active ? 1 : 0;
      mouseInfluence += (targetInfluence - mouseInfluence) * 0.08;
      
      // Clear canvas
      ctx.fillStyle = 'rgba(15, 23, 42, 1)';
      ctx.fillRect(0, 0, width, height);
      
      // Update particles
      for (const p of particles) {
        // Spring force to home
        const homeForceX = (p.homeX - p.x) * homeStrength;
        const homeForceY = (p.homeY - p.y) * homeStrength;
        
        p.vx += homeForceX;
        p.vy += homeForceY;
        
        // Mouse interaction - fluid ripple effect
        // Check current mouse position
        let dx = p.x - mouse.x;
        let dy = p.y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check interpolated positions along mouse path for better detection
        let minDist = dist;
        let closestDx = dx;
        let closestDy = dy;
        
        if (mouse.prevX !== -9999) {
          // Check multiple points along the line for fast movements
          for (let i = 0; i <= 5; i++) {
            const t = i / 5;
            const interpX = mouse.prevX + (mouse.x - mouse.prevX) * t;
            const interpY = mouse.prevY + (mouse.y - mouse.prevY) * t;
            
            const dx2 = p.x - interpX;
            const dy2 = p.y - interpY;
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            if (dist2 < minDist) {
              minDist = dist2;
              closestDx = dx2;
              closestDy = dy2;
            }
          }
        }
        
        if (minDist < influenceRadius && minDist > 0.1) {
          // Gentler push away from closest point
          const pushDirection = { x: closestDx / minDist, y: closestDy / minDist };
          
          // Smoother falloff for fluid effect
          const distanceFactor = 1 - (minDist / influenceRadius);
          const influence = Math.pow(distanceFactor, 3) * mouseInfluence;
          
          // Push directly away from mouse with very gentle force
          const mouseForceX = pushDirection.x * mouseStrength * influence * 50;
          const mouseForceY = pushDirection.y * mouseStrength * influence * 50;
          
          p.vx += mouseForceX;
          p.vy += mouseForceY;
        }
        
        // Apply damping
        p.vx *= damping;
        p.vy *= damping;
        
        // Clamp speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }
        
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        
        // Render
        ctx.fillStyle = 'rgba(96, 165, 250, 0.9)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      requestAnimationFrame(animate);
    }
    
    animate(performance.now());
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ background: '#0f172a' }}
    />
  );
}

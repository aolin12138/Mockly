import React, { useRef, useEffect } from 'react';

export default function ParticleText({ scrollProgress = 0 }) {
  const canvasRef = useRef();
  const scrollProgressRef = useRef(0);
  
  // Update scroll progress ref
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Dynamic size variables
    let width, height, centerX, centerY, earthRadius;
    let rotationY = 0; // Horizontal rotation
    let rotationX = 0.3; // Tilt angle
    
    // Load company logos from Clearbit Logo API (free, no auth required)
    const logoImages = {};
    const logoUrls = {
      'GOOGLE': 'https://logo.clearbit.com/google.com',
      'APPLE': 'https://logo.clearbit.com/apple.com',
      'MICROSOFT': 'https://logo.clearbit.com/microsoft.com',
      'AMAZON': 'https://logo.clearbit.com/amazon.com',
      'META': 'https://logo.clearbit.com/meta.com',
      'NETFLIX': 'https://logo.clearbit.com/netflix.com'
    };
    
    // Create high-quality fallback logos with proper branding
    const createFallbackLogo = (name) => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      
      const logos = {
        GOOGLE: {
          draw: (ctx) => {
            // Google "G" logo
            ctx.fillStyle = '#4285F4';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px "Product Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G', 100, 105);
          }
        },
        APPLE: {
          draw: (ctx) => {
            // Apple logo silhouette
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px "SF Pro", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('', 100, 105);
          }
        },
        MICROSOFT: {
          draw: (ctx) => {
            // Microsoft four squares
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 200, 200);
            const colors = ['#F25022', '#7FBA00', '#00A4EF', '#FFB900'];
            const size = 45;
            const gap = 10;
            [
              [50, 50, colors[0]], [105, 50, colors[1]],
              [50, 105, colors[2]], [105, 105, colors[3]]
            ].forEach(([x, y, color]) => {
              ctx.fillStyle = color;
              ctx.fillRect(x, y, size, size);
            });
          }
        },
        AMAZON: {
          draw: (ctx) => {
            // Amazon smile
            ctx.fillStyle = '#FF9900';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 100px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('a', 100, 105);
          }
        },
        META: {
          draw: (ctx) => {
            // Meta infinity symbol
            ctx.fillStyle = '#0668E1';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('M', 100, 105);
          }
        },
        NETFLIX: {
          draw: (ctx) => {
            // Netflix N
            ctx.fillStyle = '#E50914';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px "Bebas Neue", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', 100, 105);
          }
        }
      };
      
      logos[name].draw(ctx);
      return canvas;
    };
    
    // Track logo loading with fallbacks
    Object.entries(logoUrls).forEach(([name, url]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Set fallback immediately
      logoImages[name] = createFallbackLogo(name);
      
      img.onload = () => {
        // Replace fallback with actual logo on successful load
        logoImages[name] = img;
      };
      
      img.onerror = () => {
        // Keep fallback on error (already set)
        console.log(`Using fallback for ${name}`);
      };
      
      img.src = url;
    });
    
    // Company logos orbiting around Earth with random paths
    const companies = [
      { 
        name: 'GOOGLE', 
        angleY: 0, 
        angleZ: Math.random() * Math.PI * 2,
        orbitRadius: earthRadius * 1.15, 
        speedY: 0.004,
        speedZ: 0.003,
        inclination: Math.random() * Math.PI * 0.5
      },
      { 
        name: 'APPLE', 
        angleY: Math.PI / 3, 
        angleZ: Math.random() * Math.PI * 2,
        orbitRadius: earthRadius * 1.18, 
        speedY: 0.005,
        speedZ: 0.0035,
        inclination: Math.random() * Math.PI * 0.5
      },
      { 
        name: 'MICROSOFT', 
        angleY: Math.PI * 2 / 3, 
        angleZ: Math.random() * Math.PI * 2,
        orbitRadius: earthRadius * 1.16, 
        speedY: 0.0045,
        speedZ: 0.004,
        inclination: Math.random() * Math.PI * 0.5
      },
      { 
        name: 'AMAZON', 
        angleY: Math.PI, 
        angleZ: Math.random() * Math.PI * 2,
        orbitRadius: earthRadius * 1.2, 
        speedY: 0.0055,
        speedZ: 0.0025,
        inclination: Math.random() * Math.PI * 0.5
      },
      { 
        name: 'META', 
        angleY: Math.PI * 4 / 3, 
        angleZ: Math.random() * Math.PI * 2,
        orbitRadius: earthRadius * 1.17, 
        speedY: 0.0048,
        speedZ: 0.0038,
        inclination: Math.random() * Math.PI * 0.5
      },
      { 
        name: 'NETFLIX', 
        angleY: Math.PI * 5 / 3, 
        angleZ: Math.random() * Math.PI * 2,
        orbitRadius: earthRadius * 1.22, 
        speedY: 0.0052,
        speedZ: 0.0032,
        inclination: Math.random() * Math.PI * 0.5
      },
    ];
    
    // Initialize function
    const initializeSize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      centerX = width / 2;
      centerY = height * 0.35;
      earthRadius = Math.min(width, height) * 0.22;
      
      // Update company orbit radii
      companies.forEach((company, i) => {
        company.orbitRadius = earthRadius * [1.15, 1.18, 1.16, 1.2, 1.17, 1.22][i];
      });
      
      // Regenerate text particles with new dimensions
      generateTextParticles();
    };
    
    // Draw 3D sphere point
    function draw3DPoint(x, y, z, size, color) {
      const scale = 1 / (1 + z * 0.003); // Perspective scaling
      const screenX = centerX + x * scale;
      const screenY = centerY + y * scale;
      const pointSize = Math.max(0.1, size * scale); // Ensure positive radius
      
      if (z > -earthRadius * 2 && pointSize > 0) { // Only draw if in front and size is positive
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, pointSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      return { screenX, screenY, scale, z };
    }
    
    // Rotate 3D point
    function rotate3D(x, y, z, angleX, angleY) {
      // Rotate around Y axis
      let cosY = Math.cos(angleY);
      let sinY = Math.sin(angleY);
      let x1 = x * cosY - z * sinY;
      let z1 = x * sinY + z * cosY;
      
      // Rotate around X axis
      let cosX = Math.cos(angleX);
      let sinX = Math.sin(angleX);
      let y1 = y * cosX - z1 * sinX;
      let z2 = y * sinX + z1 * cosX;
      
      return { x: x1, y: y1, z: z2 };
    }
    
    // Generate sphere particles
    const earthParticles = [];
    const particleCount = 1200;
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      earthParticles.push({
        theta,
        phi,
        // Some particles for continents (denser in certain areas)
        isLand: Math.random() > 0.7,
      });
    }
    
    // Function to find nearest Earth particles to a company position
    function findNearestParticles(companyPos, count = 5) {
      const distances = earthParticles.map((particle, index) => {
        const x = earthRadius * Math.sin(particle.phi) * Math.cos(particle.theta);
        const y = earthRadius * Math.sin(particle.phi) * Math.sin(particle.theta);
        const z = earthRadius * Math.cos(particle.phi);
        const rotated = rotate3D(x, y, z, rotationX, rotationY);
        
        const dx = companyPos.x - rotated.x;
        const dy = companyPos.y - rotated.y;
        const dz = companyPos.z - rotated.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        return { index, dist, particle, rotated };
      });
      
      distances.sort((a, b) => a.dist - b.dist);
      return distances.slice(0, count);
    }
    
    // Text particles array
    let textParticles = [];
    
    // Function to generate text particles
    const generateTextParticles = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext('2d');
      
      offCtx.font = 'bold 80px sans-serif';
      offCtx.fillStyle = 'white';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText('MOCKLY', width / 2, height * 0.75);
      
      // Sample pixels to create text particles
      const imageData = offCtx.getImageData(0, 0, width, height);
      textParticles = [];
      const step = 4;
      
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4;
          if (imageData.data[i + 3] > 128) {
            const initialX = x + (Math.random() - 0.5) * width * 0.3;
            const initialY = y + (Math.random() - 0.5) * height * 0.3;
            textParticles.push({
              homeX: x,
              homeY: y,
              initialX: initialX, // Store initial scattered position
              initialY: initialY,
              x: initialX,
              y: initialY,
              vx: 0,
              vy: 0
            });
          }
        }
      }
    };
    
    // Mouse tracking
    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, active: false };
    let mouseInfluence = 0;
    
    // Physics parameters for text particles
    const homeStrength = 0.008;
    const damping = 0.92;
    const maxSpeed = 8;
    const influenceRadius = 120;
    const mouseStrength = 0.006;
    
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
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Initialize canvas size and generate particles
    initializeSize();
    
    // Animation loop
    function animate() {
      ctx.clearRect(0, 0, width, height);
      
      // Get current scroll progress
      const progress = scrollProgressRef.current;
      
      // Earth expansion based on scroll (1 to 3x size at full scroll)
      const earthExpansionFactor = 1 + (progress * 2);
      const currentEarthRadius = earthRadius * earthExpansionFactor;
      
      // Earth fade out (invisible at 80% scroll)
      const earthOpacity = Math.max(0, 1 - (progress * 1.25));
      
      // Auto-rotate Earth
      rotationY += 0.0015;
      
      // Mouse interaction removed - Earth rotates independently
      
      // Update mouse influence (disabled during scroll)
      const targetInfluence = (mouse.active && progress < 0.3) ? 1 : 0;
      mouseInfluence += (targetInfluence - mouseInfluence) * 0.08;
      
      // Draw Earth sphere with expansion and fade
      if (earthOpacity > 0.01) {
        ctx.save();
        ctx.globalAlpha = earthOpacity;
        
        earthParticles.forEach(particle => {
          const x = currentEarthRadius * Math.sin(particle.phi) * Math.cos(particle.theta);
          const y = currentEarthRadius * Math.sin(particle.phi) * Math.sin(particle.theta);
          const z = currentEarthRadius * Math.cos(particle.phi);
          
          const rotated = rotate3D(x, y, z, rotationX, rotationY);
          
          // Different colors for land and ocean
          const color = particle.isLand ? '#90EE90' : '#4A90E2';
          const size = particle.isLand ? 2 : 1.5;
          
          draw3DPoint(rotated.x, rotated.y, rotated.z, size, color);
        });
        
        ctx.restore();
      }
      
      // Companies fade out earlier (invisible at 60% scroll)
      const companyOpacity = Math.max(0, 1 - (progress * 1.66));
      
      // Draw connections and company logos
      if (companyOpacity > 0.01) {
        ctx.save();
        ctx.globalAlpha = companyOpacity;
        
        companies.forEach(company => {
          company.angleY += company.speedY;
          company.angleZ += company.speedZ;
          
          // Calculate position on tilted orbital plane (orbit expands with Earth)
          const radius = company.orbitRadius * earthExpansionFactor;
          const x = radius * Math.cos(company.angleY);
          const y = radius * Math.sin(company.angleY) * Math.sin(company.inclination);
          const z = radius * Math.sin(company.angleY) * Math.cos(company.inclination);
          
          // Apply Earth's rotation to make orbit relative to Earth
          const rotated = rotate3D(x, y, z, rotationX, rotationY);
          
          // Calculate screen position and scale
          const scale = 1 / (1 + rotated.z * 0.003);
          const screenX = centerX + rotated.x * scale;
          const screenY = centerY + rotated.y * scale;
          
          // Find and draw connections to nearest Earth particles
          if (rotated.z > -currentEarthRadius * 2 && scale > 0) {
            const nearestParticles = findNearestParticles(rotated, 5);
            
            ctx.strokeStyle = `rgba(100, 150, 255, ${0.2 * scale})`;
            ctx.lineWidth = 0.5;
            
            nearestParticles.forEach(({ rotated: pRotated }) => {
              const pScale = 1 / (1 + pRotated.z * 0.003);
              const pScreenX = centerX + pRotated.x * pScale;
              const pScreenY = centerY + pRotated.y * pScale;
              
              ctx.beginPath();
              ctx.moveTo(screenX, screenY);
              ctx.lineTo(pScreenX, pScreenY);
              ctx.stroke();
            });
          }
          
          // Draw logo if in front and loaded
          if (rotated.z > -currentEarthRadius * 2 && scale > 0) {
            const logoSize = 20 * scale;
            const logo = logoImages[company.name];
            
            if (logo && (logo.complete || logo instanceof HTMLCanvasElement)) {
              ctx.drawImage(
                logo,
                screenX - logoSize / 2,
                screenY - logoSize / 2,
                logoSize,
                logoSize
              );
            }
          }
        });
        
        ctx.restore();
      }
      
      // MOCKLY text particles - reverse formation on scroll
      const textOpacity = Math.max(0, 1 - (progress * 1.5)); // Fade faster
      
      if (textOpacity > 0.01) {
        ctx.save();
        ctx.globalAlpha = textOpacity;
        
        for (const p of textParticles) {
          // Lerp between home position (formed) and initial scattered position based on scroll
          const targetX = p.homeX + (p.initialX - p.homeX) * progress;
          const targetY = p.homeY + (p.initialY - p.homeY) * progress;
          
          // Spring force towards target (home when progress=0, scattered when progress=1)
          const springStrength = homeStrength * (1 - progress * 0.5);
          p.vx += (targetX - p.x) * springStrength;
          p.vy += (targetY - p.y) * springStrength;
          
          // Mouse interaction (only when not scrolling much)
          if (progress < 0.3) {
            let dx = p.x - mouse.x;
            let dy = p.y - mouse.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            let minDist = dist;
            let closestDx = dx;
            let closestDy = dy;
            
            if (mouse.prevX !== -9999) {
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
              const pushDirection = { x: closestDx / minDist, y: closestDy / minDist };
              const distanceFactor = 1 - (minDist / influenceRadius);
              const influence = Math.pow(distanceFactor, 3) * mouseInfluence;
              
              p.vx += pushDirection.x * mouseStrength * influence * 50;
              p.vy += pushDirection.y * mouseStrength * influence * 50;
            }
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
          
          // Render particle
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }
      
      requestAnimationFrame(animate);
    }
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      initializeSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
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

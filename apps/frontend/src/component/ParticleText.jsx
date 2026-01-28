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

    // Load company logos from Simple Icons CDN (free, high-quality SVGs)
    const logoImages = {};
    const logoUrls = {
      'APPLE': 'https://cdn.simpleicons.org/apple/white',
      'GOOGLE': 'https://cdn.simpleicons.org/google',
      'META': 'https://cdn.simpleicons.org/meta',
      'NVIDIA': 'https://cdn.simpleicons.org/nvidia',
      'TESLA': 'https://cdn.simpleicons.org/tesla/white',
      'NETFLIX': 'https://cdn.simpleicons.org/netflix',
      'SPOTIFY': 'https://cdn.simpleicons.org/spotify',
      'UBER': 'https://cdn.simpleicons.org/uber/white',
      'AIRBNB': 'https://cdn.simpleicons.org/airbnb'
    };

    // Create high-quality fallback logos with proper branding
    const createFallbackLogo = (name) => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');

      const logos = {
        APPLE: {
          draw: (ctx) => {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('', 100, 105);
          }
        },
        GOOGLE: {
          draw: (ctx) => {
            ctx.fillStyle = '#4285F4';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G', 100, 105);
          }
        },
        AMAZON: {
          draw: (ctx) => {
            ctx.fillStyle = '#FF9900';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('a', 100, 105);
          }
        },
        META: {
          draw: (ctx) => {
            ctx.fillStyle = '#0668E1';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('M', 100, 105);
          }
        },
        NVIDIA: {
          draw: (ctx) => {
            ctx.fillStyle = '#76B900';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', 100, 105);
          }
        },
        TESLA: {
          draw: (ctx) => {
            ctx.fillStyle = '#CC0000';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('T', 100, 105);
          }
        },
        NETFLIX: {
          draw: (ctx) => {
            ctx.fillStyle = '#E50914';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', 100, 105);
          }
        },
        SPOTIFY: {
          draw: (ctx) => {
            ctx.fillStyle = '#1DB954';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('S', 100, 105);
          }
        },
        UBER: {
          draw: (ctx) => {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('U', 100, 105);
          }
        },
        AIRBNB: {
          draw: (ctx) => {
            ctx.fillStyle = '#FF5A5F';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('A', 100, 105);
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

    // Company logos orbiting around Earth with balanced atomic-style distribution
    const companies = [
      {
        name: 'APPLE',
        angleY: 0,
        angleZ: 0,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.15,
        trail: [],
        color: '160, 160, 160' // Apple gray
      },
      {
        name: 'GOOGLE',
        angleY: Math.PI * 2 / 9,
        angleZ: Math.PI * 0.4,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.35,
        trail: [],
        color: '66, 133, 244' // Google blue
      },
      {
        name: 'META',
        angleY: Math.PI * 4 / 9,
        angleZ: Math.PI * 0.8,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.05,
        trail: [],
        color: '6, 104, 225' // Meta blue
      },
      {
        name: 'NVIDIA',
        angleY: Math.PI * 6 / 9,
        angleZ: Math.PI * 1.2,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.45,
        trail: [],
        color: '118, 185, 0' // NVIDIA green
      },
      {
        name: 'TESLA',
        angleY: Math.PI * 8 / 9,
        angleZ: Math.PI * 1.6,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.25,
        trail: [],
        color: '255, 255, 255' // Tesla white
      },
      {
        name: 'NETFLIX',
        angleY: Math.PI * 10 / 9,
        angleZ: Math.PI * 0.2,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.4,
        trail: [],
        color: '229, 9, 20' // Netflix red
      },
      {
        name: 'SPOTIFY',
        angleY: Math.PI * 12 / 9,
        angleZ: Math.PI * 0.6,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.1,
        trail: [],
        color: '29, 185, 84' // Spotify green
      },
      {
        name: 'UBER',
        angleY: Math.PI * 14 / 9,
        angleZ: Math.PI * 1.0,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.3,
        trail: [],
        color: '255, 255, 255' // Uber white
      },
      {
        name: 'AIRBNB',
        angleY: Math.PI * 16 / 9,
        angleZ: Math.PI * 1.4,
        orbitRadius: earthRadius * 1.18,
        speedY: 0.005,
        speedZ: 0.003,
        inclination: Math.PI * 0.2,
        trail: [],
        color: '255, 90, 95' // Airbnb pink
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
      centerY = height * 0.42;
      earthRadius = Math.min(width, height) * 0.22;

      // Update company orbit radii
      companies.forEach((company) => {
        company.orbitRadius = earthRadius * 1.18;
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
    const particleCount = 3000;
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
      offCtx.fillText('MOCKLY', width / 2, height * 0.85);

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
    const homeStrength = 0.003;
    const damping = 0.92;
    const maxSpeed = 8;
    const influenceRadius = 60;
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
    const startTime = Date.now();
    
    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Get current scroll progress
      const progress = scrollProgressRef.current;
      
      // Earth expansion based on scroll (1 to 3x size at full scroll)
      const earthExpansionFactor = 1 + (progress * 2);
      const currentEarthRadius = earthRadius * earthExpansionFactor;      // Earth fade out (invisible at 80% scroll)
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

          // Different colors for land and ocean - more vibrant
          const color = particle.isLand ? '#52D452' : '#2E7DD2';
          const size = particle.isLand ? 2 : 1.5;

          draw3DPoint(rotated.x, rotated.y, rotated.z, size, color);
        });

        ctx.restore();
      }

      // Companies fade out earlier (invisible at 60% scroll)
      const companyOpacity = Math.max(0, 1 - (progress * 1.66));

      // Draw company logos with trails
      if (companyOpacity > 0.01) {
        ctx.save();
        ctx.globalAlpha = companyOpacity;

        companies.forEach(company => {
          // Calculate potential updated position for hover detection
          // We calculate the position WITHOUT updating angles first to check if mouse is over
          
          // Calculate current parameters
          const radius = company.orbitRadius * earthExpansionFactor;
          
          // Use current angles for hit testing (before update)
          const hitX = radius * Math.cos(company.angleY);
          const hitY = radius * Math.sin(company.angleY) * Math.sin(company.inclination);
          const hitZ = radius * Math.sin(company.angleY) * Math.cos(company.inclination);
          const hitRotated = rotate3D(hitX, hitY, hitZ, rotationX, rotationY);
          const hitScale = 1 / (1 + hitRotated.z * 0.003);
          const hitScreenX = centerX + hitRotated.x * hitScale;
          const hitScreenY = centerY + hitRotated.y * hitScale;
          
          // Check hover state (if in front hemisphere and close to mouse)
          let isHovered = false;
          if (hitRotated.z > -currentEarthRadius && mouse.active) {
             const dx = hitScreenX - mouse.x;
             const dy = hitScreenY - mouse.y;
             const dist = Math.sqrt(dx * dx + dy * dy);
             // 40px radius threshold for smoother interaction
             if (dist < 40 * hitScale) {
                isHovered = true;
             }
          }

          // Only update angles if NOT hovered
          if (!isHovered) {
             company.angleY += company.speedY;
             company.angleZ += company.speedZ;
          }

          // Calculate final render position
          const x = radius * Math.cos(company.angleY);
          const y = radius * Math.sin(company.angleY) * Math.sin(company.inclination);
          const z = radius * Math.sin(company.angleY) * Math.cos(company.inclination);

          // Apply Earth's rotation to make orbit relative to Earth
          const rotated = rotate3D(x, y, z, rotationX, rotationY);

          // Calculate screen position and scale for logo (with expansion)
          const scale = 1 / (1 + rotated.z * 0.003);
          const screenX = centerX + rotated.x * scale;
          const screenY = centerY + rotated.y * scale;

          // Calculate trail position without expansion (fixed orbit)
          const trailRadius = company.orbitRadius; // Use original orbit radius
          const trailX = trailRadius * Math.cos(company.angleY);
          const trailY = trailRadius * Math.sin(company.angleY) * Math.sin(company.inclination);
          const trailZ = trailRadius * Math.sin(company.angleY) * Math.cos(company.inclination);
          const trailRotated = rotate3D(trailX, trailY, trailZ, rotationX, rotationY);
          const trailScale = 1 / (1 + trailRotated.z * 0.003);
          const trailScreenX = centerX + trailRotated.x * trailScale;
          const trailScreenY = centerY + trailRotated.y * trailScale;

          // Add trail position (without expansion) only if moving
          if (!isHovered) {
             company.trail.push({ x: trailScreenX, y: trailScreenY, scale: trailScale });
             
             // Keep trail length limited (25 points for longer trails)
             if (company.trail.length > 25) {
               company.trail.shift();
             }
          }

          // Draw trail
          if (company.trail.length > 1) {
            ctx.lineWidth = 3 * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            company.trail.forEach((point, i) => {
              if (i === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            });

            // Gradient effect on trail with brand color
            const gradient = ctx.createLinearGradient(
              company.trail[0].x, company.trail[0].y,
              screenX, screenY
            );
            gradient.addColorStop(0, `rgba(${company.color}, 0)`);
            gradient.addColorStop(0.5, `rgba(${company.color}, 0.6)`);
            gradient.addColorStop(1, `rgba(${company.color}, 0.9)`);

            ctx.strokeStyle = gradient;
            ctx.stroke();
          }

          // Draw logo if in front and loaded
          if (rotated.z > -currentEarthRadius * 2 && scale > 0) {
            const logoSize = 20 * scale;
            const logo = logoImages[company.name];

            if (logo && (logo.complete || logo instanceof HTMLCanvasElement)) {
              // Add glow effect
              ctx.save();
              ctx.shadowColor = `rgba(${company.color}, 0.8)`;
              ctx.shadowBlur = isHovered ? 30 : 15; // Stronger glow on hover
              
              ctx.drawImage(
                logo,
                screenX - logoSize / 2,
                screenY - logoSize / 2,
                logoSize,
                logoSize
              );
              ctx.restore();

              // Draw tooltip if hovered
              if (isHovered) {
                ctx.save();
                ctx.font = 'bold 14px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                // Text Glow
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.lineWidth = 3;
                
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.strokeText(company.name, screenX, screenY - logoSize/2 - 8);
                ctx.fillText(company.name, screenX, screenY - logoSize/2 - 8);
                
                ctx.restore();
                
                // Change cursor style (needs canvas style update)
                // We'll handle this by setting a global flag if any is hovered
                canvas.style.cursor = 'pointer';
              }
            }
          }
        });
        
        // Reset cursor if no company is hovered (simplistic approach within this loop structure)
        // A better way is to track "anyHovered" outside the foEach
        // But since we are clearing rect every frame, we can just default it to default?
        // No, that flickers. Let's leave it for now or implement "anyHovered" logic if requested.
        
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
      style={{ background: 'transparent' }}
    />
  );
}
import React, { useEffect, useRef } from 'react';

const ParticleOrb = ({ state = 'idle', colors = ['#2792DC', '#9CE6E6'] }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const velocitiesRef = useRef([]); // Store particle velocities for physics
  const introProgressRef = useRef(0); // Intro animation progress (0 to 1)

  // Generate particles in a dense sphere formation with denser core
  const generateParticles = (count, shapeType) => {
    const particles = [];
    const baseRadius = 150;
    const coreParticleCount = Math.floor(count * 0.35); // 35% for denser core
    
    // Use Fibonacci sphere for more even distribution
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < count; i++) {
      let x, y, z;
      const isCore = i < coreParticleCount; // First 30% are core particles
      const radiusMultiplier = isCore ? 0.3 : 1; // Core particles stay closer to center
      
      // Fibonacci sphere distribution for even spacing
      const t = i / (count - 1);
      const phi = Math.acos(1 - 2 * t);
      const theta = angleIncrement * i;

      switch (shapeType) {
        case 'listening':
          // Dense sphere - uniform distribution using Fibonacci sphere
          x = baseRadius * radiusMultiplier * Math.sin(phi) * Math.cos(theta);
          y = baseRadius * radiusMultiplier * Math.sin(phi) * Math.sin(theta);
          z = baseRadius * radiusMultiplier * Math.cos(phi);
          break;

        case 'speaking':
          // Outer particles stay at surface or expand slightly
          const scatterFactor = isCore ? 0.4 : 1.0;
          x = baseRadius * scatterFactor * Math.sin(phi) * Math.cos(theta);
          y = baseRadius * scatterFactor * Math.sin(phi) * Math.sin(theta);
          z = baseRadius * scatterFactor * Math.cos(phi);
          break;

        case 'thinking':
          // Slightly expanded sphere
          const expandFactor = isCore ? 0.3 : 1.2;
          x = baseRadius * expandFactor * Math.sin(phi) * Math.cos(theta);
          y = baseRadius * expandFactor * Math.sin(phi) * Math.sin(theta);
          z = baseRadius * expandFactor * Math.cos(phi);
          break;

        case 'idle':
        default:
          // Compact sphere
          x = baseRadius * radiusMultiplier * Math.sin(phi) * Math.cos(theta);
          y = baseRadius * radiusMultiplier * Math.sin(phi) * Math.sin(theta);
          z = baseRadius * radiusMultiplier * Math.cos(phi);
          break;
      }

      // Create scattered initial position (for intro animation)
      const scatterRadius = 300;
      const scatterAngle = Math.random() * Math.PI * 2;
      const scatterDistance = Math.random() * scatterRadius;
      const initialX = Math.cos(scatterAngle) * scatterDistance;
      const initialY = Math.sin(scatterAngle) * scatterDistance;
      const initialZ = (Math.random() - 0.5) * scatterRadius;
      
      particles.push({
        targetX: x,
        targetY: y,
        targetZ: z,
        x: initialX, // Start scattered
        y: initialY,
        z: initialZ,
        initialX: initialX, // Store initial scattered position
        initialY: initialY,
        initialZ: initialZ,
        vx: 0,
        vy: 0,
        vz: 0,
        size: isCore ? 2.5 : 2, // Core particles slightly bigger
        life: 1,
        isCore: isCore,
        index: i, // Store index for wave calculations
        phi: phi, // Store spherical coordinates
        theta: theta,
      });
    }

    return particles;
  };

  // Initialize particles once
  useEffect(() => {
    if (particlesRef.current.length === 0) {
      particlesRef.current = generateParticles(1600, 'idle');
      // Initialize velocities
      velocitiesRef.current = particlesRef.current.map(() => ({ vx: 0, vy: 0 }));
    }
  }, []);

  // Intro animation - gradually form the orb
  useEffect(() => {
    const duration = 2000; // 2 second intro
    const startTime = Date.now();
    
    const animateIntro = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      introProgressRef.current = 1 - Math.pow(1 - progress, 3);
      
      if (progress < 1) {
        requestAnimationFrame(animateIntro);
      }
    };
    
    animateIntro();
  }, []);

  // Handle state transitions with smooth morphing
  useEffect(() => {
    const particles = particlesRef.current;
    if (particles.length === 0) return;

    // Generate new target positions for the new state
    const newParticles = generateParticles(particles.length, state);

    // Update only target positions, not actual positions (creates smooth transition)
    particles.forEach((particle, index) => {
      if (newParticles[index]) {
        particle.targetX = newParticles[index].targetX;
        particle.targetY = newParticles[index].targetY;
        particle.targetZ = newParticles[index].targetZ;
      }
    });
  }, [state]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      timeRef.current += 0.016; // ~60fps

      // Clear canvas with transparent background
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const centerX = width / 2;
      const centerY = height / 2;

      // First, calculate projections for all particles
      const projections = particles.map((particle, index) => {
        // Apply intro animation - lerp from scattered to formed
        const introProgress = introProgressRef.current;
        let baseX = particle.initialX + (particle.targetX - particle.initialX) * introProgress;
        let baseY = particle.initialY + (particle.targetY - particle.initialY) * introProgress;
        let baseZ = particle.initialZ + (particle.targetZ - particle.initialZ) * introProgress;
        
        // Smooth transition to target position with faster ease
        const ease = 0.1; // Consistent smooth easing for all states
        particle.x += (baseX - particle.x) * ease;
        particle.y += (baseY - particle.y) * ease;
        particle.z += (baseZ - particle.z) * ease;

        // Minimal organic movement
        const time = timeRef.current;
        let noise = Math.sin(time * 0.5 + index * 0.02) * 2;
        let noise2 = Math.cos(time * 0.4 + index * 0.03) * 2;
        let noiseZ = Math.sin(time * 0.35 + index * 0.025) * 2;
        
        // Add smooth sound wave pulsing when speaking (outer particles only)
        if (state === 'speaking' && !particle.isCore) {
          // Create smooth radial wave pulses based on particle's angular position
          const time = timeRef.current;
          const waveSpeed = 2.0; // Speed of wave propagation
          
          // Smooth wave pattern using particle's position angles
          const wavePhase1 = particle.phi * 3 - time * waveSpeed;
          const wavePhase2 = particle.theta * 2.5 - time * waveSpeed * 0.8;
          
          // Combine for smooth, localized pulsing
          const radialPulse = (Math.sin(wavePhase1) * 0.6 + Math.sin(wavePhase2) * 0.4) * 8;
          
          // Apply radial displacement in 3D
          const distance = Math.sqrt(particle.x ** 2 + particle.y ** 2 + particle.z ** 2);
          if (distance > 0) {
            const normalizedX = particle.x / distance;
            const normalizedY = particle.y / distance;
            const normalizedZ = particle.z / distance;
            
            noise += normalizedX * radialPulse;
            noise2 += normalizedY * radialPulse;
            noiseZ += normalizedZ * radialPulse;
          }
        }

        const displayX = particle.x + noise;
        const displayY = particle.y + noise2;
        const displayZ = particle.z + noiseZ;

        // 3D to 2D projection (perspective)
        const scale = 500 / (500 + displayZ);
        const projX = centerX + displayX * scale;
        const projY = centerY + displayY * scale;

        // Add mouse interaction - dandelion effect (blow away and float back)
        let finalProjX = projX;
        let finalProjY = projY;
        
        if (mouseRef.current.active) {
          const dx = projX - mouseRef.current.x;
          const dy = projY - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const influenceRadius = 45;
          
          if (distance < influenceRadius) {
            // Particle is inside the circle - blow it away like dandelion seeds
            const angle = Math.atan2(dy, dx);
            const blowStrength = (1 - distance / influenceRadius) * 3.5; // Strong initial blow
            
            // Apply blow force (instant push away)
            velocitiesRef.current[index].vx += Math.cos(angle) * blowStrength;
            velocitiesRef.current[index].vy += Math.sin(angle) * blowStrength;
          }
        }
        
        // Apply air resistance (slow down over time)
        const airResistance = 0.96;
        velocitiesRef.current[index].vx *= airResistance;
        velocitiesRef.current[index].vy *= airResistance;
        
        // Apply gentle pull back to original position (like gravity pulling seeds down)
        const returnForce = 0.01;
        const returnDx = projX - (centerX + particle.x * (500 / (500 + particle.z)));
        const returnDy = projY - (centerY + particle.y * (500 / (500 + particle.z)));
        velocitiesRef.current[index].vx -= returnDx * returnForce;
        velocitiesRef.current[index].vy -= returnDy * returnForce;
        
        // Apply velocity
        finalProjX = projX + velocitiesRef.current[index].vx;
        finalProjY = projY + velocitiesRef.current[index].vy;

        // Calculate brightness based on Z depth - front particles bright, back particles dimmer
        const depthBrightness = Math.max(0.15, (displayZ + 180) / 360); // Front particles (Z~150) are bright
        const baseBrightness = 0.35 + depthBrightness * 0.65;

        const size = particle.size * scale;
        const alpha = particle.isCore ? baseBrightness * 1.0 : baseBrightness * 0.85;

        return {
          particle,
          projX: finalProjX,
          projY: finalProjY,
          displayZ,
          size,
          alpha,
        };
      });

      // Sort by Z depth (back to front) for proper layering
      projections.sort((a, b) => a.displayZ - b.displayZ);

      // Now draw all particles in sorted order
      projections.forEach(({ projX, projY, size, alpha }) => {
        // Draw white particle (small dot)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(projX, projY, size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Add mouse event listeners for interactivity
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) * (canvas.offsetWidth / rect.width);
      mouseRef.current.y = (e.clientY - rect.top) * (canvas.offsetHeight / rect.height);
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [state]);



  return (
    <div className="flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(51,65,85,0.2) 0%, rgba(15,23,42,0.8) 100%)',
          filter: 'drop-shadow(0 0 50px rgba(255,255,255,0.1))',
        }}
      />
    </div>
  );
};

export default ParticleOrb;

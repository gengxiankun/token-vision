'use client';

import { useEffect, useRef } from 'react';

/* ── Types ──────────────────────────────── */
interface MatrixRainProps {
  mode: 'dark' | 'light';
  opacity?: number;
}

/* ── Characters ─────────────────────────── */
const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョ0123456789abcdefghijklmnopqrstuvwxyz';

/* ── Drop state ─────────────────────────── */
interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
  fade: number; // 0..1 brightness multiplier per column
}

/* ── Component ──────────────────────────── */
export default function MatrixRain({ mode, opacity = 0.85 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = mode === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let drops: Drop[] = [];
    let prevTime = 0;

    /* ── Resize ── */
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = w;
      canvas.height = h;

      // Rebuild drops on resize to match new width
      const colWidth = 14;
      const numCols = Math.ceil(w / colWidth);
      drops = [];
      for (let i = 0; i < numCols; i++) {
        const len = Math.floor(Math.random() * 15) + 5;
        const drop: Drop = {
          x: i * colWidth,
          y: Math.random() * h * -1,
          speed: (Math.random() * 2 + 0.5),
          length: len,
          chars: [],
          fade: Math.random() * 0.4 + 0.6,
        };
        for (let j = 0; j < len; j++) {
          drop.chars.push(CHARS[Math.floor(Math.random() * CHARS.length)]);
        }
        drops.push(drop);
      }
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement ?? canvas);

    /* ── Colors ── */
    const darkBg = 'rgba(0, 0, 0, 1)';
    const lightBg = 'rgba(232, 230, 224, 1)';
    // Dark mode: classic green/cyan
    const darkHead = 'rgba(200, 255, 200, 1)';
    const darkBody = (brightness: number) =>
      `rgba(${Math.round(50 * brightness)}, ${Math.round(255 * brightness)}, ${Math.round(150 * brightness)}, ${brightness * opacity})`;
    // Light mode: dark green on light bg
    const lightHead = 'rgba(0, 80, 0, 1)';
    const lightBody = (brightness: number) =>
      `rgba(${Math.round(0 * brightness)}, ${Math.round(100 * brightness)}, ${Math.round(50 * brightness)}, ${brightness * opacity})`;

    /* ── Animate ── */
    const animate = (time: number) => {
      // Throttle to ~25fps (40ms per frame)
      const elapsed = time - prevTime;
      if (elapsed < 40) {
        animId = requestAnimationFrame(animate);
        return;
      }
      prevTime = time - (elapsed % 40);

      const w = canvas.width;
      const h = canvas.height;

      // Semi-transparent rectangle for trail effect (fade)
      ctx.fillStyle = isDark ? darkBg : lightBg;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      const fontSize = 13;
      ctx.font = `${fontSize}px monospace`;

      for (const drop of drops) {
        if (drop.chars.length === 0) continue;

        // Update characters occasionally for shimmer
        if (Math.random() < 0.03) {
          const idx = Math.floor(Math.random() * drop.chars.length);
          drop.chars[idx] = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        // Draw all characters in the column
        for (let j = 0; j < drop.length; j++) {
          const charY = drop.y - j * fontSize;
          if (charY < -fontSize || charY > h + fontSize) continue;

          const char = drop.chars[j];
          const brightness = 1 - (j / drop.length) * 0.6;
          const bCapped = Math.max(0.15, brightness * drop.fade);

          if (j === 0) {
            // Leading character — brightest
            ctx.fillStyle = isDark ? darkHead : lightHead;
            ctx.globalAlpha = 0.95 * opacity;
          } else if (j < 3) {
            // Next few — still bright
            ctx.fillStyle = isDark
              ? `rgba(180, 255, 180, ${bCapped * opacity})`
              : `rgba(0, 120, 60, ${bCapped * opacity})`;
            ctx.globalAlpha = bCapped * opacity;
          } else {
            // Tail — fading
            const color = isDark ? darkBody(bCapped) : lightBody(bCapped);
            ctx.fillStyle = color;
            ctx.globalAlpha = bCapped * opacity;
          }

          ctx.fillText(char, drop.x, charY);
        }

        // Move drop downward
        drop.y += drop.speed;

        // Reset drop when it goes off screen
        if (drop.y - drop.length * fontSize > h) {
          drop.y = -drop.length * fontSize;
          drop.speed = Math.random() * 2 + 0.5;
          drop.length = Math.floor(Math.random() * 15) + 5;
          drop.fade = Math.random() * 0.4 + 0.6;
          // Regenerate characters
          drop.chars = [];
          for (let j = 0; j < drop.length; j++) {
            drop.chars.push(CHARS[Math.floor(Math.random() * CHARS.length)]);
          }
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [mode, opacity]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
}

"use client";

import { useEffect, useRef } from "react";

const COLOURS = ["#c8ff4d", "#ff5c97", "#a78bfa", "#4de1ff", "#fbbf24", "#fafafa"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  colour: string;
  round: boolean;
}

/**
 * One burst of confetti from the middle of the screen, drawn on a canvas (no library) and gone after
 * a few seconds. Draws nothing for visitors who prefer reduced motion.
 */
export default function Confetti({ pieces = 150 }: { pieces?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);

    const confetti: Piece[] = Array.from({ length: pieces }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 14;
      return {
        x: width / 2,
        y: height * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
        size: 6 + Math.random() * 8,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        round: Math.random() < 0.3,
      };
    });

    const FRAMES = 300;
    let frame = 0;
    let handle = 0;
    const tick = () => {
      context.clearRect(0, 0, width, height);
      frame++;
      const fade = frame > FRAMES - 50 ? Math.max(0, (FRAMES - frame) / 50) : 1;
      for (const piece of confetti) {
        piece.vy += 0.24;
        piece.vx *= 0.985;
        piece.vy *= 0.99;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;
        context.save();
        context.globalAlpha = fade;
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.colour;
        if (piece.round) {
          context.beginPath();
          context.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        }
        context.restore();
      }
      if (frame < FRAMES) handle = requestAnimationFrame(tick);
      else context.clearRect(0, 0, width, height);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [pieces]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />;
}

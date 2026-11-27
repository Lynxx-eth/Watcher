import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Grid + vignette + scanlines + slow vertical scan beam. Pure CSS. */
export function Backdrop({ beam = true }: { beam?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="w-backdrop" aria-hidden>
      <div className="w-backdrop__grid" />
      <div className="w-backdrop__scan" />
      {beam && !reduced && <div className="w-backdrop__beam" />}
    </div>
  );
}

/**
 * Lightweight drifting particle field (2D canvas). Used as an ambient
 * background only; real 3D scenes live in client/src/three.
 */
export function ParticleField({ count = 90 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.18,
      r: 0.5 + Math.random() * 1.4,
      a: 0.2 + Math.random() * 0.6,
    }));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -4) {
            p.y = h + 4;
            p.x = Math.random() * w;
          }
          if (p.x < -4) p.x = w + 4;
          if (p.x > w + 4) p.x = -4;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 210, 255, ${p.a})`;
        ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count, reduced]);

  return <canvas ref={ref} className="w-particles" style={{ width: "100%", height: "100%" }} aria-hidden />;
}

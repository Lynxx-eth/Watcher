import { useEffect, useRef } from "react";
import { useReducedMotion } from "@watcher/ui";

/**
 * Simulated multi-channel "neural activity" trace (canvas). Purely visual:
 * it is generated from sine/noise mixes, not measured from anything.
 */
const DEFAULT_CHANNELS = ["FRONTAL", "PARIETAL", "TEMPORAL", "OCCIPITAL", "CEREBELLUM"];

export function NeuralWaveform({ channels = DEFAULT_CHANNELS, focus }: { channels?: string[]; focus?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const focusRef = useRef(focus);
  focusRef.current = focus;

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let raf = 0;
    let t = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const rowH = h / channels.length;
      channels.forEach((name, ci) => {
        const mid = rowH * ci + rowH / 2;
        const on = focusRef.current?.toUpperCase().startsWith(name);
        ctx.strokeStyle = "rgba(0,190,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(70, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
        ctx.fillStyle = on ? "#ffb52e" : "#4d6280";
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillText(name, 4, mid + 3);
        ctx.strokeStyle = on ? "#ffb52e" : "#00e5ff";
        ctx.lineWidth = on ? 1.6 : 1;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 70; x < w; x += 2) {
          const k = (x + t * 60) * 0.02;
          const amp = rowH * (on ? 0.38 : 0.24);
          const y =
            mid +
            Math.sin(k * (1.3 + ci * 0.37)) * amp * 0.5 +
            Math.sin(k * (4.1 + ci) + ci) * amp * 0.25 +
            Math.sin(k * 11.7 + t * (2 + ci)) * amp * 0.15 * (Math.sin(k * 0.3 + t) > 0.6 ? 2.4 : 1);
          if (x === 70) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      if (!reduced) {
        t += 1 / 60;
        raf = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [channels, reduced]);

  return (
    <div className="nwave">
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} aria-label="Simulated neural activity trace" role="img" />
      <span className="nwave__tag">Simulated</span>
    </div>
  );
}

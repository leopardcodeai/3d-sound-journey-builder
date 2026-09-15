/**
 * landing
 * Hydrates the icon placeholders and draws the hero diagram: the same field
 * the app renders, in miniature and on a loop, with no audio attached.
 */
import './landing.css';
import { hydrateIcons, drawGlyph } from './ui/Icons.js';

hydrateIcons(document);

const canvas = document.getElementById('hero-canvas');
if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2 + 8;
  const scale = 17; // pixels per metre

  // Each node walks its own slow orbit so the diagram stays alive.
  const nodes = [
    { glyph: 'bird', color: '#7fb069', label: 'Birdsong', r: 5.4, a: 1.1, speed: 0.09, z: 2.4 },
    { glyph: 'whale', color: '#6b7cff', label: 'Whales', r: 8.1, a: 3.4, speed: -0.05, z: -1.6 },
    { glyph: 'flame', color: '#ef8a5a', label: 'Campfire', r: 2.9, a: 4.6, speed: 0.13, z: 0 },
    { glyph: 'bowl', color: '#d4a24c', label: 'Singing bowl', r: 6.3, a: 5.7, speed: -0.07, z: 3.1 },
    { glyph: 'wave', color: '#2ec4b6', label: '10 Hz', r: 0, a: 0, speed: 0, z: 0, locked: true },
  ];

  const project = (x, y) => ({ x: cx + x * scale, y: cy - y * scale });

  function frame(t) {
    const time = t / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0c0c';
    ctx.fillRect(0, 0, W, H);

    // Distance rings
    for (let r = 2; r <= 10; r += 2) {
      ctx.strokeStyle = r % 10 === 0 ? 'rgba(255,246,236,0.10)' : 'rgba(255,246,236,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,246,236,0.24)';
      ctx.font = '9px "SF Mono", Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${r} m`, cx + r * scale + 4, cy - 4);
    }

    // Spokes
    for (let a = 0; a < 360; a += 45) {
      const rad = (a * Math.PI) / 180;
      ctx.strokeStyle = 'rgba(255,246,236,0.035)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * scale, cy - Math.sin(rad) * scale);
      ctx.lineTo(cx + Math.cos(rad) * 10 * scale, cy - Math.sin(rad) * 10 * scale);
      ctx.stroke();
    }

    // Listener: head, shoulders, headphone cups
    ctx.strokeStyle = 'rgba(255,246,236,0.5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - 0.62 * scale, cy + 0.28 * scale);
    ctx.lineTo(cx + 0.62 * scale, cy + 0.28 * scale);
    ctx.stroke();
    ctx.fillStyle = '#0f1013';
    ctx.strokeStyle = 'rgba(255,246,236,0.78)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.3 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.3 * scale);
    ctx.lineTo(cx, cy - 0.58 * scale);
    ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.6);
    for (const dx of [-0.32, 0.32]) {
      ctx.fillStyle = `rgba(242, 111, 59, ${0.35 + pulse * 0.45})`;
      ctx.beginPath();
      ctx.arc(cx + dx * scale, cy, 0.1 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(242, 111, 59, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.4 * scale, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Nodes
    for (const n of nodes) {
      const angle = n.a + time * n.speed;
      const p = n.locked ? project(1.5, 1.2) : project(Math.cos(angle) * n.r, Math.sin(angle) * n.r);
      const radius = 14;

      // Trail for the moving ones
      if (!n.locked) {
        ctx.strokeStyle = hexAlpha(n.color, 0.14);
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, n.r * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Level halo
      const level = 0.35 + 0.35 * Math.sin(time * 1.1 + n.a * 2);
      const halo = ctx.createRadialGradient(p.x, p.y, radius * 0.8, p.x, p.y, radius * (1.9 + level));
      halo.addColorStop(0, hexAlpha(n.color, 0.22 * level));
      halo.addColorStop(1, hexAlpha(n.color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * (1.9 + level), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111215';
      ctx.strokeStyle = hexAlpha(n.color, 0.85);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Volume gauge
      ctx.strokeStyle = hexAlpha(n.color, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.4 + level * 0.4));
      ctx.stroke();

      ctx.strokeStyle = hexAlpha(n.color, 0.95);
      drawGlyph(ctx, n.glyph, p.x, p.y, radius * 1.15, 1.4);

      ctx.fillStyle = 'rgba(255,246,236,0.62)';
      ctx.font = '500 11px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, p.x, p.y + radius + 16);
      if (!n.locked) {
        ctx.fillStyle = 'rgba(255,246,236,0.3)';
        ctx.font = '9px "SF Mono", Menlo, monospace';
        ctx.fillText(`${n.r.toFixed(1)} m · ${n.z >= 0 ? '+' : ''}${n.z.toFixed(1)} m`, p.x, p.y + radius + 28);
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function hexAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

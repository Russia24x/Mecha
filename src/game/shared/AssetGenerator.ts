/**
 * MECHA: LAST PROTOCOL - AssetGenerator
 * Generates procedural background images as PNG data URLs at runtime.
 * Used by MenuScene, MapScene, and stage backgrounds.
 *
 * Each background is drawn on an offscreen canvas and saved as a data URL.
 * This avoids needing binary asset files while still producing rich visuals.
 */

export type BgId =
  | 'menu-bg'
  | 'map-bg'
  | 'factory-bg'
  | 'victory-bg'
  | 'comingsoon-bg'
  | 'skills-bg'
  | 'settings-bg';

export class AssetGenerator {
  private static cache: Partial<Record<BgId, string>> = {};

  static get(id: BgId, w = 1280, h = 720): string {
    if (this.cache[id]) return this.cache[id]!;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    switch (id) {
      case 'menu-bg':       this.drawMenuBg(ctx, w, h); break;
      case 'map-bg':        this.drawMapBg(ctx, w, h); break;
      case 'factory-bg':    this.drawFactoryBg(ctx, w, h); break;
      case 'victory-bg':    this.drawVictoryBg(ctx, w, h); break;
      case 'comingsoon-bg': this.drawComingSoonBg(ctx, w, h); break;
      case 'skills-bg':     this.drawSkillsBg(ctx, w, h); break;
      case 'settings-bg':   this.drawSettingsBg(ctx, w, h); break;
    }

    const url = canvas.toDataURL('image/png');
    this.cache[id] = url;
    return url;
  }

  private static drawMenuBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Deep dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#020510');
    grad.addColorStop(0.5, '#0a1020');
    grad.addColorStop(1, '#050710');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Far skyline silhouette
    ctx.fillStyle = '#0a1428';
    for (let x = 0; x < w; x += 60) {
      const bh = 80 + Math.sin(x * 0.02) * 40 + (x % 120 < 60 ? 30 : 0);
      ctx.fillRect(x, h - bh - 100, 55, bh);
    }

    // Mid silhouette
    ctx.fillStyle = '#0e1a30';
    for (let x = 0; x < w; x += 90) {
      const bh = 120 + Math.cos(x * 0.015) * 50;
      ctx.fillRect(x, h - bh - 40, 80, bh);
    }

    // Window lights
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w;
      const y = h - 200 + Math.random() * 120;
      const alpha = 0.3 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(255, 230, 180, ${alpha})`;
      ctx.fillRect(x, y, 2, 3);
    }

    // Atmospheric glow at center
    const glow = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, 400);
    glow.addColorStop(0, 'rgba(57, 208, 216, 0.15)');
    glow.addColorStop(1, 'rgba(57, 208, 216, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  private static drawMapBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0a0d18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.strokeStyle = 'rgba(57, 208, 216, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Connection lines (between stage nodes)
    ctx.strokeStyle = 'rgba(57, 208, 216, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.75, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private static drawFactoryBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0d14');
    grad.addColorStop(0.4, '#121826');
    grad.addColorStop(1, '#05070d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Industrial pipes (background layer)
    ctx.fillStyle = '#2a3038';
    for (let y = 100; y < h - 100; y += 80) {
      ctx.fillRect(0, y, w, 8);
    }

    // Tank silhouettes
    ctx.fillStyle = '#1a2030';
    for (let x = 50; x < w; x += 200) {
      ctx.fillRect(x, h - 250, 80, 200);
      ctx.fillStyle = '#2a3038';
      ctx.fillRect(x - 10, h - 260, 100, 12);
      ctx.fillStyle = '#1a2030';
    }

    // Rust spots
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(138, 74, 42, ${0.1 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, 5 + Math.random() * 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Steam/smoke
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w + Math.random() * 50;
      const y = h * 0.3 + Math.random() * 100;
      const grad2 = ctx.createRadialGradient(x, y, 0, x, y, 80);
      grad2.addColorStop(0, 'rgba(60, 70, 80, 0.3)');
      grad2.addColorStop(1, 'rgba(60, 70, 80, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(x - 80, y - 80, 160, 160);
    }
  }

  private static drawVictoryBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, '#1a2820');
    grad.addColorStop(0.5, '#0a1410');
    grad.addColorStop(1, '#050a08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Light rays from top
    ctx.save();
    ctx.translate(w / 2, 0);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      const rayGrad = ctx.createLinearGradient(0, 0, 0, h);
      rayGrad.addColorStop(0, 'rgba(255, 224, 96, 0.08)');
      rayGrad.addColorStop(1, 'rgba(255, 224, 96, 0)');
      ctx.fillStyle = rayGrad;
      ctx.fillRect(-30, 0, 60, h);
    }
    ctx.restore();

    // Golden particles
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(255, 224, 96, ${0.2 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private static drawComingSoonBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(0.5, '#0a0a18');
    grad.addColorStop(1, '#080510');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Mysterious question marks / dots
    ctx.fillStyle = 'rgba(57, 208, 216, 0.05)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Diagonal lines
    ctx.strokeStyle = 'rgba(57, 208, 216, 0.04)';
    ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
  }

  private static drawSkillsBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#080814');
    grad.addColorStop(1, '#0a0a18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Hexagonal grid
    ctx.strokeStyle = 'rgba(255, 224, 96, 0.08)';
    ctx.lineWidth = 1;
    const hexSize = 30;
    for (let row = 0; row < h / hexSize; row++) {
      for (let col = 0; col < w / hexSize; col++) {
        const x = col * hexSize * 1.5;
        const y = row * hexSize * Math.sqrt(3) + (col % 2 ? hexSize * Math.sqrt(3) / 2 : 0);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const px = x + Math.cos(a) * hexSize / 2;
          const py = y + Math.sin(a) * hexSize / 2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  private static drawSettingsBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0a0d18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Concentric circles (like a gear)
    ctx.strokeStyle = 'rgba(57, 208, 216, 0.06)';
    ctx.lineWidth = 1;
    for (let r = 50; r < w; r += 50) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gear teeth (decorative)
    ctx.fillStyle = 'rgba(57, 208, 216, 0.04)';
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = 200;
      const r2 = 240;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.rotate(a);
      ctx.fillRect(-10, -5, 50, 10);
      ctx.restore();
    }
  }
}

export default AssetGenerator;

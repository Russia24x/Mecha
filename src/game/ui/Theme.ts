/**
 * MECHA: LAST PROTOCOL — UI Theme v1.0
 *
 * Shared visual language for all UI panels. Inspired by:
 *   - Blasphemous: dark intricate UI, corner brackets, scanlines
 *   - Armored Core 6: hexagonal nodes, tactical stats, corner accents
 *   - Child of Light: constellation feel (stars, soft glow)
 *
 * AESTHETIC: Neural Cortex — Mecha circuit/data network.
 * The pilot interfaces with their MECHA through circuit-board UI.
 */

// ─── Core palette ────────────────────────────────────────────────────────
export const THEME = {
  // Backgrounds
  BG_VOID: 0x05080c,        // darkest void
  BG_PANEL: 0x0a0d14,       // panel background
  BG_PANEL_HI: 0x0d1218,    // highlighted panel
  BG_DARK: 0x05080c,        // very dark

  // Strokes
  STROKE_DIM: 0x1a3040,     // dim border
  STROKE_MED: 0x2a3040,     // medium border
  STROKE_BRIGHT: 0x39d0d8,  // bright accent (cyan)

  // Text colors (hex strings for Text objects)
  TEXT_DIM: '#3a4350',
  TEXT_MED: '#5a6470',
  TEXT_BRIGHT: '#cfd6e0',
  TEXT_ACCENT: '#66f0ff',   // cyan accent
  TEXT_AMBER: '#ffc040',    // amber (Mecha)
  TEXT_GREEN: '#40ff80',    // green (active)
  TEXT_RED: '#ff4060',      // red (danger)
  TEXT_VIOLET: '#c060ff',   // violet (AI)

  // Status colors
  ACTIVE: 0x40ff80,         // online/active
  WARNING: 0xffc040,        // warning/ready
  DANGER: 0xff4060,         // danger/damaged
  OFFLINE: 0x3a4350,        // offline/locked

  // Brand colors
  AMBER: 0xffc040,          // Mecha amber
  CYAN: 0x39d0d8,           // Mecha cyan
} as const;

// ─── Corner accent helper ────────────────────────────────────────────────
// Adds tactical corner brackets to a panel (Blasphemous / Armored Core style)
export function addCornerBrackets(
  scene: Phaser.Scene,
  x: number, y: number, w: number, h: number,
  color: number = THEME.AMBER,
  size: number = 8,
  alpha: number = 0.6,
): Phaser.GameObjects.Polygon[] {
  const corners: Phaser.GameObjects.Polygon[] = [];
  // Top-left
  corners.push(scene.add.polygon(x - w / 2, y - h / 2, [0, 0, size, 0, 0, size], color, alpha));
  // Top-right
  corners.push(scene.add.polygon(x + w / 2, y - h / 2, [0, 0, -size, 0, 0, size], color, alpha));
  // Bottom-left
  corners.push(scene.add.polygon(x - w / 2, y + h / 2, [0, 0, size, 0, 0, -size], color, alpha));
  // Bottom-right
  corners.push(scene.add.polygon(x + w / 2, y + h / 2, [0, 0, -size, 0, 0, -size], color, alpha));
  return corners;
}

// ─── Scanline overlay ────────────────────────────────────────────────────
// Adds subtle horizontal scanlines (Blasphemous CRT feel)
export function addScanlines(scene: Phaser.Scene, w: number, h: number, alpha: number = 0.02): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xffffff, alpha);
  for (let y = 0; y < h; y += 3) { gfx.fillRect(0, y, w, 1); }
  return gfx;
}

// ─── Starfield background ────────────────────────────────────────────────
// Child of Light — constellation feel with twinkling stars
export function addStarfield(scene: Phaser.Scene, w: number, h: number, count: number = 60): Phaser.GameObjects.Arc[] {
  const stars: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < count; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    const star = scene.add.circle(sx, sy, Math.random() * 1.2 + 0.3, 0x40c0ff, Math.random() * 0.25 + 0.05);
    stars.push(star);
    if (Math.random() < 0.3) {
      scene.tweens.add({
        targets: star, alpha: { from: 0.1, to: 0.4 },
        duration: 1500 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    }
  }
  return stars;
}

// ─── Panel with corner brackets ──────────────────────────────────────────
export function createPanel(
  scene: Phaser.Scene,
  x: number, y: number, w: number, h: number,
  opts?: { color?: number; strokeColor?: number; strokeAlpha?: number; cornerColor?: number; cornerSize?: number },
): { bg: Phaser.GameObjects.Rectangle; corners: Phaser.GameObjects.Polygon[] } {
  const color = opts?.color ?? THEME.BG_PANEL;
  const strokeColor = opts?.strokeColor ?? THEME.STROKE_DIM;
  const strokeAlpha = opts?.strokeAlpha ?? 0.5;
  const cornerColor = opts?.cornerColor ?? THEME.AMBER;
  const cornerSize = opts?.cornerSize ?? 8;
  const bg = scene.add.rectangle(x, y, w, h, color, 0.95);
  bg.setStrokeStyle(1, strokeColor, strokeAlpha);
  const corners = addCornerBrackets(scene, x, y, w, h, cornerColor, cornerSize, 0.6);
  return { bg, corners };
}

// ─── Status color helper ─────────────────────────────────────────────────
export function getStatusColor(status: 'online' | 'offline' | 'warning' | 'danger'): number {
  switch (status) {
    case 'online': return THEME.ACTIVE;
    case 'warning': return THEME.WARNING;
    case 'danger': return THEME.DANGER;
    case 'offline': return THEME.OFFLINE;
  }
}

export function getStatusTextColor(status: 'online' | 'offline' | 'warning' | 'danger'): string {
  switch (status) {
    case 'online': return THEME.TEXT_GREEN;
    case 'warning': return THEME.TEXT_AMBER;
    case 'danger': return THEME.TEXT_RED;
    case 'offline': return THEME.TEXT_DIM;
  }
}

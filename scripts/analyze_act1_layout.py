#!/usr/bin/env python3
"""
Visualize Act I (Factory) level layout — ASCII map.
Helps identify layout issues before playing.
"""
import json
import sys

# Game constants
WIDTH = 1280
HEIGHT = 720
GROUND_Y = 680  # top of floor (floor at y=720, height=80)
SECTION_WIDTH = 1280

# ASCII canvas — 120 cols x 40 rows
COLS = 120
ROWS = 36

def x_to_col(x, total_width):
    return int((x / total_width) * (COLS - 1))

def y_to_row(y):
    # y=0 (top) → row 0, y=720 (bottom) → row ROWS-1
    return int((y / HEIGHT) * (ROWS - 1))

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def main():
    # Read acts.ts and extract platform data manually (hardcoded from file read)
    # Section data extracted from src/game/data/acts/acts.ts lines 61-279

    sections = [
        {
            'id': 1, 'x_start': 0, 'x_end': 1280, 'name': 'AWAKENING',
            'platforms': [
                (400, 560, 200, 20), (700, 460, 160, 20), (980, 540, 140, 20),
                (550, 280, 120, 20), (780, 180, 80, 20),
                (1200, 360, 40, 200),  # wall top
                (1200, 600, 40, 120),  # wall bottom
                (1260, 500, 40, 20),
            ],
            'hazards': [],
            'collectibles': [(780, 150, 'H')],
            'lore': [(300, 660, 'L'), (580, 260, 'L')],
            'shortcuts': [(1200, 500, 'S')],
        },
        {
            'id': 2, 'x_start': 1280, 'x_end': 2560, 'name': 'FIRST COMBAT',
            'platforms': [
                (1480, 520, 100, 20), (1700, 420, 140, 20), (2000, 520, 100, 20), (2300, 460, 120, 20),
                (1500, 260, 300, 16), (2100, 260, 200, 16),
                (1820, 340, 40, 200),
                (2540, 360, 40, 200), (2540, 600, 40, 120),
                (2400, 500, 140, 16),
            ],
            'hazards': [(1920, 690, 80, 20, 'spike'), (2200, 690, 80, 20, 'lava')],
            'collectibles': [(1600, 230, 'E')],
            'lore': [(2400, 580, 'L')],
            'shortcuts': [(2540, 500, 'S')],
        },
        {
            'id': 3, 'x_start': 2560, 'x_end': 3840, 'name': 'VERTICAL SHAFT',
            'platforms': [
                (2660, 580, 200, 20),
                (2800, 380, 40, 280), (3100, 380, 40, 280),
                (2950, 320, 100, 16), (2950, 200, 120, 16), (2750, 100, 80, 16),
                (3300, 580, 200, 20), (3540, 540, 140, 20),
                (3300, 380, 140, 20),
            ],
            'hazards': [(2850, 690, 240, 20, 'spike')],
            'collectibles': [(2760, 50, 'K')],
            'lore': [(2780, 80, 'L'), (2760, 80, 'L')],
            'shortcuts': [],
        },
        {
            'id': 4, 'x_start': 3840, 'x_end': 5120, 'name': 'ASSEMBLY HALL',
            'platforms': [
                (4240, 440, 40, 260), (4680, 440, 40, 260),
                (4440, 380, 100, 20),
                (4040, 480, 80, 20), (4900, 480, 80, 20),
                (4360, 220, 80, 16),
                (4100, 160, 200, 16), (4800, 160, 200, 16),
                (5000, 380, 120, 20), (5000, 240, 20, 200), (5000, 140, 120, 16),
            ],
            'hazards': [(4440, 340, 200, 4, 'laser')],
            'collectibles': [(5060, 350, 'H'), (4900, 130, 'W')],
            'lore': [(4100, 580, 'L'), (4380, 200, 'L')],
            'shortcuts': [],
        },
        {
            'id': 5, 'x_start': 5120, 'x_end': 6400, 'name': 'CHECKPOINT',
            'platforms': [
                (5360, 560, 200, 20),
                (5700, 400, 120, 20),
                (6100, 540, 80, 60),
                (6200, 300, 40, 300), (6360, 300, 40, 300),
            ],
            'hazards': [],
            'collectibles': [(5700, 370, 'E')],
            'lore': [(5600, 580, 'L'), (5900, 580, 'L')],
            'shortcuts': [],
        },
        {
            'id': 6, 'x_start': 6400, 'x_end': 7680, 'name': 'BOSS ARENA',
            'platforms': [
                (6480, 420, 40, 260), (7600, 420, 40, 260),
                (6800, 520, 100, 20), (7280, 520, 100, 20),
                (6700, 320, 80, 16), (7380, 320, 80, 16),
            ],
            'hazards': [],
            'collectibles': [(6700, 290, 'K')],
            'lore': [(6550, 580, 'L'), (7450, 580, 'L')],
            'shortcuts': [],
        },
    ]

    total_width = 7680

    # Build ASCII canvas
    canvas = [[' ' for _ in range(COLS)] for _ in range(ROWS)]

    # Draw ground (row for y=680)
    ground_row = y_to_row(GROUND_Y)
    for c in range(COLS):
        for r in range(ground_row, ROWS):
            canvas[r][c] = '='

    # Draw section boundaries
    for sec in sections:
        col = x_to_col(sec['x_start'], total_width)
        for r in range(ROWS):
            if canvas[r][col] == ' ':
                canvas[r][col] = '|'

    # Draw platforms
    for sec in sections:
        for (px, py, pw, ph) in sec['platforms']:
            c1 = x_to_col(px - pw/2, total_width)
            c2 = x_to_col(px + pw/2, total_width)
            r1 = y_to_row(py - ph/2)
            r2 = y_to_row(py + ph/2)
            for r in range(clamp(r1, 0, ROWS-1), clamp(r2+1, 0, ROWS)):
                for c in range(clamp(c1, 0, COLS-1), clamp(c2+1, 0, COLS)):
                    if r < ground_row:
                        canvas[r][c] = '#'

    # Draw hazards
    for sec in sections:
        for h in sec['hazards']:
            hx, hy, hw, hh = h[0], h[1], h[2], h[3]
            c1 = x_to_col(hx - hw/2, total_width)
            c2 = x_to_col(hx + hw/2, total_width)
            r1 = y_to_row(hy - hh/2)
            r2 = y_to_row(hy + hh/2)
            for r in range(clamp(r1, 0, ROWS-1), clamp(r2+1, 0, ROWS)):
                for c in range(clamp(c1, 0, COLS-1), clamp(c2+1, 0, COLS)):
                    canvas[r][c] = '^'  # spikes/hazard

    # Draw collectibles
    for sec in sections:
        for (cx, cy, ctype) in sec['collectibles']:
            c = x_to_col(cx, total_width)
            r = y_to_row(cy)
            if 0 <= r < ROWS and 0 <= c < COLS:
                canvas[r][c] = ctype  # H=health, E=energy, K=skill, W=weapon

    # Draw lore
    for sec in sections:
        for (lx, ly, _) in sec['lore']:
            c = x_to_col(lx, total_width)
            r = y_to_row(ly)
            if 0 <= r < ROWS and 0 <= c < COLS and canvas[r][c] in (' ', '='):
                canvas[r][c] = '?'

    # Draw shortcuts
    for sec in sections:
        for (sx, sy, _) in sec['shortcuts']:
            c = x_to_col(sx, total_width)
            r = y_to_row(sy)
            if 0 <= r < ROWS and 0 <= c < COLS:
                canvas[r][c] = 'D'

    # Print
    print("Act I Layout — MECHA: LAST PROTOCOL")
    print("Legend: # = platform, = = ground, | = section boundary,")
    print("        ^ = hazard (spike/lava/laser), H = health fragment,")
    print("        E = energy fragment, K = skill point, W = weapon part,")
    print("        ? = lore object, D = door/shortcut")
    print()
    # Section labels
    labels = "        "
    for sec in sections:
        name = f"S{sec['id']}"
        col = x_to_col(sec['x_start'] + 200, total_width)
        while len(labels) <= col:
            labels += " "
        labels += name
    print(labels)
    print("        " + "-" * COLS)
    for i, row in enumerate(canvas):
        y_val = int((i / (ROWS-1)) * HEIGHT)
        print(f"y={y_val:3d} |" + ''.join(row))
    print()

    # Analysis
    print("=== LAYOUT ANALYSIS ===")
    print()
    print("ISSUE 1: Section 1 (Awakening)")
    print("  - Platforms at y=560, 460, 540 — these are FLOATING platforms")
    print("    (no visual support). Ground is at y=680.")
    print("  - Gap between platforms: 400→700 (300px gap, jumpable)")
    print("    700→980 (280px gap, jumpable)")
    print("  - Upper ledge at y=280, y=180 — requires double jump (not unlocked yet)")
    print("  - Player STARTS in S1 — first platform at x=400, y=560")
    print("    Player spawn likely at x=200, y=680 (on ground)")
    print()
    print("ISSUE 2: Section 2 (First Combat)")
    print("  - Spike pit at x=1920, lava at x=2200 — both at y=690")
    print("  - Ground is solid elsewhere — these are GAPS in the ground? NO!")
    print("  - PROBLEM: Floor is continuous (addSolid at y=720 spans full width)")
    print("    Hazards sit ON TOP of the floor, not in gaps.")
    print("  - This means spikes/lava are just decoration on floor — player walks over them")
    print("    and takes damage but doesn't fall. This is correct for damage-on-touch.")
    print()
    print("ISSUE 3: Section 3 (Vertical Shaft)")
    print("  - Walls at x=2800 and x=3100, height 280 (y=240 to y=520)")
    print("  - Spike pit at x=2850, w=240 (covers x=2730 to x=2970)")
    print("  - PROBLEM: Spike pit is wider than the gap between walls!")
    print("    Shaft interior is x=2820 to x=3100 (280px wide)")
    print("    Spike covers x=2730 to x=2970 — overlaps left wall area")
    print("  - Main route platforms: y=580, 540 — these are ABOVE the spikes")
    print("    Player walks on platforms, not ground, in shaft area")
    print()
    print("ISSUE 4: Section 4 (Assembly Hall)")
    print("  - Laser hazard at y=340, h=4 (very thin)")
    print("  - Pillars at x=4240, 4680 (y=310 to y=570)")
    print("  - EMP secret room at x=5000 — floor at y=380, ceiling at y=140")
    print("  - PROBLEM: Secret room is very small (120 wide × 240 tall)")
    print()
    print("ISSUE 5: Collectible accessibility")
    print("  - S1 health (x=780,y=150): requires doubleJump — NOT available in S1!")
    print("    Player must backtrack AFTER unlocking doubleJump")
    print("  - S3 skill (x=2760,y=50): requires wallJump — unlocked in S4 (mini-boss)")
    print("  - S4 health (x=5060,y=350): requires emp — unlocked later")
    print("  - S4 weapon (x=4900,y=130): requires wallJump")
    print("  - S6 skill (x=6700,y=290): requires wallJump")
    print("  - Only S2 energy and S5 energy are immediately accessible")

if __name__ == '__main__':
    main()

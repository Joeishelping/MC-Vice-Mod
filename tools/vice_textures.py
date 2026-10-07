#!/usr/bin/env python3
"""Draws the Vice Pack item icons (16x16 pixel art) and the pack icons. Pure Python, no PIL needed.

Run: python3 tools/vice_textures.py   (rewrites the PNGs in "Vice Pack RP/textures/items" and both pack_icon.png)
"""
import math, os, struct, zlib

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(root, "Vice Pack RP")
BP = os.path.join(root, "Vice Pack BP")


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


CLEAR = (0, 0, 0, 0)


def write_png(path, px):
    h, w = len(px), len(px[0])
    raw = b"".join(b"\x00" + b"".join(bytes(c) for c in row) for row in px)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def from_map(rows, pal):
    assert len(rows) == 16, len(rows)
    out = []
    for r in rows:
        assert len(r) == 16, (r, len(r))
        out.append([pal.get(ch, CLEAR) if ch != "." else CLEAR for ch in r])
    return out


def outline(px, color=hexc("#1e1410"), skip=()):
    """Dark 1px outline around the opaque shape (pixels in `skip` colours, like smoke, get none)."""
    h, w = len(px), len(px[0])
    out = [row[:] for row in px]
    for y in range(h):
        for x in range(w):
            if px[y][x][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[ny][nx][3] and px[ny][nx] not in skip:
                    out[y][x] = color
                    break
    return out


def stick(a, b, width, color_at):
    """A diagonal stick from a to b; color_at(t, side) gives the colour (t 0..1 along it, side -1..1 across it)."""
    px = [[CLEAR] * 16 for _ in range(16)]
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    for y in range(16):
        for x in range(16):
            cx, cy = x + 0.5 - ax, y + 0.5 - ay
            t = (cx * dx + cy * dy) / (ln * ln)
            if t < 0 or t > 1:
                continue
            side = (cx * dy - cy * dx) / ln
            if abs(side) <= width / 2:
                px[y][x] = color_at(t, side / (width / 2))
    return px


def put(px, pts, c):
    for x, y in pts:
        px[y][x] = c


# ---------------------------------------------------------------- icons
def beer():
    rows = [
        "................",
        ".......cc.......",
        ".......CC.......",
        ".......bb.......",
        ".......Bb.......",
        "......bhBb......",
        ".....bhBBBb.....",
        ".....bhBBBb.....",
        ".....bwwwwb.....",
        ".....bwrrwb.....",
        ".....bwwwwb.....",
        ".....bhBBBb.....",
        ".....bhBBBb.....",
        ".....bhBBBb.....",
        "......bbbb......",
        "................",
    ]
    return from_map(rows, {
        "c": hexc("#f2c94c"), "C": hexc("#b8901f"), "b": hexc("#3b1f0b"), "B": hexc("#8a4b14"),
        "h": hexc("#c97f2e"), "w": hexc("#f1e3c2"), "r": hexc("#c0392b"),
    })


def liquor():
    rows = [
        "................",
        ".......kk.......",
        ".......KK.......",
        "......gLLg......",
        "......gLLg......",
        ".....gLLLLg.....",
        "....gLAAAALg....",
        "....gAhAAAAg....",
        "....gAhAAAAg....",
        "....gwwwwwwg....",
        "....gwXXXXwg....",
        "....gwwwwwwg....",
        "....gAhAAAAg....",
        "....gAAAAAAg....",
        "....gggggggg....",
        "................",
    ]
    return from_map(rows, {
        "k": hexc("#c8a26a"), "K": hexc("#8f6a3a"), "g": hexc("#40585c"), "L": hexc("#d6eef2", 200),
        "A": hexc("#b5651d"), "h": hexc("#e3a050"), "w": hexc("#202020"), "X": hexc("#e8d48a"),
    })


def cigarette():
    def col(t, s):
        if t < 0.25:                       # filter
            return hexc("#d9822b") if s < 0.2 else hexc("#a85d16")
        if t < 0.86:                       # paper
            return hexc("#f4f4f0") if s < 0.2 else hexc("#c9c9c2")
        if t < 0.94:                       # ash
            return hexc("#8a8a8a")
        return hexc("#ffb000") if s < 0 else hexc("#ff4a12")   # ember
    px = stick((2.5, 13.5), (13, 3), 2.2, col)
    smoke = [hexc("#b0b0b0", 170), hexc("#d0d0d0", 120)]
    px = outline(px)
    put(px, [(14, 1), (13, 0)], smoke[0])
    put(px, [(15, 0)], smoke[1])
    return px


def cigar():
    band_a, band_b = 0.22, 0.32
    def col(t, s):
        if t < 0.04:
            return hexc("#4a2812")
        if band_a <= t < band_b:            # paper band
            return hexc("#d4af37") if abs(s) < 0.35 else hexc("#b0262b")
        if t < 0.88:                         # wrapper leaf
            if s < -0.3:
                return hexc("#9a5c30")
            return hexc("#6b3a1e") if s < 0.45 else hexc("#4a2812")
        if t < 0.95:
            return hexc("#9a9a9a")
        return hexc("#ff6a1a")
    px = stick((2, 14), (13, 3), 3.4, col)
    px = outline(px)
    put(px, [(14, 1), (15, 0)], hexc("#b8b8b8", 150))
    return px


def cocaine():
    rows = [
        "................",
        "................",
        "....pppppppp....",
        "....prrrrrrp....",
        "....pLLLLLLp....",
        "....pLLLLLLp....",
        "....pLLLWLLp....",
        "....pLWWWWLp....",
        "....pWWWWWWp....",
        "....pWWwWWWp....",
        "....pWWWWWWp....",
        "....pWwWWWwp....",
        "....pWWWWWWp....",
        ".....pppppp.....",
        "................",
        "................",
    ]
    return from_map(rows, {
        "p": hexc("#7f8c95"), "r": hexc("#d03a3a"), "L": hexc("#e6f0f4", 140),
        "W": hexc("#ffffff"), "w": hexc("#d8dde0"),
    })


def ketamine():
    rows = [
        "................",
        "......PPPP......",
        "......PQQP......",
        "......gLLg......",
        "......gLLg......",
        ".....gLLLLg.....",
        ".....gLLLLg.....",
        ".....gwwwwg.....",
        ".....gwKKwg.....",
        ".....gwwwwg.....",
        ".....gCCCCg.....",
        ".....gChCCg.....",
        ".....gCCCCg.....",
        ".....gCCCCg.....",
        "......gggg......",
        "................",
    ]
    return from_map(rows, {
        "P": hexc("#8e4fd0"), "Q": hexc("#5c2d91"), "g": hexc("#4b5563"), "L": hexc("#e8f6fb", 150),
        "w": hexc("#f5f5f5"), "K": hexc("#7b3fb5"), "C": hexc("#cfe9ff"), "h": hexc("#ffffff"),
    })


def opium():
    rows = [
        "................",
        ".....c.c.c......",
        ".....cccccc.....",
        "....oGGGGGGo....",
        "...oGGhGGGGGo...",
        "...oGhGGGGGGo...",
        "...oGGGGGrGGo...",
        "...oGGGGGrGGo...",
        "...oGGGGGrRGo...",
        "....oGGGGRGo....",
        ".....oGGGGo.....",
        "......oddo......",
        ".......ss.......",
        ".......ss.......",
        "......ss........",
        "................",
    ]
    return from_map(rows, {
        "c": hexc("#4a5a2a"), "o": hexc("#2f3a1c"), "G": hexc("#8fa36a"), "h": hexc("#c4d39f"),
        "r": hexc("#4a2410"), "R": hexc("#2a1306"), "d": hexc("#556b2f"), "s": hexc("#5f8a3a"),
    })


def leaf_fan(px, base, size, colors, lobes=7):
    """A cannabis leaf: `lobes` leaflets fanning up from `base`."""
    bx, by = base
    dark, mid, light = colors
    spread = [0, 34, -34, 68, -68, 104, -104][:lobes]
    scale = [1.0, 0.85, 0.85, 0.62, 0.62, 0.4, 0.4][:lobes]
    for ang, sc in zip(spread, scale):
        a = math.radians(ang - 90)
        dx, dy = math.cos(a), math.sin(a)
        L, W = size * sc, max(1.3, size * sc * 0.2)
        for y in range(16):
            for x in range(16):
                rx, ry = x + 0.5 - bx, y + 0.5 - by
                along = rx * dx + ry * dy
                perp = -rx * dy + ry * dx
                if 0 < along < L and abs(perp) < W * math.sin(math.pi * min(1.0, along / L * 1.3)) / 2 + 0.15:
                    px[y][x] = light if abs(perp) < 0.5 and along < L * 0.8 else mid
    return px


GREEN = (hexc("#1f4d14"), hexc("#3f8f2a"), hexc("#7cc04a"))


def weed():
    px = [[CLEAR] * 16 for _ in range(16)]
    leaf_fan(px, (8, 12.5), 11, GREEN)
    put(px, [(8, 13), (8, 14), (7, 15)], hexc("#2f6b1f"))
    return outline(px, GREEN[0])


def joint():
    def col(t, s):
        if t < 0.14:
            return hexc("#d8c9a6")                       # crutch
        if t < 0.9:
            fleck = (int(t * 40) + int(s * 3)) % 5 == 0
            return hexc("#5f9a3a") if fleck else (hexc("#f4f1e6") if s < 0.25 else hexc("#cfc9b4"))
        return hexc("#ff4a12") if s > 0 else hexc("#ffb000")
    px = [[CLEAR] * 16 for _ in range(16)]
    ax, ay, bx, by = 2.5, 13.5, 13, 3
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    for y in range(16):
        for x in range(16):
            cx, cy = x + 0.5 - ax, y + 0.5 - ay
            t = (cx * dx + cy * dy) / (ln * ln)
            if 0 <= t <= 1:
                side = (cx * dy - cy * dx) / ln
                w = 1.5 + 1.6 * t                          # cone: thin crutch, fat end
                if abs(side) <= w / 2:
                    px[y][x] = col(t, side / (w / 2))
    px = outline(px)
    put(px, [(14, 1), (13, 0), (15, 0)], hexc("#b8c8b0", 150))
    return px


def bong():
    rows = [
        "................",
        ".....gLLLg......",
        "......gLLg......",
        "......gLhg......",
        "......gLhg......",
        "......gLLg......",
        "......gLLg..m...",
        "......gLLg.mMm..",
        ".....gLLLLgsm...",
        "....gLLLLLLsg...",
        "....gWWWWWWg....",
        "....gWhWWWWg....",
        "....gWhWWWWg....",
        "....gWWWWWWg....",
        ".....gggggg.....",
        "................",
    ]
    return from_map(rows, {
        "g": hexc("#2d6f73"), "L": hexc("#cdeff0", 150), "h": hexc("#ffffff", 200), "W": hexc("#5fb7d6", 210),
        "m": hexc("#6e6e6e"), "M": hexc("#3a5a22"), "s": hexc("#8a8a8a"),
    })


def shrooms():
    rows = [
        "................",
        "................",
        "....oo..........",
        "...oCCo.........",
        "..oCCcCo........",
        "..oCCCCo....oo..",
        "..oddddo...oCCo.",
        "....ss....oCcCCo",
        "....ss....oddddo",
        "....ss......ss..",
        "...sss......ss..",
        "...ss.......ss..",
        "...ss......sss..",
        "..sss......ss...",
        "..sss.....sss...",
        "................",
    ]
    return from_map(rows, {
        "o": hexc("#5a3a1a"), "C": hexc("#c08a4a"), "c": hexc("#e6c38a"), "d": hexc("#7a5a3a"),
        "s": hexc("#efe6d2"),
    })


def weed_plant(stage):
    """Growth stages 0..3 for the placed plant (drawn on the full 16x16 cross)."""
    px = [[CLEAR] * 16 for _ in range(16)]
    top = [12, 9, 5, 2][stage]
    for y in range(top + 2, 16):
        px[y][8] = hexc("#2f6b1f")
    nodes = {0: [], 1: [13], 2: [12, 9], 3: [13, 10, 7]}[stage]
    for ny in nodes:                                   # side leaves along the stem
        leaf_fan(px, (8.5, ny + 0.5), 5 + (16 - ny) * 0.15, GREEN, lobes=5)
    leaf_fan(px, (8.5, top + 4.5), [4, 6, 8, 9][stage], GREEN, lobes=[3, 5, 7, 7][stage])
    px = outline(px, GREEN[0])
    if stage == 3:                                      # buds
        for x, y in ((8, 2), (7, 3), (9, 3), (8, 4), (5, 7), (11, 7), (8, 6)):
            px[y][x] = hexc("#b9d77a")
        for x, y in ((7, 2), (9, 4), (6, 7), (10, 6)):
            px[y][x] = hexc("#e08a3c")
    return px


def lines(n, color, shade):
    """1..3 powder lines on a block top, plus a card lying next to them."""
    px = [[CLEAR] * 16 for _ in range(16)]
    for i in range(n):
        y = 4 + i * 3
        for x in range(3, 12):
            px[y][x] = color if (x + i) % 4 else shade
            if x in (5, 6, 9) and i != 1:
                px[y + 1][x] = shade
    for y in range(11, 15):                             # the card
        for x in range(9, 15):
            px[y][x] = hexc("#2c5aa0") if y != 12 else hexc("#d4af37")
    return px


def narcaine():
    rows = [
        "................",
        ".......nn.......",
        ".......nn.......",
        "......nNNn......",
        ".....oOOOOo.....",
        ".....oOOOOo.....",
        "....wWWWWWWw....",
        "....wWhWWWWw....",
        "....wWrrrrWw....",
        "....wWrWWrWw....",
        "....wWrrrrWw....",
        "....wWhWWWWw....",
        "....wWhWWWWw....",
        "....wWWWWWWw....",
        ".....wwwwww.....",
        "................",
    ]
    return from_map(rows, {
        "n": hexc("#e8e8e8"), "N": hexc("#b8b8b8"), "o": hexc("#a8501a"), "O": hexc("#f07a2a"),
        "w": hexc("#7c8a96"), "W": hexc("#f6f8fa"), "h": hexc("#ffffff"), "r": hexc("#d0342c"),
    })


# ---------------------------------------------------------------- v1.3: zynn, coffee, tea, wine, pipe, morphine, crops
import random


def rng(seed):
    return random.Random(seed)


def zynn():
    px = [[CLEAR] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - 8, (y + 0.5 - 8.5) * 1.15)
            if d <= 6.6:
                px[y][x] = hexc("#1d4f91") if d > 5.4 else (hexc("#2f6fc2") if d > 4.6 else hexc("#f2f5f8"))
    for x in range(5, 11):                                # the name across the lid
        px[8][x] = hexc("#1d4f91") if x % 2 else hexc("#2f6fc2")
    put(px, [(6, 6), (7, 6)], hexc("#ffffff"))
    return outline(px)


def mug(liquid, light):
    rows = [
        "......s..s......",
        ".......s..s.....",
        "......s..s......",
        "................",
        "...wwwwwwwww....",
        "...wLLLLLLLw....",
        "...wllllllww....",
        "...wWWWWWWWwwww.",
        "...wWhWWWWWw..w.",
        "...wWhWWWWWw..w.",
        "...wWWWWWWWw..w.",
        "...wWWWWWWWwww..",
        "...wWWWWWWWw....",
        "....wwwwwww.....",
        "................",
        "................",
    ]
    return from_map(rows, {
        "s": hexc("#e8e8e8", 140), "w": hexc("#6b6b6b"), "W": hexc("#f2f0ea"), "h": hexc("#ffffff"),
        "L": hexc(liquid), "l": hexc(light),
    })


def wine():
    rows = [
        "................",
        ".......kk.......",
        ".......kk.......",
        ".......gg.......",
        ".......gg.......",
        "......gGGg......",
        ".....gGhGGg.....",
        ".....gGhGGg.....",
        ".....gwwwwg.....",
        ".....gwRRwg.....",
        ".....gwwwwg.....",
        ".....gGhGGg.....",
        ".....gGGGGg.....",
        ".....gGGGGg.....",
        "......gggg......",
        "................",
    ]
    return from_map(rows, {
        "k": hexc("#7a1030"), "g": hexc("#1a2a1a"), "G": hexc("#3d1424"), "h": hexc("#7a3050"),
        "w": hexc("#efe6d0"), "R": hexc("#9c1c4a"),
    })


def pipe():
    rows = [
        "................",
        "................",
        "................",
        "...........oo...",
        "..........oEEo..",
        "..........obbo..",
        "..........oBBo..",
        "..........oBBo..",
        "..........oBBo..",
        ".........oBBBo..",
        ".......ooBBBo...",
        ".....ooBBBoo....",
        "...ooBBBoo......",
        ".oodBBoo........",
        ".odoo...........",
        "................",
    ]
    return from_map(rows, {
        "o": hexc("#2a160a"), "B": hexc("#7a4520"), "b": hexc("#a8682e"), "E": hexc("#ff6a1a"), "d": hexc("#1a1a1a"),
    })


def morphine():
    def col(t, s):
        if t < 0.12:
            return hexc("#d8d8d8")                    # plunger
        if t < 0.2:
            return hexc("#9a9a9a")
        if t < 0.7:                                    # barrel with amber dose
            return hexc("#e9b44c") if s < 0.3 else hexc("#f6e2b0")
        if t < 0.76:
            return hexc("#c43b3b")                     # red cap ring
        return hexc("#c8d0d6")                         # needle
    px = stick((2.5, 13.5), (13.5, 2.5), 2.6, col)
    for y in range(16):                                # thin needle: trim the far end to one pixel
        for x in range(16):
            if x + (15 - y) > 24 and px[y][x][3] and x - (15 - y) != 0:
                px[y][x] = CLEAR
    return outline(px)


def tobacco_leaf():
    def col(t, s):
        if abs(s) < 0.18:
            return hexc("#c9b26a")                     # midrib
        if (int(t * 10) % 3 == 0) and abs(s) < 0.8:
            return hexc("#5f7a2c")
        return hexc("#7d9a3a") if s < 0 else hexc("#6a8530")
    px = [[CLEAR] * 16 for _ in range(16)]
    ax, ay, bx, by = 3, 13, 13, 3
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    for y in range(16):
        for x in range(16):
            cx, cy = x + 0.5 - ax, y + 0.5 - ay
            t = (cx * dx + cy * dy) / (ln * ln)
            if 0 <= t <= 1:
                side = (cx * dy - cy * dx) / ln
                w = 0.6 + 6.2 * math.sin(math.pi * t ** 0.8)
                if abs(side) <= w / 2:
                    px[y][x] = col(t, side / (w / 2))
    put(px, [(2, 14), (1, 15)], hexc("#8a7a3a"))
    return outline(px, hexc("#2c3a12"))


def pile(seed, colors, n=26, dot=1):
    r = rng(seed)
    px = [[CLEAR] * 16 for _ in range(16)]
    for _ in range(n):
        x = int(8 + r.gauss(0, 2.6)); y = int(11 - abs(r.gauss(0, 2.2)))
        for ddx in range(dot):
            for ddy in range(dot):
                if 1 <= x + ddx < 15 and 1 <= y + ddy < 15:
                    px[y + ddy][x + ddx] = r.choice(colors)
    return outline(px, hexc("#20140a"))


def coffee_beans():
    px = [[CLEAR] * 16 for _ in range(16)]
    for bx, by in ((5, 6), (10, 5), (7, 10), (11, 11), (3, 11)):
        for y in range(16):
            for x in range(16):
                if ((x + 0.5 - bx) / 2.3) ** 2 + ((y + 0.5 - by) / 1.7) ** 2 <= 1:
                    px[y][x] = hexc("#2a1408") if x == bx and y != by - 2 else hexc("#6b3a1a") if y < by else hexc("#4e2a12")
    return outline(px, hexc("#1a0c04"))


def tea_leaves():
    px = [[CLEAR] * 16 for _ in range(16)]
    for (ax, ay, bx, by) in ((3, 12, 9, 4), (7, 13, 14, 8), (4, 9, 8, 14)):
        dx, dy = bx - ax, by - ay
        ln = math.hypot(dx, dy)
        for y in range(16):
            for x in range(16):
                cx, cy = x + 0.5 - ax, y + 0.5 - ay
                t = (cx * dx + cy * dy) / (ln * ln)
                if 0 <= t <= 1:
                    side = (cx * dy - cy * dx) / ln
                    if abs(side) <= 0.4 + 2.2 * math.sin(math.pi * t):
                        px[y][x] = hexc("#b9e08a") if abs(side) < 0.4 else hexc("#4f9a3a") if side < 0 else hexc("#3f8030")
    return outline(px, hexc("#1f3d14"))


def blob(px, cx, cy, rx, ry, colors, seed, density=1.0):
    r = rng(seed)
    for y in range(16):
        for x in range(16):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and r.random() < density:
                px[y][x] = r.choice(colors)


def stem(px, x, y0, y1, c=hexc("#3f6b22")):
    for y in range(y1, y0 + 1):
        px[y][x] = c


def tobacco_plant(stage):
    px = [[CLEAR] * 16 for _ in range(16)]
    top = [12, 8, 4, 2][stage]
    stem(px, 8, 15, top)
    L = [(hexc("#6f9a34"), hexc("#86b244"), hexc("#5a7f2a"))]
    for i, y in enumerate(range(14, top, -3)):        # broad leaves, alternating sides, smaller up top
        size = max(2.0, 4.5 - i * 0.6) * (0.6 + 0.4 * stage / 3)
        side = -1 if i % 2 else 1
        blob(px, 8 + side * (size * 0.9), y - 0.5, size, size * 0.5, list(L[0]), seed=stage * 10 + i)
    if stage == 3:
        for x, y in ((7, 1), (8, 0), (9, 1), (8, 2), (6, 2), (10, 2)):
            px[y][x] = hexc("#f2a0c4") if (x + y) % 2 else hexc("#ffd6e8")
    return outline(px, hexc("#22380e"))


def poppy_plant(stage):
    px = [[CLEAR] * 16 for _ in range(16)]
    heads = [[], [(8, 9)], [(5, 6), (8, 4), (11, 7)], [(5, 5), (8, 3), (11, 6)]][stage]
    for hx, hy in heads or [(8, 12)]:
        stem(px, hx, 15, hy + 1, hexc("#6f8f5a"))
    blob(px, 8, 14, 4 + stage, 1.6, [hexc("#7fa06a"), hexc("#94b47e")], seed=40 + stage)
    for hx, hy in heads:
        if stage == 2:                                  # red flowers
            for x, y in ((hx - 1, hy), (hx + 1, hy), (hx, hy - 1), (hx, hy), (hx - 1, hy - 1), (hx + 1, hy - 1)):
                px[y][x] = hexc("#d6241e") if (x + y) % 2 else hexc("#a8140f")
            px[hy][hx] = hexc("#1a1a1a")
        elif stage == 3:                                # seed pods with crowns
            for x, y in ((hx - 1, hy), (hx, hy), (hx + 1, hy), (hx - 1, hy + 1), (hx, hy + 1), (hx + 1, hy + 1)):
                px[y][x] = hexc("#9db38a") if x != hx + 1 else hexc("#7f9670")
            for x in (hx - 1, hx + 1):
                px[hy - 1][x] = hexc("#4a5a2a")
        else:
            px[hy][hx] = hexc("#7fa06a")
    return outline(px, hexc("#2a3a1a"))


def coffee_plant(stage):
    px = [[CLEAR] * 16 for _ in range(16)]
    stem(px, 8, 15, [13, 10, 6, 4][stage], hexc("#5a3a1e"))
    ry = [2, 3.5, 5, 6][stage]
    blob(px, 8, 15 - ry - 1, [2.5, 4, 5.5, 6.5][stage], ry, [hexc("#1f5a24"), hexc("#2a7030"), hexc("#3a8a3c")], seed=60 + stage, density=0.85)
    if stage == 3:
        r = rng(7)
        for _ in range(9):
            x, y = r.randint(3, 12), r.randint(5, 12)
            if px[y][x][3]:
                px[y][x] = hexc("#c4161c") if r.random() < 0.7 else hexc("#ff5a3a")
    return outline(px, hexc("#0f2a12"))


def tea_plant(stage):
    px = [[CLEAR] * 16 for _ in range(16)]
    ry = [1.8, 2.8, 3.8, 4.4][stage]
    blob(px, 8, 15 - ry, [3, 5, 6.5, 7.2][stage], ry, [hexc("#5aa84a"), hexc("#74c25c"), hexc("#489a3c")], seed=80 + stage, density=0.9)
    if stage == 3:
        r = rng(9)
        for _ in range(7):
            x, y = r.randint(2, 13), r.randint(8, 13)
            if px[y][x][3]:
                px[y][x] = hexc("#fffbe8")
    return outline(px, hexc("#1f3d14"))


ICONS = {
    "vice_beer": beer, "vice_liquor": liquor, "vice_cigarette": cigarette, "vice_cigar": cigar,
    "vice_cocaine": cocaine, "vice_ketamine": ketamine, "vice_opium": opium,
    "vice_weed": weed, "vice_joint": joint, "vice_bong": bong, "vice_shrooms": shrooms,
    "vice_narcaine": narcaine,
    "vice_zynn": zynn, "vice_coffee": lambda: mug("#5a3218", "#7a4a26"), "vice_tea": lambda: mug("#9a7a2a", "#c2a04a"),
    "vice_wine": wine, "vice_pipe": pipe, "vice_morphine": morphine, "vice_tobacco_leaf": tobacco_leaf,
    "vice_tobacco_seeds": lambda: pile(1, [hexc("#5a3a1a"), hexc("#7a5228"), hexc("#3e2810")]),
    "vice_poppy_seeds": lambda: pile(2, [hexc("#3a3e4a"), hexc("#5a5e6a"), hexc("#26282e")]),
    "vice_coffee_beans": coffee_beans, "vice_tea_leaves": tea_leaves,
}
BLOCK_TEX = {
    **{f"vice_weed_plant_{i}": (lambda i=i: weed_plant(i)) for i in range(4)},
    **{f"vice_tobacco_plant_{i}": (lambda i=i: tobacco_plant(i)) for i in range(4)},
    **{f"vice_poppy_plant_{i}": (lambda i=i: poppy_plant(i)) for i in range(4)},
    **{f"vice_coffee_plant_{i}": (lambda i=i: coffee_plant(i)) for i in range(4)},
    **{f"vice_tea_plant_{i}": (lambda i=i: tea_plant(i)) for i in range(4)},
    **{f"vice_cocaine_lines_{n}": (lambda n=n: lines(n, hexc("#ffffff"), hexc("#dde3e6"))) for n in (1, 2, 3)},
    **{f"vice_ketamine_lines_{n}": (lambda n=n: lines(n, hexc("#efe6ff"), hexc("#c9b6ea"))) for n in (1, 2, 3)},
}


def pack_icon(icons):
    """64x64: dark tile with four of the icons, each drawn 2x."""
    px = [[hexc("#241a2e")] * 64 for _ in range(64)]
    for y in range(64):
        for x in range(64):
            if x in (0, 63) or y in (0, 63):
                px[y][x] = hexc("#c9a227")
    for (ox, oy), icon in zip(((0, 0), (32, 0), (0, 32), (32, 32)), icons):
        for y in range(16):
            for x in range(16):
                c = icon[y][x]
                if c[3] < 100:
                    continue
                for sy in range(2):
                    for sx in range(2):
                        px[oy + y * 2 + sy][ox + x * 2 + sx] = c[:3] + (255,)
    return px


if __name__ == "__main__":
    drawn = {}
    for name, fn in ICONS.items():
        drawn[name] = fn()
        write_png(os.path.join(RP, "textures", "items", name + ".png"), drawn[name])
    for name, fn in BLOCK_TEX.items():
        write_png(os.path.join(RP, "textures", "blocks", name + ".png"), fn())
    icon = pack_icon([drawn["vice_beer"], drawn["vice_weed"], drawn["vice_cocaine"], drawn["vice_shrooms"]])
    write_png(os.path.join(RP, "pack_icon.png"), icon)
    write_png(os.path.join(BP, "pack_icon.png"), icon)
    print("wrote", len(drawn), "icons,", len(BLOCK_TEX), "block textures + pack icons")

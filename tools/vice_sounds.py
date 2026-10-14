#!/usr/bin/env python3
"""Synthesises Vice Pack's own sound effects (lighter flick, can crack, pour, cough, sniff, bong bubbles, exhale,
pill rattle, kettle whistle, grinder) into Vice Pack RP/sounds/vice/*.ogg, and writes
sound_definitions.json. Needs numpy + soundfile (pip install numpy soundfile).

Run: python3 tools/vice_sounds.py
"""
import json, os
import numpy as np
import soundfile as sf

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(root, "Vice Pack RP")
OUT = os.path.join(RP, "sounds", "vice")
SR = 44100
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.uniform(-1, 1, int(SR * sec))


def band(x, lo=0, hi=SR / 2):
    """brick-wall band-pass in the frequency domain"""
    f = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(f, len(x))


def env(n, attack, decay, sustain=0.0):
    a = int(SR * attack)
    e = np.ones(n) * sustain
    e[:a] = np.linspace(0, 1, max(a, 1))[:min(a, n)]
    d = np.arange(n - a) / SR
    e[a:] = sustain + (1 - sustain) * np.exp(-d / max(decay, 1e-4))
    return e


def place(out, x, at):
    i = int(at * SR)
    out[i:i + len(x)] += x[:max(0, len(out) - i)]
    return out


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def lighter():
    out = np.zeros(int(SR * 0.9))
    click = band(noise(0.012), 2000, 9000) * env(int(SR * 0.012), 0.0005, 0.003)
    scratch = band(noise(0.06), 3000, 12000) * env(int(SR * 0.06), 0.002, 0.02)
    whoosh = band(noise(0.6), 80, 900) * env(int(SR * 0.6), 0.08, 0.25)
    place(out, click * 1.0, 0.0)
    place(out, scratch * 0.7, 0.03)
    place(out, whoosh * 0.6, 0.08)
    return norm(out)


def can_open():
    out = np.zeros(int(SR * 1.1))
    crack = band(noise(0.015), 1500, 14000) * env(int(SR * 0.015), 0.0003, 0.004)
    hiss = band(noise(1.0), 3000, 16000) * env(int(SR * 1.0), 0.005, 0.25)
    place(out, crack, 0.0)
    place(out, hiss * 0.5, 0.01)
    for _ in range(40):                                    # fizz crackle
        c = band(noise(0.003), 4000, 15000) * env(int(SR * 0.003), 0.0002, 0.001)
        place(out, c * rng.uniform(0.1, 0.35), rng.uniform(0.05, 0.9))
    return norm(out)


def pour():
    out = np.zeros(int(SR * 1.3))
    place(out, band(noise(1.25), 200, 2500) * 0.25 * env(int(SR * 1.25), 0.05, 0.9, 0.6), 0)
    for _ in range(18):                                    # glugs
        d = rng.uniform(0.05, 0.1)
        tt = t(d)
        f0 = rng.uniform(180, 380)
        g = np.sin(2 * np.pi * (f0 + 900 * tt) * tt) * env(len(tt), 0.005, d / 3)
        place(out, g * rng.uniform(0.3, 0.7), rng.uniform(0.0, 1.15))
    return norm(out)


def cough():
    out = np.zeros(int(SR * 1.1))
    for i, at in enumerate((0.0, 0.32, 0.62)):
        d = 0.22 - i * 0.03
        tt = t(d)
        voiced = np.sin(2 * np.pi * rng.uniform(130, 170) * tt) * 0.4
        burst = band(noise(d), 250, 2200) + voiced
        place(out, burst * env(len(tt), 0.004, d / 3.5), at)
    return norm(out)


def sniff():
    d = 0.55
    n = band(noise(d), 1500, 9000)
    e = np.linspace(0.1, 1, len(n)) ** 2 * env(len(n), 0.0, 1.0, 1.0)
    e[-int(SR * 0.04):] *= np.linspace(1, 0, int(SR * 0.04))
    return norm(n * e)


def bubble():
    out = np.zeros(int(SR * 1.6))
    at = 0.0
    while at < 1.45:
        d = rng.uniform(0.04, 0.09)
        tt = t(d)
        f0 = rng.uniform(220, 420)
        b = np.sin(2 * np.pi * (f0 + rng.uniform(500, 1400) * tt) * tt) * env(len(tt), 0.003, d / 2.5)
        place(out, b * rng.uniform(0.4, 1.0), at)
        at += rng.uniform(0.03, 0.08)
    return norm(out)


def exhale():
    d = 1.3
    n = band(noise(d), 150, 2500)
    return norm(n * env(len(n), 0.12, 0.5)) * 0.7


def pill():
    out = np.zeros(int(SR * 0.7))
    for _ in range(30):
        c = band(noise(0.006), 2500, 9000) * env(int(SR * 0.006), 0.0003, 0.0015)
        at = rng.uniform(0, 0.25) + (0.3 if rng.random() < 0.5 else 0)
        place(out, c * rng.uniform(0.3, 1), at)
    return norm(out)


def whistle():
    d = 1.6
    tt = t(d)
    f = 1500 + 400 * np.minimum(1, tt / 0.6) + 25 * np.sin(2 * np.pi * 6 * tt)
    ph = 2 * np.cumsum(np.pi * f / SR)
    w = np.sin(ph) * 0.6 + band(noise(d), 1200, 3000) * 0.15
    return norm(w * env(len(tt), 0.3, 1.0, 1.0) * np.minimum(1, (d - tt) / 0.2))


def grind():
    d = 1.3
    tt = t(d)
    n = band(noise(d), 400, 6000)
    crank = 0.55 + 0.45 * np.sin(2 * np.pi * 3.2 * tt) ** 2
    crunch = (rng.random(len(tt)) < 0.004).astype(float)
    crunch = np.convolve(crunch, np.exp(-np.arange(200) / 30), "same")
    return norm((n * crank * 0.5 + band(crunch, 800, 8000) * 0.8) * env(len(tt), 0.05, 1.0, 1.0))


SOUNDS = {
    "lighter": (lighter, 0.8), "can_open": (can_open, 0.9), "pour": (pour, 0.8), "cough": (cough, 0.9),
    "sniff": (sniff, 0.9), "bubble": (bubble, 0.8), "exhale": (exhale, 0.6), "pill": (pill, 0.8),
    "whistle": (whistle, 0.7), "grind": (grind, 0.8),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    defs = {}
    for name, (fn, vol) in SOUNDS.items():
        x = fn().astype(np.float32)
        sf.write(os.path.join(OUT, f"{name}.ogg"), x, SR, format="OGG", subtype="VORBIS")
        defs[f"vice.{name}"] = {"category": "player", "sounds": [{"name": f"sounds/vice/{name}", "volume": vol}]}
    with open(os.path.join(RP, "sounds", "sound_definitions.json"), "w") as f:
        json.dump({"format_version": "1.14.0", "sound_definitions": defs}, f, indent=2)
        f.write("\n")
    print("wrote", len(SOUNDS), "sounds")

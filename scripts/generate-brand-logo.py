# Generate square PNG brand marks for Google Cloud OAuth branding.
# Pure stdlib — no extra deps.

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    # Rounded-rect mask
    r = int(size * 0.19)
    ix, iy = x + 0.5, y + 0.5
    # distance to rounded rect interior
    cx = min(max(ix, r), size - r)
    cy = min(max(iy, r), size - r)
    dx, dy = ix - cx, iy - cy
    dist = math.hypot(dx, dy)
    if dist > r + 0.5:
        return (0, 0, 0, 0)
    # anti-alias edge
    alpha = 255
    if dist > r - 1:
        alpha = int(max(0, min(255, (r + 0.5 - dist) * 255)))

    t = (x + y) / (2 * (size - 1))
    # #4F8EF7 → #9B6DFF
    cr = int(lerp(0x4F, 0x9B, t))
    cg = int(lerp(0x8E, 0x6D, t))
    cb = int(lerp(0xF7, 0xFF, t))
    return (cr, cg, cb, alpha)


def write_png(path: Path, size: int, pixels: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b""
    stride = size * 4
    for y in range(size):
        raw += b"\x00" + pixels[y * stride : (y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def draw_g(size: int) -> bytes:
    # Rasterize a bold geometric G (arc + serif bar) in white.
    buf = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            r, g, b, a = pixel(x, y, size)
            i = (y * size + x) * 4
            buf[i : i + 4] = bytes((r, g, b, a))

    cx = cy = size / 2
    outer = size * 0.30
    inner = size * 0.18
    # G opening on the right; bar from center to the opening
    for y in range(size):
        for x in range(size):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            dist = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)  # -pi..pi, 0 = east
            on_ring = inner <= dist <= outer
            # cut a gap roughly 50° around 3 o'clock, but keep a horizontal bar
            gap = -0.55 < ang < 0.55 and dist > inner * 0.2
            bar = abs(dy) < size * 0.055 and 0 < dx < outer and dist < outer + 2
            stem = abs(dx - outer + size * 0.02) < size * 0.055 and 0 < dy < inner * 0.55
            if (on_ring and not gap) or bar or stem:
                i = (y * size + x) * 4
                # AA by distance to stroke
                buf[i : i + 3] = b"\xff\xff\xff"
                buf[i + 3] = max(buf[i + 3], 255)
    return bytes(buf)


def main() -> None:
    for size, name in ((120, "getfreequote-logo-120.png"), (512, "getfreequote-logo-512.png")):
        pixels = draw_g(size)
        write_png(OUT / name, size, pixels)
        print(f"wrote {OUT / name} ({(OUT / name).stat().st_size} bytes)")


if __name__ == "__main__":
    main()

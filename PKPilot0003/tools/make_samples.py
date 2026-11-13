#!/usr/bin/env python3
"""
PKPilot0003 · Shutterplate — sample photo builder
=================================================
Takes the three generated sample frames, bakes a realistic EXIF block into each
JPEG (so the demo exercises the real parser, not a mock), and writes them to
assets/samples/.

    python3 tools/make_samples.py --src-dir ../../tmp/pkp3
"""
from __future__ import annotations

import argparse
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "samples")

# (source png, output jpg, exif dict)
SAMPLES = [
    (
        "sample-a.png",
        "sample-01.jpg",
        {
            "Make": "SONY",
            "Model": "ILCE-7M4",
            "Lens": "FE 35mm F1.4 GM",
            "DateTimeOriginal": "2026:10:24 17:32:11",
            "ExposureTime": (1, 250),
            "FNumber": (18, 10),
            "ISO": 100,
            "FocalLength": (35, 1),
            "Focal35": 35,
            "Artist": "HD2Lab",
        },
    ),
    (
        "sample-b.png",
        "sample-02.jpg",
        {
            "Make": "FUJIFILM",
            "Model": "X-T5",
            "Lens": "XF56mmF1.2 R",
            "DateTimeOriginal": "2026:11:02 10:14:38",
            "ExposureTime": (1, 125),
            "FNumber": (12, 10),
            "ISO": 400,
            "FocalLength": (56, 1),
            "Focal35": 84,
            "Artist": "HD2Lab",
        },
    ),
    (
        "sample-c.png",
        "sample-03.jpg",
        {
            "Make": "Canon",
            "Model": "Canon EOS R5",
            "Lens": "RF35mm F1.8 MACRO IS STM",
            "DateTimeOriginal": "2026:11:07 21:48:05",
            "ExposureTime": (1, 60),
            "FNumber": (20, 10),
            "ISO": 1600,
            "FocalLength": (35, 1),
            "Focal35": 35,
            "Artist": "HD2Lab",
        },
    ),
]


def build_exif(spec: dict) -> Image.Exif:
    exif = Image.Exif()
    exif[0x010F] = spec["Make"]                 # Make
    exif[0x0110] = spec["Model"]                # Model
    exif[0x0131] = "Shutterplate 03"            # Software
    exif[0x013B] = spec.get("Artist", "HD2Lab") # Artist
    exif[0x011A] = (72, 1)                      # XResolution
    exif[0x011B] = (72, 1)                      # YResolution
    exif[0x0128] = 2                            # ResolutionUnit = inch
    exif[0x0112] = 1                            # Orientation = normal

    ifd = exif.get_ifd(0x8769)                  # Exif sub-IFD
    ifd[0x9003] = spec["DateTimeOriginal"]      # DateTimeOriginal
    ifd[0x9004] = spec["DateTimeOriginal"]      # DateTimeDigitized
    ifd[0x829A] = spec["ExposureTime"]          # ExposureTime
    ifd[0x829D] = spec["FNumber"]               # FNumber
    ifd[0x8827] = spec["ISO"]                   # ISOSpeedRatings
    ifd[0x920A] = spec["FocalLength"]           # FocalLength
    ifd[0xA434] = spec["Lens"]                  # LensModel
    ifd[0xA405] = spec["Focal35"]               # FocalLengthIn35mmFilm
    ifd[0x9209] = 0                             # Flash = no flash
    ifd[0xA002] = 0                             # PixelXDimension (filled below)
    ifd[0xA003] = 0                             # PixelYDimension
    return exif


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src-dir", default=os.path.join(ROOT, "..", "..", "tmp", "pkp3"))
    ap.add_argument("--quality", type=int, default=88)
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    made = 0
    for src_name, out_name, spec in SAMPLES:
        src = os.path.join(args.src_dir, src_name)
        if not os.path.exists(src):
            print(f"! missing source: {src}", file=sys.stderr)
            continue
        im = Image.open(src).convert("RGB")
        exif = build_exif(spec)
        ifd = exif.get_ifd(0x8769)
        ifd[0xA002] = im.width
        ifd[0xA003] = im.height
        dst = os.path.join(OUT, out_name)
        im.save(dst, "JPEG", quality=args.quality, optimize=True, progressive=True, exif=exif)
        print(f"✓ {out_name}  {im.width}×{im.height}  {os.path.getsize(dst) / 1024:.0f} KB")
        made += 1
    print(f"{made} sample(s) written to {OUT}")
    return 0 if made else 1


if __name__ == "__main__":
    raise SystemExit(main())

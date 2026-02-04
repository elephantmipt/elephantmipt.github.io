#!/usr/bin/env python3
"""Crop and resize a portrait image with configurable offsets.

Example:
  python3 scripts/crop-portrait.py \
    --input public/assets/img/portrait.jpg \
    --output public/assets/img/portrait-cropped.jpg \
    --size 250 --x 0 --y 100
"""

import argparse
from pathlib import Path
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crop and resize a portrait image.")
    parser.add_argument("--input", required=True, help="Path to input image")
    parser.add_argument("--output", required=True, help="Path to output image")
    parser.add_argument("--size", type=int, default=250, help="Square output size in pixels")
    parser.add_argument("--x", type=int, default=0, help="Left offset for crop")
    parser.add_argument("--y", type=int, default=0, help="Top offset for crop")
    parser.add_argument(
        "--crop-size",
        type=int,
        default=None,
        help="Square crop size in pixels (defaults to min(width, height))",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")

    img = Image.open(input_path).convert("RGB")
    width, height = img.size
    print(img.size)
    crop_size = args.crop_size or min(width, height)

    left = max(0, args.x)
    top = max(0, args.y)
    right = min(width, left + crop_size)
    bottom = min(height, top + crop_size)
    print(left, top, right, bottom)
    print(right - left < crop_size)
    print(bottom - top < crop_size)
    if right - left < crop_size or bottom - top < crop_size:
        raise SystemExit(
            "Crop window exceeds image bounds. Reduce --x/--y or --crop-size."
        )

    cropped = img.crop((left, top, right, bottom))
    resized = cropped.resize((args.size, args.size), Image.LANCZOS)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(output_path, quality=95)

    print(
        f"Saved {output_path} ({args.size}x{args.size}), crop=({left},{top},{right},{bottom})"
    )


if __name__ == "__main__":
    main()

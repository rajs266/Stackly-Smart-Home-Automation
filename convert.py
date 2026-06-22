"""
Batch-convert Section 1 & Section 2 frames to WebP at 90-100 KB.
- Existing WebP files already in 90-100 KB range  -> skipped
- Existing WebP files outside that range           -> re-encoded in-place
- PNG / JPG files                                  -> converted to .webp, source deleted
"""

import os
import io
import glob
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

TARGET_MIN = 90 * 1024    # 92,160 bytes
TARGET_MAX = 100 * 1024   # 102,400 bytes
WEBP_METHOD = 2           # balance between speed and compression


def _encode(img, quality):
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=WEBP_METHOD)
    return buf.getvalue()


def _find_quality(img):
    """Binary-search quality to land file size in [TARGET_MIN, TARGET_MAX].
    Returns bytes, or None if even quality=1 is too large (caller should resize)."""
    data_max = _encode(img, 100)
    if len(data_max) <= TARGET_MIN:
        return data_max   # image too simple to reach 90 KB; keep max quality

    data_min = _encode(img, 1)
    if len(data_min) > TARGET_MAX:
        return None       # needs resizing

    lo, hi, best = 1, 100, data_min
    while lo <= hi:
        mid = (lo + hi) // 2
        data = _encode(img, mid)
        size = len(data)
        if TARGET_MIN <= size <= TARGET_MAX:
            return data
        elif size < TARGET_MIN:
            best = data
            lo = mid + 1
        else:
            hi = mid - 1

    for q in (lo - 1, lo):
        if 1 <= q <= 100:
            d = _encode(img, q)
            if len(d) <= TARGET_MAX:
                return d
    return best


def _resize_until_fits(img):
    for pct in range(90, 5, -5):
        w = max(1, img.width * pct // 100)
        h = max(1, img.height * pct // 100)
        r = img.resize((w, h), Image.Resampling.LANCZOS)
        result = _find_quality(r)
        if result is not None:
            return result
        d = _encode(r, 1)
        if len(d) <= TARGET_MAX:
            return d
    return _encode(img.resize((img.width // 4, img.height // 4),
                               Image.Resampling.LANCZOS), 1)


def process_file(img_path):
    """Returns (img_path, tag, final_kb) where tag is 'skip'|'ok'|'warn'|'error'."""
    is_webp = img_path.lower().endswith(".webp")
    out_path = os.path.splitext(img_path)[0] + ".webp"

    if is_webp and TARGET_MIN <= os.path.getsize(img_path) <= TARGET_MAX:
        return img_path, "skip", os.path.getsize(img_path) / 1024

    try:
        img = Image.open(img_path)
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        data = _find_quality(img)
        if data is None:
            data = _resize_until_fits(img)
        img.close()

        with open(out_path, "wb") as f:
            f.write(data)

        if os.path.abspath(img_path) != os.path.abspath(out_path):
            os.remove(img_path)

        kb = len(data) / 1024
        tag = "ok" if TARGET_MIN <= len(data) <= TARGET_MAX else "warn"
        return img_path, tag, kb

    except Exception as exc:
        return img_path, "error", str(exc)


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    folders = [
        os.path.join(base, "assets", "section 1"),
        os.path.join(base, "assets", "section 2"),
    ]

    all_files = []
    for folder in folders:
        for pat in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
            all_files += glob.glob(os.path.join(folder, pat))
    all_files.sort()

    total = len(all_files)
    workers = min(os.cpu_count() or 4, 8)
    print(f"Files to process : {total}")
    print(f"Threads          : {workers}")
    sys.stdout.flush()

    t0 = time.time()
    converted = skipped = warnings = errors = 0

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(process_file, f): f for f in all_files}
        done_count = 0
        for fut in as_completed(futures):
            path, tag, val = fut.result()
            done_count += 1

            if tag == "skip":
                skipped += 1
            elif tag == "ok":
                converted += 1
            elif tag == "warn":
                warnings += 1
                rel = os.path.relpath(path, base)
                print(f"  [WARN] {rel} = {val:.1f} KB")
                sys.stdout.flush()
            else:
                errors += 1
                rel = os.path.relpath(path, base)
                print(f"  [ERR ] {rel} = {val}")
                sys.stdout.flush()

            if done_count % 50 == 0 or done_count == total:
                elapsed = time.time() - t0
                rate = done_count / elapsed if elapsed else 1
                eta = (total - done_count) / rate
                print(f"  [{done_count}/{total}] {elapsed:.0f}s elapsed, ~{eta:.0f}s left | "
                      f"ok={converted} skip={skipped} warn={warnings} err={errors}")
                sys.stdout.flush()

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Converted : {converted}")
    print(f"  Skipped   : {skipped}  (already 90-100 KB WebP)")
    print(f"  Warnings  : {warnings} (converted but size outside range)")
    print(f"  Errors    : {errors}")
    sys.stdout.flush()


main()

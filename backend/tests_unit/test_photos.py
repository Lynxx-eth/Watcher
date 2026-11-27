"""
Dependency-light tests for the photo pipeline (needs only Pillow).

These run without FastAPI/SQLAlchemy installed:
    cd backend && PYTHONPATH=. pytest tests_unit -q
"""
import io

import pytest
from PIL import Image

from app.services import photos


def _jpeg(size=(1200, 900), color=(10, 120, 200), exif=None) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "JPEG", **({"exif": exif} if exif else {}))
    return buf.getvalue()


def test_reencodes_to_webp_and_shrinks():
    out = photos.process_photo(_jpeg((2000, 2000)))
    img = Image.open(io.BytesIO(out))
    assert img.format == "WEBP"
    assert max(img.size) <= photos.OUT_MAX_SIDE


def test_strips_exif_gps():
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (12.0, 0.0, 0.0), 3: "E", 4: (8.0, 31.0, 0.0)}  # GPS
    src = _jpeg(exif=exif.tobytes())
    assert dict(Image.open(io.BytesIO(src)).getexif())  # GPS present on input
    out = photos.process_photo(src)
    assert dict(Image.open(io.BytesIO(out)).getexif()) == {}  # gone on output


def test_applies_exif_orientation_then_drops_it():
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90°; portrait source becomes landscape after transpose
    out = photos.process_photo(_jpeg((900, 1800), exif=exif.tobytes()))
    img = Image.open(io.BytesIO(out))
    assert img.width > img.height
    assert dict(img.getexif()) == {}


def test_rejects_non_image_bytes():
    for bad in (b"<?php system($_GET[1]); ?>", b"\x00\x01\x02not an image", b""):
        with pytest.raises(photos.PhotoRejected):
            photos.process_photo(bad)


def test_rejects_disallowed_format_gif():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, "GIF")
    with pytest.raises(photos.PhotoRejected):
        photos.process_photo(buf.getvalue())


def test_png_with_appended_script_is_sanitised():
    buf = io.BytesIO()
    Image.new("RGB", (50, 50), (0, 255, 0)).save(buf, "PNG")
    poly = buf.getvalue() + b"<script>alert(1)</script>"
    out = photos.process_photo(poly)
    assert b"<script>" not in out
    assert Image.open(io.BytesIO(out)).format == "WEBP"


def test_photo_path_blocks_traversal():
    with pytest.raises(ValueError):
        photos.photo_path("/tmp", "../etc/passwd")
    # a normal hex key is accepted
    assert str(photos.photo_path("/tmp", "abc123")).endswith("abc123.webp")

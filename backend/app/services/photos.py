"""
Profile photo pipeline (OWASP File Upload Cheat Sheet):
- size limit enforced while reading (not trusting Content-Length)
- type decided by decoding the bytes with Pillow, never by filename/MIME header
- allow-list of formats; decompression-bomb guard
- re-encoded from pixels to WebP, so EXIF (including GPS), ICC payloads and
  any appended data are discarded
- random server-side filename; stored outside the web root
"""

import io
import secrets
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000  # ~ 6300 x 6300
OUT_MAX_SIDE = 800


class PhotoRejected(ValueError):
    pass


def process_photo(raw: bytes) -> bytes:
    """Validate and normalise an uploaded image. Returns WebP bytes."""
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            fmt = probe.format
            probe.verify()  # structural check; image is unusable afterwards
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as e:
        raise PhotoRejected("File is not a valid image") from e
    if fmt not in ALLOWED_FORMATS:
        raise PhotoRejected("Only JPEG, PNG or WebP images are accepted")

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)  # honour camera rotation before EXIF is dropped
            img = img.convert("RGB")
            img.thumbnail((OUT_MAX_SIDE, OUT_MAX_SIDE), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            # New image from pixels only: no exif=, no icc_profile= → metadata is not carried over.
            img.save(out, format="WEBP", quality=85, method=4)
            return out.getvalue()
    except (OSError, Image.DecompressionBombError) as e:
        raise PhotoRejected("Image could not be processed") from e


def new_photo_key() -> str:
    return secrets.token_hex(16)


def photo_path(upload_dir: str, key: str) -> Path:
    if not key.isalnum():  # keys are hex we generated; refuse anything else
        raise ValueError("bad photo key")
    return Path(upload_dir) / "photos" / f"{key}.webp"


def save_photo(upload_dir: str, data: bytes) -> str:
    key = new_photo_key()
    path = photo_path(upload_dir, key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def delete_photo(upload_dir: str, key: str | None) -> None:
    if key:
        photo_path(upload_dir, key).unlink(missing_ok=True)


async def read_limited(upload, max_bytes: int) -> bytes:
    """Read an UploadFile in chunks, aborting once max_bytes is exceeded."""
    buf = bytearray()
    while chunk := await upload.read(64 * 1024):
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise PhotoRejected(f"Image exceeds {max_bytes // (1024 * 1024)} MB")
    if not buf:
        raise PhotoRejected("Empty file")
    return bytes(buf)

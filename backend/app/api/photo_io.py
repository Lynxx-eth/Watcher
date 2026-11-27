"""Shared upload/serve helpers for owner and admin photo routes."""

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import Settings
from app.models import Profile
from app.services.photos import PhotoRejected, delete_photo, photo_path, process_photo, read_limited, save_photo


async def replace_photo(p: Profile, file: UploadFile, settings: Settings) -> None:
    try:
        raw = await read_limited(file, settings.max_upload_mb * 1024 * 1024)
        data = process_photo(raw)
    except PhotoRejected as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from None
    old = p.photo_key
    p.photo_key = save_photo(settings.upload_dir, data)
    delete_photo(settings.upload_dir, old)


def serve_photo(p: Profile, settings: Settings) -> FileResponse:
    if not p.photo_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NO PHOTO ON FILE")
    path = photo_path(settings.upload_dir, p.photo_key)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NO PHOTO ON FILE")
    return FileResponse(path, media_type="image/webp", headers={"Content-Disposition": "inline"})


def remove_photo(p: Profile, settings: Settings) -> None:
    delete_photo(settings.upload_dir, p.photo_key)
    p.photo_key = None

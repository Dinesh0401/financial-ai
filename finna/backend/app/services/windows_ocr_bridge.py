from __future__ import annotations

import asyncio
import json
import sys

from winsdk.windows.graphics.imaging import BitmapDecoder
from winsdk.windows.media.ocr import OcrEngine
from winsdk.windows.storage.streams import DataWriter, InMemoryRandomAccessStream


async def _ocr_image(image_path: str) -> list[dict[str, float | str]]:
    with open(image_path, "rb") as source:
        payload = source.read()

    stream = InMemoryRandomAccessStream()
    writer = DataWriter(stream)
    writer.write_bytes(payload)
    await writer.store_async()
    writer.detach_stream()
    stream.seek(0)

    decoder = await BitmapDecoder.create_async(stream)
    bitmap = await decoder.get_software_bitmap_async()
    engine = OcrEngine.try_create_from_user_profile_languages()
    if engine is None:
        return []

    result = await engine.recognize_async(bitmap)
    lines: list[dict[str, float | str]] = []
    for line in result.lines:
        if not line.words:
            continue
        x = min(word.bounding_rect.x for word in line.words)
        y = min(word.bounding_rect.y for word in line.words)
        lines.append({"text": line.text, "x": float(x), "y": float(y)})
    return lines


def main() -> int:
    if len(sys.argv) != 2:
        print("[]")
        return 1

    lines = asyncio.run(_ocr_image(sys.argv[1]))
    print(json.dumps(lines, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

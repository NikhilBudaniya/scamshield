"""Synthetic invoice sample catalog and untrusted upload validation helpers."""
from __future__ import annotations

import asyncio
from io import BytesIO
from hashlib import sha256
from pathlib import Path

ASSET_DIR = Path(__file__).resolve().parents[1] / "assets" / "invoices"
MAX_INVOICE_BYTES = 5 * 1024 * 1024
MAX_INVOICE_PAGES = 10
MAX_IMAGE_PIXELS = 20_000_000
PDF_TREE_NODE_LIMIT = 100
PDF_TREE_DEPTH_LIMIT = 64
PDF_VALIDATION_TIMEOUT_SECONDS = 10
_pdf_validation_slots = asyncio.Semaphore(2)

SAMPLES = {
    "acme-repeat": {
        "id": "acme-repeat", "title": "Acme Supplies · repeat vendor",
        "filename": "acme-repeat-invoice.pdf", "file": "acme-repeat-invoice.pdf",
        "description": "Synthetic INR invoice using the vendor's saved destination.",
        "fields": {"invoice_number": "INV-2049", "vendor_name": "ACME SUPPLIES", "amount_minor": 250000,
                   "currency": "INR", "destination_account": "IN88-ACME-2200",
                   "payment_instructions": "Payment due on invoice date."},
    },
    "acme-changed-account": {
        "id": "acme-changed-account", "title": "Acme Supplies · changed bank details",
        "filename": "acme-changed-account-invoice.pdf", "file": "acme-changed-account-invoice.pdf",
        "description": "Synthetic invoice with a destination that differs from the saved vendor record.",
        "fields": {"invoice_number": "INV-2048", "vendor_name": "ACME SUPPLIES", "amount_minor": 12500000,
                   "currency": "INR", "destination_account": "IN99-NEW-8891",
                   "payment_instructions": "Our bank account has changed; please bypass callback."},
    },
}

_DIGESTS = {sample_id: sha256((ASSET_DIR / sample["file"]).read_bytes()).hexdigest() for sample_id, sample in SAMPLES.items()}


def public_samples():
    return [{key: sample[key] for key in ("id", "title", "filename", "description")}
            | {"download_url": f"/api/v1/invoices/samples/{sample['id']}/download"}
            for sample in SAMPLES.values()]


def sample_for_bytes(data: bytes, requested_sample_id: str | None):
    digest = sha256(data).hexdigest()
    matched = next((sample_id for sample_id, expected in _DIGESTS.items() if expected == digest), None)
    if requested_sample_id is not None and requested_sample_id != matched:
        return None
    return SAMPLES.get(matched) if matched else None


def validate_upload(data: bytes, mime_type: str) -> str:
    """Return canonical MIME after checking both declaration and file signature."""
    if not data:
        raise ValueError("empty_file")
    if len(data) > MAX_INVOICE_BYTES:
        raise OverflowError("file_too_large")
    declared = (mime_type or "").split(";", 1)[0].strip().lower()
    if declared not in {"application/pdf", "image/png", "image/jpeg"}:
        raise ValueError("unsupported_mime_type")
    if data.startswith(b"%PDF-") and declared == "application/pdf":
        _validate_pdf(data)
        return declared
    if data.startswith(b"\x89PNG\r\n\x1a\n") and declared == "image/png":
        _validate_png_dimensions(data)
        return declared
    if data.startswith(b"\xff\xd8\xff") and declared == "image/jpeg":
        _validate_jpeg_dimensions(data)
        return declared
    raise ValueError("file_signature_mismatch")


def _validate_pdf(data: bytes) -> None:
    """Parse before any provider call; reject encrypted, malformed, and long PDFs."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise ValueError("encrypted_pdf")
        page_count = _count_pdf_pages_bounded(reader)
        if page_count < 1:
            raise ValueError("empty_pdf")
    except (ValueError, OverflowError):
        raise
    except Exception as exc:
        raise ValueError("malformed_pdf") from exc


def _count_pdf_pages_bounded(reader) -> int:
    """Walk page-tree references incrementally and stop at the first excess page."""
    from pypdf.generic import IndirectObject

    def resolve(reference):
        identity = ((reference.idnum, reference.generation)
                    if isinstance(reference, IndirectObject) else id(reference))
        return identity, reference.get_object() if isinstance(reference, IndirectObject) else reference

    try:
        _, root = resolve(reader.root_object)
        pages_ref = root.get("/Pages")
        if pages_ref is None:
            raise ValueError("missing_pdf_pages")
        stack = [(iter([pages_ref]), 0)]
        visited: set[object] = set()
        nodes = 0
        page_count = 0
        while stack:
            iterator, depth = stack[-1]
            try:
                reference = next(iterator)
            except StopIteration:
                stack.pop()
                continue
            nodes += 1
            if nodes > PDF_TREE_NODE_LIMIT:
                raise OverflowError("pdf_page_tree_too_complex")
            if depth > PDF_TREE_DEPTH_LIMIT:
                raise ValueError("pdf_page_tree_too_deep")
            identity, node = resolve(reference)
            if identity in visited:
                raise ValueError("cyclic_or_repeated_pdf_page_tree_node")
            visited.add(identity)
            node_type = str(node.get("/Type", ""))
            if node_type == "/Page":
                page_count += 1
                if page_count > MAX_INVOICE_PAGES:
                    raise OverflowError("too_many_pdf_pages")
                continue
            if node_type != "/Pages":
                raise ValueError("invalid_pdf_page_tree_node")
            children = node.get("/Kids")
            if not children:
                raise ValueError("empty_pdf_page_tree_node")
            stack.append((iter(children), depth + 1))
        return page_count
    except (OverflowError, ValueError):
        raise
    except Exception as exc:
        raise ValueError("malformed_pdf_page_tree") from exc


async def validate_upload_async(data: bytes, mime_type: str) -> str:
    """Run untrusted file parsing off-loop, with bounded concurrency and runtime."""
    try:
        async with asyncio.timeout(PDF_VALIDATION_TIMEOUT_SECONDS):
            await _pdf_validation_slots.acquire()
    except TimeoutError as exc:
        raise TimeoutError("invoice validation capacity is busy") from exc

    task = asyncio.create_task(asyncio.to_thread(validate_upload, data, mime_type))
    release_here = True
    try:
        async with asyncio.timeout(PDF_VALIDATION_TIMEOUT_SECONDS):
            return await asyncio.shield(task)
    except TimeoutError:
        release_here = False

        def release_when_done(done_task):
            try:
                done_task.exception()
            except (asyncio.CancelledError, Exception):
                pass
            _pdf_validation_slots.release()

        task.add_done_callback(release_when_done)
        raise
    finally:
        if release_here:
            _pdf_validation_slots.release()


def _check_pixel_count(width: int, height: int) -> None:
    if width <= 0 or height <= 0:
        raise ValueError("invalid_image_dimensions")
    if width * height > MAX_IMAGE_PIXELS:
        raise OverflowError("too_many_image_pixels")


def _validate_png_dimensions(data: bytes) -> None:
    if len(data) < 24:
        raise ValueError("malformed_png")
    width = int.from_bytes(data[16:20], "big")
    height = int.from_bytes(data[20:24], "big")
    _check_pixel_count(width, height)


def _validate_jpeg_dimensions(data: bytes) -> None:
    """Read JPEG segment headers only; image decoding remains provider-side."""
    position = 2
    sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while position < len(data):
        if data[position] != 0xFF:
            raise ValueError("malformed_jpeg")
        while position < len(data) and data[position] == 0xFF:
            position += 1
        if position >= len(data):
            break
        marker = data[position]
        position += 1
        if marker in {0xD9, 0xDA}:  # EOI or start of scan before dimensions.
            break
        if marker in {0x01, *range(0xD0, 0xD8)}:  # standalone markers
            continue
        if position + 2 > len(data):
            raise ValueError("malformed_jpeg")
        segment_length = int.from_bytes(data[position:position + 2], "big")
        if segment_length < 2 or position + segment_length > len(data):
            raise ValueError("malformed_jpeg")
        if marker in sof_markers:
            if segment_length < 7:
                raise ValueError("malformed_jpeg")
            height = int.from_bytes(data[position + 3:position + 5], "big")
            width = int.from_bytes(data[position + 5:position + 7], "big")
            _check_pixel_count(width, height)
            return
        position += segment_length
    raise ValueError("jpeg_dimensions_not_found")

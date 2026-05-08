"""QR code generation utilities.

Generates QR code PNG files for assets and returns URLs that the API can serve.
"""

from pathlib import Path

import qrcode

from constants import DEFAULT_LOCAL_QR_PREFIX


class QRCodeGenerator:
    """Creates QR code images for assets and returns the public image URL."""

    def __init__(self, output_dir: Path, public_prefix: str = DEFAULT_LOCAL_QR_PREFIX):
        """Configure where QR images are stored and how clients access them."""

        self.output_dir = output_dir
        self.public_prefix = public_prefix

    def generate_for_asset(self, asset_id: int, qr_value: int | str) -> str:
        """Generate a PNG QR code for an asset and return its API-visible URL."""

        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"asset_{asset_id}.png"
        image = qrcode.make(str(qr_value))
        image.save(self.output_dir / file_name)
        return f"{self.public_prefix}/{file_name}"

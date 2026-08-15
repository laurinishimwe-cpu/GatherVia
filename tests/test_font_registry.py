import hashlib
import json
import unittest
from pathlib import Path

from app.models.canvas import CanvasLayer
from app.models.flyer import FlyerConfiguration, QrBounds
from app.services.invitation_rendering.font_registry import (
    bundled_font_families,
    normalize_font_family,
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATHS = (
    REPOSITORY_ROOT / "shared" / "font-registry.json",
    REPOSITORY_ROOT / "frontend" / "lib" / "flyer" / "font-registry.json",
    REPOSITORY_ROOT / "mobile" / "lib" / "flyer" / "font-registry.json",
)
FONT_ROOTS = (
    REPOSITORY_ROOT / "assets" / "fonts",
    REPOSITORY_ROOT / "frontend" / "public" / "fonts",
    REPOSITORY_ROOT / "mobile" / "assets" / "fonts",
)


class SharedFontRegistryTests(unittest.TestCase):
    def test_registry_is_identical_on_every_platform(self) -> None:
        registries = [
            json.loads(path.read_text(encoding="utf-8"))
            for path in REGISTRY_PATHS
        ]
        self.assertTrue(all(registry == registries[0] for registry in registries[1:]))
        self.assertEqual(
            bundled_font_families(),
            (
                "Inter",
                "Source Serif 4",
                "Dancing Script",
                "Montserrat",
                "Playfair Display",
                "League Spartan",
            ),
        )

    def test_every_registered_face_is_byte_identical(self) -> None:
        registry = json.loads(REGISTRY_PATHS[0].read_text(encoding="utf-8"))
        filenames = {
            filename
            for family in registry["families"]
            for style in family["faces"].values()
            for filename in style.values()
        }
        for filename in filenames:
            with self.subTest(filename=filename):
                payloads = [(root / filename).read_bytes() for root in FONT_ROOTS]
                hashes = {hashlib.sha256(payload).hexdigest() for payload in payloads}
                self.assertEqual(len(hashes), 1)

    def test_legacy_names_normalize_to_canonical_families(self) -> None:
        self.assertEqual(normalize_font_family("Arial, sans-serif"), "Inter")
        self.assertEqual(normalize_font_family("Georgia"), "Source Serif 4")
        self.assertEqual(normalize_font_family("DancingScript"), "Dancing Script")
        self.assertEqual(normalize_font_family("Playfair"), "Playfair Display")
        self.assertEqual(normalize_font_family("LeagueSpartan"), "League Spartan")
        self.assertEqual(normalize_font_family("Unknown Remote Font"), "Inter")

        layer = CanvasLayer.model_validate(
            {
                "id": "title",
                "type": "text",
                "text": "Welcome",
                "font_family": "Georgia",
            }
        )
        self.assertEqual(layer.fontFamily, "Source Serif 4")

        configuration = FlyerConfiguration(
            image_width=1080,
            image_height=1920,
            qr_bounds=QrBounds(x=0, y=0, width=100, height=100),
            stub_guest_font_family="Arial",
        )
        self.assertEqual(configuration.stub_guest_font_family, "Inter")


if __name__ == "__main__":
    unittest.main()

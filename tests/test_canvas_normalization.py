import unittest

from app.models.canvas import CanvasLayer


class CanvasLayerNormalizationTests(unittest.TestCase):
    def test_legacy_names_are_serialized_with_the_canonical_contract(self) -> None:
        layer = CanvasLayer.model_validate(
            {
                "id": "legacy-path",
                "type": "rectangle",
                "parent_id": "main-frame",
                "z_index": 4,
                "x": 10,
                "y": 12,
                "width": 50,
                "height": 20,
                "font_weight": "600",
                "font_style": "oblique",
                "text_align": "middle",
                "stroke_width": 2,
                "border_radius": 8,
                "path": "M 0 0 L 100 100",
                "polygon": "0,0 100,0 50,100",
                "image_url": "https://example.test/image.png",
                "qr_value": "guest-code",
                "shadow": {
                    "shadow_color": "#00000080",
                    "shadow_blur": 9,
                    "shadow_offset_x": 2,
                    "shadow_offset_y": 5,
                },
            }
        )

        payload = layer.model_dump(exclude_none=True)
        self.assertEqual(payload["type"], "rect")
        self.assertEqual(payload["parentId"], "main-frame")
        self.assertEqual(payload["zIndex"], 4)
        self.assertEqual(payload["fontWeight"], "semibold")
        self.assertEqual(payload["fontStyle"], "italic")
        self.assertEqual(payload["textAlign"], "center")
        self.assertEqual(payload["strokeWidth"], 2)
        self.assertEqual(payload["borderRadius"], 8)
        self.assertEqual(payload["pathData"], "M 0 0 L 100 100")
        self.assertEqual(payload["points"], "0,0 100,0 50,100")
        self.assertEqual(payload["imageUrl"], "https://example.test/image.png")
        self.assertEqual(payload["qrValue"], "guest-code")
        self.assertEqual(payload["shadow"]["offsetX"], 2)
        self.assertEqual(payload["shadow"]["offsetY"], 5)
        self.assertNotIn("parent_id", payload)
        self.assertNotIn("path", payload)


if __name__ == "__main__":
    unittest.main()

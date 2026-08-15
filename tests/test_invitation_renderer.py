import base64
import hashlib
import io
import unittest

from PIL import Image, ImageDraw

from app.services.invitation_rendering.constants import (
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    CURVE_DEPTH,
    MIN_QR_BOTTOM_PERCENT,
    STUB_HEIGHT,
    SUPPORTED_LAYER_TYPES,
    TOP_HEIGHT,
)
from app.services.invitation_rendering.renderer import _composite_layer, render_guest_invitation
from app.models.schemas.invitation_rendering import InvitationRenderRequest
from app.routes.flyers import ephemeral_invitation_response, router as flyer_router


def data_image() -> str:
    image = Image.new("RGB", (80, 60), "#0f766e")
    ImageDraw.Draw(image).rectangle((30, 0, 79, 59), fill="#f59e0b")
    output = io.BytesIO()
    image.save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()


class InvitationRendererTests(unittest.TestCase):
    def setUp(self) -> None:
        self.configuration = {
            "canvas_background_color": "linear-gradient(135deg, #fee2e2 0%, #dbeafe 100%)",
            "stub_background_color": "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
            "stub_text_color": "#ffffff",
            "stub_accent_color": "#4fd6be",
            "stub_qr_right": 7,
            "stub_qr_bottom": 10,
            "stub_qr_size": 26,
            "stub_guest_info_top": 24,
            "stub_guest_font_family": "Arial",
            "stub_guest_font_weight": "bold",
            "stub_guest_font_style": "normal",
            "stub_guest_name_font_size": 22,
            "stub_curve_shadow_color": "#000000",
            "stub_curve_shadow_opacity": 40,
            "stub_curve_shadow_blur": 12,
            "stub_curve_shadow_offset": 6,
            "artboard_stroke_color": "#111827",
            "artboard_stroke_width": 1,
        }
        self.layers = [
            {
                "id": "image",
                "type": "image",
                "x": 0,
                "y": 0,
                "width": 100,
                "height": 34,
                "imageUrl": data_image(),
                "zIndex": 0,
                "visible": True,
            },
            {
                "id": "rect",
                "type": "rect",
                "x": 7.5,
                "y": 36,
                "width": 85,
                "height": 14,
                "fill": "linear-gradient(90deg, rgba(79, 214, 190, 0.8) 0%, #2563eb 100%)",
                "stroke": "#ffffff",
                "strokeWidth": 2,
                "borderRadius": 12,
                "rotation": -3,
                "shadow": {"color": "#00000080", "blur": 8, "offsetX": 2, "offsetY": 4},
                "zIndex": 1,
                "visible": True,
            },
            {
                "id": "ellipse",
                "type": "ellipse",
                "x": 6,
                "y": 53,
                "width": 17,
                "height": 14,
                "fill": "radial-gradient(#fef08a 0%, #f97316 100%)",
                "stroke": "#7c2d12",
                "strokeWidth": 2,
                "zIndex": 2,
                "visible": True,
            },
            {
                "id": "polygon",
                "type": "polygon",
                "x": 28,
                "y": 53,
                "width": 19,
                "height": 14,
                "points": "50,0 100,100 0,100",
                "fill": "#a855f7",
                "stroke": "#ffffff",
                "strokeWidth": 1,
                "zIndex": 3,
                "visible": True,
            },
            {
                "id": "path",
                "type": "path",
                "x": 52,
                "y": 53,
                "width": 34,
                "height": 15,
                "pathData": "M 4 50 C 22 0, 72 0, 106 50 Z",
                "fill": "#ec4899",
                "stroke": "#831843",
                "strokeWidth": 2,
                "zIndex": 4,
                "visible": True,
            },
            {
                "id": "text",
                "type": "text",
                "x": 10,
                "y": 68,
                "width": 80,
                "height": 14,
                "text": "Every detail\ntravels with the design",
                "fontFamily": "Arial",
                "fontSize": 22,
                "fontWeight": "bold",
                "fontStyle": "italic",
                "textAlign": "center",
                "color": "linear-gradient(90deg, #0f172a 0%, #0d9488 100%)",
                "zIndex": 5,
                "visible": True,
            },
            {
                "id": "frame",
                "type": "frame",
                "x": 6,
                "y": 84,
                "width": 88,
                "height": 11,
                "fill": "transparent",
                "stroke": "#0f766e",
                "strokeWidth": 3,
                "borderRadius": 14,
                "zIndex": 6,
                "visible": True,
            },
            {
                "id": "qr",
                "type": "qr",
                "x": 43.5,
                "y": 84.5,
                "width": 13,
                "height": 10,
                "qrValue": "layer-specific-code",
                "zIndex": 7,
                "visible": True,
            },
        ]
        self.guest = {"name": "Nishimwe Lauri", "category": "VIP", "qr_hash": "guest-unique-hash"}

    def test_renders_every_supported_layer_to_png(self) -> None:
        self.assertEqual({layer["type"] for layer in self.layers}, set(SUPPORTED_LAYER_TYPES))
        content = render_guest_invitation(self.configuration, self.layers, self.guest, "png")
        self.assertTrue(content.startswith(b"\x89PNG\r\n\x1a\n"))
        with Image.open(io.BytesIO(content)) as image:
            self.assertEqual(image.size, (CANVAS_WIDTH, CANVAS_HEIGHT))
            self.assertNotEqual(image.getpixel((40, 40)), image.getpixel((1040, 1240)))
            qr_crop = image.crop((690, 1450, 1030, 1810)).convert("L")
            minimum, maximum = qr_crop.getextrema()
            self.assertLess(minimum, 30)
            self.assertGreater(maximum, 225)

    def test_layer_shadow_blur_extends_beyond_shape_bounds(self) -> None:
        surface = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT))
        layer = {
            "id": "shadowed-rect",
            "type": "rect",
            "x": 10,
            "y": 10,
            "width": 20,
            "height": 10,
            "fill": "#ffffff",
            "shadow": {"color": "#00000080", "blur": 8, "offsetX": 0, "offsetY": 0},
        }

        _composite_layer(surface, layer, "guest-hash")

        left_edge = round(layer["x"] * CANVAS_WIDTH / 100)
        center_y = round(
            layer["y"] * TOP_HEIGHT / 100
            + layer["height"] * TOP_HEIGHT / 200
        )
        near_alpha = surface.getpixel((left_edge - 2, center_y))[3]
        far_alpha = surface.getpixel((left_edge - 35, center_y))[3]
        self.assertGreater(near_alpha, far_alpha)
        self.assertGreater(far_alpha, 0)

    def test_render_is_deterministic_and_supports_jpeg(self) -> None:
        first = render_guest_invitation(self.configuration, self.layers, self.guest, "png")
        second = render_guest_invitation(self.configuration, self.layers, self.guest, "png")
        self.assertEqual(hashlib.sha256(first).digest(), hashlib.sha256(second).digest())
        jpeg = render_guest_invitation(self.configuration, self.layers, self.guest, "jpg")
        self.assertTrue(jpeg.startswith(b"\xff\xd8\xff"))
        with Image.open(io.BytesIO(jpeg)) as image:
            self.assertEqual(image.size, (CANVAS_WIDTH, CANVAS_HEIGHT))

    def test_renders_optional_event_details_and_icon_color(self) -> None:
        configuration = {
            **self.configuration,
            "stub_event_details_icon_color": "#ff0000",
            "stub_show_event_date": True,
            "stub_show_event_time": True,
            "stub_show_event_location": True,
        }
        without_details = render_guest_invitation(configuration, self.layers, self.guest, "png")
        with_details = render_guest_invitation(
            configuration,
            self.layers,
            self.guest,
            "png",
            {"date": "2026-07-23", "time": "18:30", "location": "Kigali Convention Centre"},
        )
        self.assertNotEqual(hashlib.sha256(without_details).digest(), hashlib.sha256(with_details).digest())
        with Image.open(io.BytesIO(with_details)).convert("RGB") as image:
            details_crop = image.crop((50, 1620, 520, 1850))
            self.assertTrue(
                any(
                    red > 180 and green < 80 and blue < 80
                    for red, green, blue in details_crop.get_flattened_data()
                )
            )

    def test_stub_detail_position_and_category_visibility_are_rendered(self) -> None:
        details = {"date": "2026-07-23", "time": "18:30", "location": "Kigali"}
        first_configuration = {
            **self.configuration,
            "stub_event_details_icon_color": "#ff0000",
            "stub_event_details_top": 8,
            "stub_event_details_left": 5,
            "stub_show_guest_category": True,
        }
        moved_configuration = {
            **first_configuration,
            "stub_event_details_top": 70,
            "stub_event_details_left": 42,
            "stub_show_guest_category": False,
        }
        first = render_guest_invitation(first_configuration, self.layers, self.guest, "png", details)
        moved = render_guest_invitation(moved_configuration, self.layers, self.guest, "png", details)
        self.assertNotEqual(hashlib.sha256(first).digest(), hashlib.sha256(moved).digest())

        with Image.open(io.BytesIO(first)).convert("RGB") as first_image:
            upper_left = first_image.crop((35, 1280, 360, 1510))
            self.assertTrue(
                any(red > 180 and green < 80 and blue < 80 for red, green, blue in upper_left.get_flattened_data())
            )
        with Image.open(io.BytesIO(moved)).convert("RGB") as moved_image:
            lower_right = moved_image.crop((420, 1680, 900, 1910))
            self.assertTrue(
                any(red > 180 and green < 80 and blue < 80 for red, green, blue in lower_right.get_flattened_data())
            )

    def test_time_name_mode_and_guest_left_offset_are_rendered(self) -> None:
        base = {
            **self.configuration,
            "stub_guest_info_left": 6,
            "stub_guest_name_mode": "first",
        }
        first_name = render_guest_invitation(base, self.layers, self.guest, "png", {})
        with_time = render_guest_invitation(base, self.layers, self.guest, "png", {"time": "18:30"})
        full_name = render_guest_invitation(
            {**base, "stub_guest_name_mode": "full"}, self.layers, self.guest, "png", {"time": "18:30"}
        )
        moved_name = render_guest_invitation(
            {**base, "stub_guest_name_mode": "full", "stub_guest_info_left": 28},
            self.layers,
            self.guest,
            "png",
            {"time": "18:30"},
        )
        hashes = {
            hashlib.sha256(content).digest()
            for content in (first_name, with_time, full_name, moved_name)
        }
        self.assertEqual(len(hashes), 4)

    def test_stub_curve_and_qr_use_shared_reference_geometry_and_secure_colors(self) -> None:
        configuration = {
            **self.configuration,
            "canvas_background_color": "#16a34a",
            "stub_background_color": "#2563eb",
            "stub_text_color": "#ffffff",
            "qr_foreground_color": "#dc2626",
            "qr_background_color": "#fef3c7",
            "qr_background_transparent": False,
            "stub_qr_size": 26,
            "stub_curve_shadow_opacity": 0,
            "artboard_stroke_width": 0,
        }
        content = render_guest_invitation(
            configuration,
            [],
            self.guest,
            "png",
        )

        with Image.open(io.BytesIO(content)).convert("RGB") as image:
            self.assertEqual(image.getpixel((20, TOP_HEIGHT)), (37, 99, 235))
            self.assertEqual(
                image.getpixel((CANVAS_WIDTH // 2, round(TOP_HEIGHT - CURVE_DEPTH * 0.5))),
                (22, 163, 74),
            )

            qr_size = round(CANVAS_WIDTH * configuration["stub_qr_size"] / 100)
            qr_right = round(CANVAS_WIDTH * configuration["stub_qr_right"] / 100)
            qr_bottom = round(STUB_HEIGHT * MIN_QR_BOTTOM_PERCENT / 100)
            qr_left = CANVAS_WIDTH - qr_right - qr_size
            qr_top = CANVAS_HEIGHT - qr_bottom - qr_size
            qr_crop = image.crop((qr_left, qr_top, qr_left + qr_size, qr_top + qr_size))
            colors = qr_crop.getcolors(maxcolors=qr_size * qr_size) or []
            color_values = {color for _, color in colors}
            self.assertTrue(any(red > 180 and green < 80 and blue < 80 for red, green, blue in color_values))
            self.assertIn((0, 0, 0), color_values)
            self.assertIn((255, 255, 255), color_values)
            self.assertNotIn((254, 243, 199), color_values)

            footer_crop = image.crop((CANVAS_WIDTH // 2, 1830, 820, 1910))
            footer_colors = footer_crop.getcolors(maxcolors=footer_crop.width * footer_crop.height) or []
            self.assertTrue(
                any(
                    red > 120 and red > green * 1.5 and red > blue * 1.3
                    for _, (red, green, blue) in footer_colors
                )
            )

    def test_api_schema_accepts_gradient_configuration_and_route_is_static(self) -> None:
        payload = InvitationRenderRequest.model_validate(
            {
                "configuration": {
                    **self.configuration,
                    "qr_bounds": {"x": 0, "y": 0, "width": 100, "height": 100},
                    "image_width": CANVAS_WIDTH,
                    "image_height": CANVAS_HEIGHT,
                },
                "layers": self.layers,
                "guest": self.guest,
                "format": "png",
            }
        )
        self.assertTrue(payload.configuration.canvas_background_color.startswith("linear-gradient"))
        route_paths = [route.path for route in flyer_router.routes]
        self.assertIn("/flyers/render-invitation", route_paths)
        self.assertIn("/flyers/render-saved-invitation", route_paths)
        self.assertIn("/flyers/render-saved-invitation/{event_id}/{guest_id}", route_paths)
        self.assertLess(route_paths.index("/flyers/render-invitation"), route_paths.index("/flyers/{flyer_id}"))

        response = ephemeral_invitation_response(b"image", "png")
        self.assertEqual(response.headers["cache-control"], "private, no-store, max-age=0")
        self.assertEqual(response.headers["x-gathervia-asset-lifecycle"], "ephemeral")


if __name__ == "__main__":
    unittest.main()

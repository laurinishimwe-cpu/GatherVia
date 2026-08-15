import os
import unittest
from unittest.mock import patch

from app.services.communications import (
    PRODUCTION_PUBLIC_APP_URL,
    _admin_rsvp_url,
    _invite_url,
    _share_url,
)


class CommunicationUrlTests(unittest.TestCase):
    def test_local_development_origin_is_preserved(self) -> None:
        with (
            patch("app.services.communications.settings.public_app_url", "http://localhost:3000"),
            patch.dict(os.environ, {}, clear=True),
        ):
            self.assertEqual(_invite_url("summer-party"), "http://localhost:3000/invite/summer-party")

    def test_render_never_generates_localhost_public_links(self) -> None:
        with (
            patch("app.services.communications.settings.public_app_url", "http://localhost:3000"),
            patch.dict(os.environ, {"RENDER": "true"}, clear=True),
        ):
            self.assertEqual(_invite_url("summer-party"), f"{PRODUCTION_PUBLIC_APP_URL}/invite/summer-party")
            self.assertEqual(_admin_rsvp_url("event-id"), f"{PRODUCTION_PUBLIC_APP_URL}/admin-rsvp/event-id")
            self.assertEqual(_share_url("token"), f"{PRODUCTION_PUBLIC_APP_URL}/scan/token")


if __name__ == "__main__":
    unittest.main()

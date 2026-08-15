"""Render the parity-test invitation for quick visual comparison with OriginalFlyer."""

from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.test_invitation_renderer import InvitationRendererTests
from app.services.invitation_rendering import render_guest_invitation


def main() -> None:
    fixture = InvitationRendererTests()
    fixture.setUp()
    output = Path("tests/artifacts/backend-invitation-reference.png")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(
        render_guest_invitation(fixture.configuration, fixture.layers, fixture.guest, "png")
    )
    print(output.resolve())


if __name__ == "__main__":
    main()

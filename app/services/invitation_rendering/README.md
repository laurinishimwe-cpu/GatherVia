# Invitation rendering

This package is the backend counterpart of `OriginalFlyer.tsx`. It renders the
same layer/configuration payload to a fixed 1080 x 1920 PNG or JPEG without
changing an event or flyer draft.

## Modules

- `renderer.py`: layer composition and the final guest stub.
- `paint.py`: CSS solid, linear-gradient, and radial-gradient paints.
- `typography.py`: font resolution, wrapping, alignment, and fitting.
- `assets.py`: data URL, uploaded flyer, and remote image loading.
- `vectors.py`: polygon and SVG path rasterization.
- `constants.py`: shared output geometry and supported layer types.

## Preview endpoint

`POST /api/v1/flyers/render-invitation` accepts the same configuration and
layers used by the frontend, plus guest `name`, `category`, and `qr_hash`.
It returns image bytes and requires the normal bearer token.

`POST /api/v1/flyers/render-saved-invitation` is the final share/download path.
It accepts `event_id`, `guest_id`, `format`, and an optional category. It reloads
the latest saved event design, category rules, guest name, and QR hash from
MongoDB for every request.

Generated passes are memory-only responses. They are never uploaded to local or
Supabase storage and include `Cache-Control: private, no-store`, so there is no
generated object to clean up after a share or download. Source layer assets are
durable and remain available for future renders until the layer or event is
deleted.

Responses also include `X-GatherVia-Asset-Lifecycle: ephemeral` so clients and
diagnostics can distinguish generated invitation bytes from durable assets.

Each API worker renders at most four invitations concurrently. Additional
requests wait for a slot, preventing large events from exhausting worker memory.

Keep `OriginalFlyer.tsx` active while comparing previews. Run the parity suite
after changing either renderer:

```powershell
python -m unittest tests.test_invitation_renderer -v
python scripts/render_invitation_fixture.py
```

The second command writes `tests/artifacts/backend-invitation-reference.png`
for visual comparison. Do not remove the frontend renderer until representative
saved flyers match this endpoint for text, gradients, images, vectors, curve,
stub controls, guest data, and QR content.

# Verification report

Verified on 9 October 2026 with Windows, Python 3.11.9, Node.js 24.18.0, and npm 11.16.0.

## Completed checks

- **31 backend/API tests passed.** Coverage includes seeded generation, both strategies over three scenarios and three seeds, planner isolation from hidden cells, weighted navigation, collection/upload distinction, storage, battery floor, obstacle replanning, stranded missions, invalid API inputs, WebSocket initial state, and SQLite persistence across application restarts.
- **TypeScript compilation passed.** Strict type checking is enabled.
- **Vite production build passed.** The generated HTML, JavaScript, and CSS are included under `frontend/dist`.
- **Built-app serving passed** through FastAPI's in-process test client: `/`, all assets referenced by the page, and `/docs` returned successful responses.
- **Six additional complete simulation runs passed** at the default 24 × 24 size, seed 42, with no injected obstacles. Each uploaded science and returned safely with positive energy.

## Recorded demo outcomes

All runs use seed 42, grid 24 × 24, configured energy 240 EU, and obstacle density 13%. The limited-battery scenario caps starting energy at 85 EU.

| Scenario | Strategy | Uploaded value | Observed coverage | Remaining energy | Safe return |
|---|---|---:|---:|---:|---|
| Discovery | Value-aware | 89 | 75.7% | 21.0 EU | Yes |
| Discovery | Nearest-target | 196 | 54.9% | 24.4 EU | Yes |
| Rough terrain | Value-aware | 122 | 56.6% | 20.8 EU | Yes |
| Rough terrain | Nearest-target | 144 | 45.8% | 20.6 EU | Yes |
| Limited battery | Value-aware | 19 | 29.2% | 10.0 EU | Yes |
| Limited battery | Nearest-target | 67 | 30.0% | 12.6 EU | Yes |

The value-aware policy explores more territory in the first two examples, while the nearest-target baseline uploads more science on these runs. These are measured examples, not evidence of universal superiority for either policy. Full metrics are included in `sample-results.json`.

## Verification limits

- The local preview server started, but browser and external loopback requests timed out in the build environment. Visual layout and browser click-through verification therefore remain **unverified**. API and static-asset checks were performed in-process.
- The Windows convenience launcher has been inspected; its component installation and server commands were exercised independently. A fresh-machine double-click test was not performed.
- macOS/Linux setup is documented but has not been tested.
- A Starlette/httpx deprecation warning appears with the locked dependency set; all tests pass.

## Product limits

- One active in-memory mission per server, one backend worker.
- Saved mission inspection and exports; no resume-from-disk or replay playback.
- Ideal grid sensing, no occlusion, no physical dynamics or hardware integration.
- Heuristic target selection, not a global optimization guarantee.
- Arbitrary newly blocked terrain can destroy every return route; the result is explicitly reported as a failure.
- Local demonstration scope, without authentication or multi-user isolation.

To repeat the tests, open a terminal in `backend` and run `.venv/Scripts/python.exe -m pytest -q` after installing the dependencies as described in README.md.

# Hackathon demonstration

## 3-minute walkthrough

**0:00–0:30 — Problem and approach**

“Our rover must turn limited energy into useful uploaded science and still come home. The simulator knows the planet; the rover only sees what its sensors discover.” Point out the unknown dark cells and small observed launch area.

**0:30–1:10 — Autonomous mission**

Launch seed 42, Open discovery, 24 × 24, 240 EU. Use 5 or 10 ticks/s. Show the current objective, energy reserve, planned route, and newly discovered science. Explain that science in storage does not count as uploaded value.

**1:10–1:40 — Changing conditions**

Pause. Click Add obstacle and select an empty observed cell along the dotted route, preferably several cells ahead of the rover. Resume and point to the replan event. The rover must find a new route within its known map. If you accidentally strand it, demonstrate that failure is reported explicitly, then generate a fresh mission.

**1:40–2:20 — Communication and recovery**

Show the upload event when the rover reaches a blue relay. Click Return to request recovery. Explain that return planning includes the relay detour when affordable, and vehicle recovery takes priority if changing terrain makes data delivery unaffordable.

**2:20–3:00 — Evidence**

Show safe return, uploaded value, coverage, energy used, and efficiency. Open Mission archive or export the JSON report. Describe the 31 automated tests and reproducible seeds. Compare a nearest-target run only using measured saved results; do not claim the value-aware heuristic always wins.

## Useful scenario choices

| Demo | Settings | Expected focus |
|---|---|---|
| Standard exploration | Seed 42, 24 × 24, Open discovery, 240 EU | Collection, relay uploads, return |
| Energy constraint | Limited battery | Fewer affordable opportunities and earlier recovery |
| Weighted navigation | Rough terrain | Longer geometric routes can cost less energy |
| Replanning | Pause and add an empty-cell obstacle | Live terrain adaptation |
| Strategy comparison | Same seed/config; switch strategy | Quantified tradeoffs, not guaranteed dominance |

## Answers judges may ask for

**Does it cheat by reading the whole world?** No. The hidden world and rover knowledge are separate. Tests change hidden terrain and verify that the planner's immediate decision is unaffected.

**Why no machine learning?** The 24-hour objective is an explainable, reliable simulation. Frontier selection, weighted shortest paths, and explicit feasibility checks address the requirements without training data or inference services.

**Is safe return guaranteed?** For accepted actions, the planner budgets a known return path and reserve. Arbitrary new obstacles can invalidate all paths; the simulator reports that limitation rather than silently teleporting the rover.

**What does a successful mission mean?** At least one uploaded packet, a recovered rover at base, and positive remaining energy. Safe recovery without uploaded science is reported separately.

**Can we resume a saved mission?** This build stores read-only snapshots and reports. Resuming and replay playback are possible future extensions, not included features.

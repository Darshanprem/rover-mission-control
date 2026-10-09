# Technical stack and architecture

## Stack

| Layer | Technology | Role |
|---|---|---|
| UI | React 19 + TypeScript 5.9 | Dashboard components, state, and typed API data |
| Build | Vite 7 | Local development server and production bundle |
| Visualization | HTML Canvas + SVG | Grid map and energy chart |
| Styling/icons | CSS + Lucide React | Responsive dark mission-control interface |
| API | Python 3.11 + FastAPI | Mission endpoints, request validation, orchestration |
| ASGI server | Uvicorn | Local HTTP and WebSocket server |
| Live transport | Native WebSocket | Server snapshots pushed to the dashboard |
| Planning | NetworkX | Weighted A* routes and Dijkstra energy estimates |
| Storage | SQLite via Python sqlite3 | Mission snapshots and ordered events |
| Validation | Pydantic | Bounds and enums for configuration and commands |
| Tests | pytest + FastAPI TestClient/httpx | Simulation, API, persistence, and WebSocket checks |

Exact frontend dependencies are in `frontend/package-lock.json`; exact backend dependencies are in `backend/requirements-lock.txt`.

## Architecture

```text
React dashboard
   | REST commands              ^ WebSocket state snapshots
   v                            |
FastAPI controller — one async simulation loop + action lock
   |
   +-- Mission simulator: owns hidden world, sensors, movement
   +-- Planner: reads discovered map only
   +-- SQLite: snapshots, configuration, initial world, events
```

All mutations are serialized by an asyncio lock. The frontend never authoritatively calculates energy or position. The UI reconnects WebSockets and polls snapshots while disconnected. It displays the last 60 events; exports contain all recorded events. Route planning is recalculated each tick, allowing the rover to react to discoveries and obstacle changes.

## Simulator model

- Finite square grid, four-direction movement, no wraparound.
- Deterministically seeded terrain and science sites. A short launch corridor guarantees a reachable nearby relay and science site.
- An ideal square sensor reveals cells within Chebyshev distance 2. It has no obstacle occlusion; this is an explicit simulation simplification.
- A separate `known` map contains only sensor observations. The path planner never queries the hidden world.
- Empty terrain move: **1.4 EU** including 0.4 EU sensing.
- Rough terrain move: **3.4 EU** including 0.4 EU sensing.
- Collect: **3 EU**. Upload a batch: **2 EU**. Waiting/pausing: zero simulated energy.
- Five packets maximum. Packet value varies from 15 to 50 points.
- Initial energy is configurable. Limited battery caps it at 85 EU.
- Reserve: max(8 EU, 8% of initial energy).
- Base is a recovery point, not automatically a communication relay.
- Status is lifecycle state (`ready`, `running`, `paused`, `completed`, `failed`, `archived`); mode is current behavior (`explore`, `collect`, `upload`, `return_home`, etc.).

## Decision process

1. Build a directed graph from known traversable cells. Edge weight equals destination movement cost, including sensing.
2. Estimate direct return cost and, when carrying data, the cheapest known route through a communication relay to base.
3. If changed terrain makes upload infeasible, prioritize vehicle recovery. If even direct recovery is impossible, report failure.
4. Upload when standing in a relay with data and enough energy for upload plus return.
5. Honor a requested return or automatically return when energy reaches the home-route cost plus reserve.
6. Collect science at the current cell only if collection, relay travel, upload, return, and reserve fit the budget.
7. When holding three or more packets, prefer a relay.
8. Select feasible known science targets; otherwise select frontiers (known open cells adjacent to unknown cells).
9. If no exploration target is affordable, begin return.

**Target ranking:** science value / (travel energy + collection cost + 2); frontier information gain / (travel energy + 2). Feasibility is checked separately and includes the full return budget. The nearest-target baseline uses the same candidates and safety rules but ranks by travel cost. This is a heuristic policy, not a globally optimal solver.

**A\*:** Manhattan distance × 1.4 is an admissible heuristic because every move costs at least 1.4 EU. **Dijkstra:** computes weighted energy estimates to targets, relays, and base.

## Dynamic terrain

Operators can turn observed empty cells into obstacles. The API rejects edits to unknown cells, the rover, base, relays, science sites, and existing walls. An edit clears the route and increments the replan count. The next tick plans against the changed known map. If all known routes to base are blocked, the mission fails as stranded. The system does not promise recovery from arbitrary adversarial changes.

The displayed replan count records explicit obstacle-triggered route invalidations, not every routine per-tick target evaluation.

## Database

`missions`: id, created_at, config_json, initial_world_json, state_json.

`events`: mission_id, event_id, tick, payload_json; compound primary key prevents duplicate event writes.

The snapshot holds metrics and the observed map. JSON is used for small nested structures; SQLite provides persistence without a separate database service. Active execution remains in memory. This version provides archived inspection and export, not resume/replay playback.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | Health/version |
| GET | /api/active | Active run, or null |
| POST | /api/missions | Generate a world |
| GET | /api/missions | Latest 50 saved mission summaries |
| GET | /api/missions/{id} | Active state or archived snapshot |
| POST | /api/missions/{id}/commands | start, pause, step, return, speed |
| POST | /api/missions/{id}/obstacles | Block an observed empty cell |
| GET | /api/missions/{id}/results | Metrics |
| GET | /api/missions/{id}/export | JSON download with full event log |
| WS | /ws/missions/{id} | Live state updates |

## Metrics and outcomes

- **Secured science:** only uploaded packet value. Collected but unuploaded value is reported separately.
- **Observed coverage:** known cells / all grid cells, including observed obstacles. This is not a percentage of reachable terrain.
- **Visited cells:** unique rover positions, separate from observed coverage.
- **Efficiency:** uploaded value / energy consumed.
- **Safe return:** terminal completed status, rover at base, positive remaining energy.
- **Mission success:** safe return and at least one uploaded packet.
- **Failure:** no known recovery route, insufficient energy, or an infeasible selected route.

## Deployment scope

Designed for a local hackathon demonstration. Run a single backend worker and bind to loopback. Multiple visitors share one active mission. Authentication, multi-user isolation, distributed execution, hardware integration, 3D physics, SLAM, ML training, and cloud deployment are outside this version.

References: [Vite](https://vite.dev/guide/), [FastAPI](https://fastapi.tiangolo.com/), [NetworkX A*](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.shortest_paths.astar.astar_path.html), [SQLite](https://www.sqlite.org/whentouse.html).

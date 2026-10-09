<<<<<<< HEAD
# ORBIT — Rover Mission Control

A complete local hackathon project for **Lost in Space — Rover Mission Control**. Generate an unknown planet, launch an autonomous rover, collect and upload science, introduce obstacles, and recover the rover before its energy runs out.

## Included

- React / TypeScript dashboard with an interactive Canvas map and fog of war.
- Python / FastAPI simulation engine and live WebSocket telemetry.
- Frontier exploration, energy-weighted A* navigation, and safe-return budgeting.
- Value-aware and nearest-target planning strategies.
- Data collection, five-packet storage, communication relays, and uploads.
- Dynamic obstacle injection with replanning and explicit stranded outcomes.
- Start, pause, step, return, speed control, and configurable seeded worlds.
- SQLite mission archives and downloadable JSON reports.
- Backend and API tests, a prebuilt frontend, and VS Code debug configuration.

No API keys, paid services, GPU, external dataset, or database server are needed. Internet is required to install dependencies the first time; normal simulation runs are local.

## 1. Extract and open in VS Code

1. Extract `rover-mission-control.zip` completely. Do not run files from inside the ZIP viewer.
2. In VS Code select **File → Open Folder** and choose the extracted `rover-mission-control` folder containing this README.
3. Install **Python 3.11 or newer** with Python on your PATH. Python 3.11 is the tested version.
4. For frontend development, also install **Node.js 22.12+** (Node 24 LTS is suitable). Node is not required for the prebuilt launch below.
5. Open **Terminal → New Terminal**. The commands below use Windows PowerShell.

## 2. Quickest run: prebuilt dashboard

From the project root in the VS Code terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** in your browser. Keep this terminal running. Press **Ctrl+C** to stop the app.

On later runs you only need:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Alternatively, double-click **START_WINDOWS.bat** in the project root. It creates the virtual environment if needed, installs the locked dependencies, and runs the same server. It does not change your system execution policy.

The ZIP includes `frontend/dist`. FastAPI serves this built dashboard and the API together from port 8000.

## 3. Development mode: edit frontend and backend

Use two VS Code terminals.

**Terminal 1 — backend** (from project root; complete installation above first):

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend** (from project root):

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Vite forwards `/api` and `/ws` requests to the backend on port 8000. Frontend edits appear automatically. Backend edits restart the backend; the in-memory active run will be lost, but its last saved snapshot remains in the archive.

`npm.cmd` avoids PowerShell's `npm.ps1` execution-policy problem. You can use ordinary `npm` in Command Prompt, macOS, or Linux.

To update the prebuilt dashboard after editing the frontend:

```powershell
cd frontend
npm.cmd run build
```

Restart FastAPI, then open port 8000 to use the rebuilt version. Do not open `index.html` directly from the filesystem.

## 4. First demo

1. Keep **Open discovery**, **seed 42**, **24 × 24**, and **240 EU**.
2. Click **Launch**. The green rover discovers nearby terrain and gold science diamonds.
3. Watch **Autonomy feed** explain its decisions. Collected packets stay onboard until uploaded at a blue relay.
4. Pause, enable **Add obstacle**, and click empty observed terrain on the current route, away from the rover. Resume or Step to see replanning.
5. Click **Return** or let the energy-aware planner return automatically.
6. Inspect secured science, remaining energy, coverage, and safe recovery. Download **Export JSON**.
7. Generate a **Limited battery** scenario or switch to the **Nearest-target baseline** and compare runs using the same seed.

For an undisturbed successful run, simply launch the default scenario and let it finish. Arbitrary obstacle placement can strand the rover; the application reports this as failure rather than inventing a route.

## 5. Run tests

From the project root:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

The suite covers deterministic worlds, both strategies across three scenarios, hidden-map isolation, energy accounting, upload restrictions, full storage, obstacle replanning, stranding, API validation, WebSocket snapshots, and SQLite persistence.

`requirements-lock.txt` records the exact packages used for verification. `requirements.txt` provides broader compatible ranges for intentional dependency updates. A Starlette/httpx deprecation warning may appear in the test suite with the recorded versions; it does not indicate a failing test.

## 6. Project structure

```text
rover-mission-control/
  START_WINDOWS.bat          Windows convenience launcher
  README.md                 Setup and troubleshooting
  TECH_STACK.md             Architecture and simulation rules
  DEMO_GUIDE.md              Hackathon presentation walkthrough
  VALIDATION.md             Verification and known limitations
  .vscode/                  Debug configuration
  backend/
    app/
      main.py               REST API, WebSockets, simulation lifecycle
      models.py             Pydantic request validation
      simulation.py         World, sensors, planner, energy, metrics
      database.py           SQLite snapshots and event persistence
    tests/                  Simulation and API tests
    requirements.txt        Compatible dependency ranges
    requirements-lock.txt   Tested dependency versions
    data/                   Database created automatically on first run
  frontend/
    src/
      main.tsx              Dashboard and controls
      PlanetCanvas.tsx      Canvas map rendering and interaction
      api.ts                API client
      types.ts              Shared frontend data types
      styles.css            Responsive dashboard styling
    dist/                   Prebuilt dashboard (included)
    package.json
    package-lock.json       Reproducible frontend dependencies
    vite.config.ts          Development proxy and build configuration
```

## 7. Data and reset behavior

- The database is created automatically at `backend/data/missions.db`.
- Missions save after actions and ticks. The archive holds the latest 50 mission summaries; individual saved runs remain in the database.
- Generating a new mission archives the previous active mission.
- Restarting the backend preserves archives but does **not** resume a simulation from disk. Saved runs are read-only snapshots.
- Exports include configuration, the last state, metrics, initial world, and an ordered event log. The initial world is evaluator data; it is never provided to the live rover planner.
- There is one active mission per backend process. Use one server worker. Other browser tabs share that active mission.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `python` not found | Install Python, enable Add to PATH, and reopen VS Code. On Windows, `py -3.11 -m venv .venv` is another option if the Python launcher is installed. |
| Backend cannot connect | Start the backend first and verify http://127.0.0.1:8000/api/health. In development, both terminals must stay open. |
| `npm.ps1 cannot be loaded` | Use `npm.cmd` as shown above; no policy changes are required. |
| `No module named ...` | Run pip through `.venv\Scripts\python.exe` and install `requirements-lock.txt`. |
| Port 8000 already in use | Stop your previous server with Ctrl+C. For prebuilt mode you can instead use `--port 8001` and open that URL. Development mode also requires updating both proxy targets in `frontend/vite.config.ts`. |
| Page does not reflect frontend edits | Use development port 5173, or rebuild with `npm.cmd run build` and restart FastAPI. |
| No dashboard at `/` | Verify `frontend/dist/index.html` exists; rebuild the frontend if needed and restart FastAPI. |
| Obstacle rejected | Choose observed empty terrain. The rover, base, relays, science sites, unknown cells, and existing obstacles are protected. |
| Mission controls are disabled | Ended and archived runs are read-only. Generate a new mission or return to the active mission. |
| Slow simulation on large maps | Use 16 × 16 or 24 × 24 and 5 ticks/s. Requested speed is a target, not a real-time guarantee. |

**macOS/Linux:** create the virtual environment the same way, then replace `.venv\Scripts\python.exe` with `.venv/bin/python` and `npm.cmd` with `npm`. Windows is the verified platform.

## 9. Debugging in VS Code

Install the Python and Python Debugger extensions. Run **Python: Select Interpreter**, choose `backend/.venv/Scripts/python.exe`, then select **ORBIT: debug backend** in Run and Debug. Stop any other server using port 8000 before pressing F5.

Interactive API documentation is at **http://127.0.0.1:8000/docs** while the backend runs.
=======
# rover-mission-control
>>>>>>> d385ae85388cf915b1259041e8516706d395441d

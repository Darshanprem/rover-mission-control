import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Battery,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Database,
  Flag,
  Gauge,
  History,
  Home,
  Layers,
  Orbit,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  Route,
  Settings2,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Square,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { api } from "./api";
import { PlanetCanvas } from "./PlanetCanvas";
import type { Config, HistoryItem, Mission } from "./types";
import "./styles.css";

const initialConfig: Config = {
  seed: 42,
  size: 24,
  energy: 240,
  obstacle_density: 0.13,
  scenario: "discovery",
  strategy: "balanced",
};
const pretty = (text: string) => text.replaceAll("_", " ");
const finished = (m: Mission | null) =>
  !!m && ["completed", "failed", "archived"].includes(m.status);

function App() {
  const [mission, setMission] = React.useState<Mission | null>(null);
  const [activeId, setActiveId] = React.useState("");
  const [config, setConfig] = React.useState<Config>(initialConfig);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [connection, setConnection] = React.useState("Connecting");
  const [tab, setTab] = React.useState<"mission" | "history">("mission");
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [showPath, setShowPath] = React.useState(true);
  const [obstacleMode, setObstacleMode] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  const [inspected, setInspected] = React.useState([2, 2]);
  const archived = !!mission && mission.id !== activeId;

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const active = await api<Mission | null>("/active");
      const m = active || (await api<Mission>("/missions", initialConfig));
      setMission(m);
      setActiveId(m.id);
      setConfig(m.config);
    } catch (e) {
      setError(
        `Cannot connect to the backend. Start FastAPI on port 8000, then retry. ${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  };
  React.useEffect(() => {
    void load();
  }, []);
  React.useEffect(() => {
    if (!mission || archived) return;
    const id = mission.id;
    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/missions/${id}`,
      );
      socket.onopen = () => {
        if (!stopped) setConnection("Live telemetry");
      };
      socket.onmessage = (e) => {
        if (!stopped) setMission(JSON.parse(e.data));
      };
      socket.onclose = () => {
        if (!stopped) {
          setConnection("Reconnecting");
          reconnect = setTimeout(connect, 2000);
        }
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const polling = setInterval(() => {
      if (socket?.readyState !== WebSocket.OPEN)
        void api<Mission>(`/missions/${id}`)
          .then((m) => {
            if (!stopped) setMission(m);
          })
          .catch(() => {});
    }, 3000);
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      clearInterval(polling);
      socket?.close();
    };
  }, [mission?.id, archived]);

  const run = async (action: string, speed?: number) => {
    if (!mission) return;
    setBusy(true);
    setError("");
    try {
      setMission(
        await api<Mission>(`/missions/${mission.id}/commands`, {
          action,
          speed,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const m = await api<Mission>("/missions", config);
      setActiveId(m.id);
      setMission(m);
      setTab("mission");
      setInspected([2, 2]);
      setObstacleMode(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const block = async (x: number, y: number) => {
    if (!mission || archived) return;
    setBusy(true);
    setError("");
    try {
      setMission(
        await api<Mission>(`/missions/${mission.id}/obstacles`, { x, y }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openHistory = async () => {
    setTab("history");
    setError("");
    try {
      setHistory(await api<HistoryItem[]>("/missions"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const inspectHistory = async (id: string) => {
    setError("");
    try {
      setMission(await api<Mission>(`/missions/${id}`));
      setTab("mission");
      setObstacleMode(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const locked = busy || !mission || finished(mission) || archived;
  const selectedCell = mission?.known_cells.find(
    (c) => c.x === inspected[0] && c.y === inspected[1],
  );
  const battery = mission
    ? (mission.rover.energy / mission.rover.initial_energy) * 100
    : 100;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("mission");
          }}
        >
          <span className="brand-mark">
            <Orbit size={24} />
          </span>
          <span>
            ORBIT<span className="brand-sub">EXPLORATION SYSTEMS</span>
          </span>
        </a>
        <div className="workspace-tag">
          <span className="status-dot" /> MISSION WORKSPACE <span>01</span>
        </div>
        <div className="nav-label">OPERATIONS</div>
        <button
          className={`nav-item ${tab === "mission" ? "active" : ""}`}
          onClick={() => setTab("mission")}
        >
          <Compass size={18} /> Mission control <ChevronRight size={15} />
        </button>
        <button
          className={`nav-item ${tab === "history" ? "active" : ""}`}
          onClick={() => void openHistory()}
        >
          <History size={18} /> Mission archive{" "}
          <span className="nav-count">DB</span>
        </button>
        <div className="sidebar-separator" />
        <div className="nav-label">MISSION CONFIGURATION</div>
        <form
          className="config-form"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <label>
            Scenario
            <select
              value={config.scenario}
              onChange={(e) =>
                setConfig({
                  ...config,
                  scenario: e.target.value as Config["scenario"],
                })
              }
            >
              <option value="discovery">Open discovery</option>
              <option value="rough_terrain">Rough terrain</option>
              <option value="low_battery">Limited battery</option>
            </select>
          </label>
          <div className="field-pair">
            <label>
              World seed
              <input
                type="number"
                min={0}
                max={999999}
                required
                value={config.seed}
                onChange={(e) =>
                  setConfig({ ...config, seed: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Grid size
              <select
                value={config.size}
                onChange={(e) =>
                  setConfig({ ...config, size: Number(e.target.value) })
                }
              >
                <option value={16}>16 × 16</option>
                <option value={24}>24 × 24</option>
                <option value={32}>32 × 32</option>
              </select>
            </label>
          </div>
          <label>
            Starting energy{" "}
            <span className="field-value">
              {config.scenario === "low_battery"
                ? Math.min(config.energy, 85)
                : config.energy}{" "}
              EU
            </span>
            <input
              type="range"
              min={60}
              max={500}
              step={10}
              value={config.energy}
              onChange={(e) =>
                setConfig({ ...config, energy: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Obstacle density{" "}
            <span className="field-value">
              {Math.round(config.obstacle_density * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={0.3}
              step={0.01}
              value={config.obstacle_density}
              onChange={(e) =>
                setConfig({
                  ...config,
                  obstacle_density: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Planning strategy
            <select
              value={config.strategy}
              onChange={(e) =>
                setConfig({
                  ...config,
                  strategy: e.target.value as Config["strategy"],
                })
              }
            >
              <option value="balanced">Value-aware exploration</option>
              <option value="nearest">Nearest-target baseline</option>
            </select>
          </label>
          <button className="button generate" type="submit" disabled={busy}>
            <RefreshCw size={15} /> Generate new mission
          </button>
          <p className="config-note">
            Creates a fresh world and archives the current run. The seed makes
            your demo repeatable.
          </p>
        </form>
        <div className="sidebar-bottom">
          <div className="rover-avatar">
            <Rocket size={20} />
          </div>
          <div>
            <strong>PATHFINDER-01</strong>
            <span>Autonomous science rover</span>
          </div>
          <span className="status-dot" />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Operations <ChevronRight size={13} />{" "}
            <span>
              {tab === "mission" ? "Mission control" : "Mission archive"}
            </span>
          </div>
          <div className="topbar-right">
            <span
              className={`connection ${connection !== "Live telemetry" || archived ? "muted" : ""}`}
            >
              <span className="status-dot" />
              {archived ? "Archived snapshot" : connection}
            </span>
            <button
              className="icon-button"
              aria-label="How this simulation works"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <span className="version">v1.0</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">LOST IN SPACE / ROVER OPERATIONS</div>
              <h1>
                {tab === "mission"
                  ? "Every discovery counts."
                  : "The mission record."}
              </h1>
              <p>
                {tab === "mission"
                  ? "Explore the unknown. Secure the science. Bring your rover home."
                  : "Saved runs, measurable outcomes, and the story behind every decision."}
              </p>
            </div>
            <div className="planet-badge">
              <span className="planet-icon" />
              <div>
                KEPLER-186F
                <span>SIMULATED SECTOR · {mission?.config.seed ?? "—"}</span>
              </div>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <TriangleAlert size={18} />
              <span>{error}</span>
              {!mission && (
                <button onClick={() => void load()}>Retry connection</button>
              )}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {archived && tab === "mission" && (
            <div className="archive-banner">
              <History size={16} /> Viewing a saved snapshot. Archived missions
              are read-only.
              <button onClick={() => void inspectHistory(activeId)}>
                <ArrowLeft size={14} /> Back to active mission
              </button>
            </div>
          )}

          {tab === "history" ? (
            <section className="panel archive-panel">
              <div className="panel-heading">
                <div>
                  <Database size={17} />
                  <h2>Mission archive</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => void openHistory()}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>MISSION / SEED</th>
                      <th>SCENARIO</th>
                      <th>STATUS</th>
                      <th>SCIENCE</th>
                      <th>COVERAGE</th>
                      <th>RECOVERY</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <strong>#{h.id.slice(0, 6).toUpperCase()}</strong>
                          <small>
                            Seed {h.config.seed} ·{" "}
                            {new Date(h.created_at).toLocaleString()}
                          </small>
                        </td>
                        <td>
                          {pretty(h.config.scenario)}
                          <small>{pretty(h.config.strategy)}</small>
                        </td>
                        <td>
                          <span className={`state-label ${h.status}`}>
                            {h.status}
                          </span>
                        </td>
                        <td>{h.metrics.uploaded_value} pts</td>
                        <td>{h.metrics.coverage}%</td>
                        <td>
                          {h.metrics.returned_safely
                            ? "Safe return"
                            : h.status === "failed"
                              ? "Failed"
                              : "Pending"}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => void inspectHistory(h.id)}
                          >
                            View <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history.length === 0 && (
                  <div className="empty-state">
                    Your saved missions will appear here.
                  </div>
                )}
              </div>
            </section>
          ) : !mission ? (
            <section className="panel empty-state">
              <Orbit size={40} />
              <h2>Preparing mission control</h2>
              <p>Connecting to the local simulation engine…</p>
            </section>
          ) : (
            <>
              <div className="stat-grid">
                <Stat
                  label="ENERGY RESERVE"
                  icon={<Battery size={18} />}
                  value={mission.rover.energy.toFixed(1)}
                  unit="EU"
                  detail={`${battery.toFixed(0)}% of launch capacity`}
                >
                  <div className="mini-bar">
                    <span
                      style={{
                        width: `${battery}%`,
                        background: battery < 25 ? "#f3ae72" : "#8cdeb8",
                      }}
                    />
                  </div>
                </Stat>
                <Stat
                  label="SECURED SCIENCE"
                  icon={<Sparkles size={18} />}
                  value={String(mission.metrics.uploaded_value)}
                  unit="pts"
                  detail={`${mission.metrics.uploaded_packets} packets uploaded`}
                >
                  <span className="stat-chip">
                    {mission.metrics.carried_value} pts onboard
                  </span>
                </Stat>
                <Stat
                  label="WORLD OBSERVED"
                  icon={<Compass size={18} />}
                  value={String(mission.metrics.coverage)}
                  unit="%"
                  detail={`${mission.metrics.observed_cells} / ${mission.config.size ** 2} cells mapped`}
                >
                  <span className="stat-chip">
                    {mission.metrics.visited_cells} visited
                  </span>
                </Stat>
                <Stat
                  label="MISSION CLOCK"
                  icon={<Activity size={18} />}
                  value={String(mission.tick).padStart(3, "0")}
                  unit="ticks"
                  detail={`${mission.metrics.steps} moves executed`}
                >
                  <span className={`state-label ${mission.status}`}>
                    {mission.status}
                  </span>
                </Stat>
              </div>

              <div className="workspace-grid">
                <section className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <Layers size={17} />
                      <h2>Surface operations</h2>
                      <span className="small-tag">
                        {mission.config.size} × {mission.config.size}
                      </span>
                    </div>
                    <div className="map-actions">
                      <button
                        title="Toggle planned route"
                        aria-label="Toggle planned route"
                        aria-pressed={showPath}
                        className={`icon-button ${showPath ? "selected" : ""}`}
                        onClick={() => setShowPath(!showPath)}
                      >
                        <Route size={17} />
                      </button>
                      <button
                        title="Click empty observed terrain to add an obstacle"
                        aria-pressed={obstacleMode}
                        className={`obstacle-button ${obstacleMode ? "selected" : ""}`}
                        disabled={locked}
                        onClick={() => setObstacleMode(!obstacleMode)}
                      >
                        <TriangleAlert size={14} />
                        <span>Add obstacle</span>
                      </button>
                    </div>
                  </div>
                  <div className="map-caption">
                    <span>
                      <span className="status-dot" />{" "}
                      {obstacleMode
                        ? "OBSTACLE EDITOR · CLICK OBSERVED TERRAIN"
                        : "LOCAL SENSOR FEED · FOG OF WAR ENABLED"}
                    </span>
                    <span>
                      X {String(mission.rover.x).padStart(2, "0")} / Y{" "}
                      {String(mission.rover.y).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="map-stage">
                    <PlanetCanvas
                      mission={mission}
                      showPath={showPath}
                      obstacleMode={obstacleMode}
                      onCell={(_, x, y) => {
                        setInspected([x, y]);
                        if (obstacleMode && !locked) void block(x, y);
                      }}
                    />
                    <div className="map-compass">
                      N<span>↑</span>
                    </div>
                    <div className="map-scale">
                      SENSOR RANGE <strong>2 CELLS</strong>
                    </div>
                  </div>
                  <div className="map-legend">
                    <span>
                      <i className="legend-dot rover" />
                      Rover
                    </span>
                    <span>
                      <i className="legend-dot science" />
                      Science
                    </span>
                    <span>
                      <i className="legend-dot relay" />
                      Relay
                    </span>
                    <span>
                      <i className="legend-dot rough" />
                      Rough
                    </span>
                    <span>
                      <i className="legend-dot wall" />
                      Obstacle
                    </span>
                    <span>
                      <i className="legend-dot unknown" />
                      Unknown
                    </span>
                    <span>
                      <Home size={12} />
                      Base
                    </span>
                  </div>
                  <div className="playback">
                    <div className="playback-buttons">
                      <button
                        className="button primary"
                        disabled={locked}
                        onClick={() =>
                          void run(
                            mission.status === "running" ? "pause" : "start",
                          )
                        }
                      >
                        {mission.status === "running" ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}{" "}
                        {mission.status === "running"
                          ? "Pause"
                          : mission.status === "paused"
                            ? "Resume"
                            : "Launch"}
                      </button>
                      <button
                        className="button secondary compact"
                        disabled={locked}
                        onClick={() => void run("step")}
                        title="Advance one simulation tick"
                      >
                        <SkipForward size={16} />
                        <span>Step</span>
                      </button>
                      <button
                        className="button secondary compact"
                        disabled={locked}
                        onClick={() => void run("return")}
                        title="Return safely via a relay if feasible"
                      >
                        <Home size={16} />
                        <span>Return</span>
                      </button>
                    </div>
                    <label className="speed-control">
                      <Gauge size={15} />
                      <select
                        aria-label="Simulation speed"
                        disabled={locked}
                        value={mission.speed}
                        onChange={(e) =>
                          void run("speed", Number(e.target.value))
                        }
                      >
                        <option value={1}>1 tick/s</option>
                        <option value={5}>5 ticks/s</option>
                        <option value={10}>10 ticks/s</option>
                        <option value={20}>20 ticks/s</option>
                      </select>
                    </label>
                  </div>
                </section>

                <div className="right-column">
                  <section className="panel decision-panel">
                    <div className="panel-heading">
                      <div>
                        <Compass size={17} />
                        <h2>Autonomy feed</h2>
                      </div>
                      <span className="small-tag">
                        {mission.config.strategy === "balanced"
                          ? "VALUE-AWARE"
                          : "BASELINE"}
                      </span>
                    </div>
                    <div className="decision-content">
                      <div
                        className={`mode-icon ${mission.status === "failed" ? "danger" : ""}`}
                      >
                        {mission.status === "failed" ? (
                          <TriangleAlert size={23} />
                        ) : mission.status === "completed" ? (
                          <Flag size={23} />
                        ) : (
                          <Route size={23} />
                        )}
                      </div>
                      <div className="eyebrow">CURRENT OBJECTIVE</div>
                      <h3>{pretty(mission.rover.mode)}</h3>
                      <p>{mission.reason}</p>
                      <div className="decision-foot">
                        <span>
                          <ShieldCheck size={14} /> Return budget
                        </span>
                        <strong>
                          {mission.return_cost === null
                            ? "No route"
                            : `${mission.return_cost.toFixed(1)} EU`}
                        </strong>
                      </div>
                      <div className="decision-foot">
                        <span>Safety reserve</span>
                        <strong>{mission.rover.reserve} EU</strong>
                      </div>
                    </div>
                  </section>
                  <section className="panel cargo-panel">
                    <div className="panel-heading">
                      <div>
                        <Database size={17} />
                        <h2>Science payload</h2>
                      </div>
                      <span className="small-tag">
                        {mission.rover.cargo.length} / {mission.rover.capacity}
                      </span>
                    </div>
                    <div className="cargo-slots">
                      {Array.from(
                        { length: mission.rover.capacity },
                        (_, i) => (
                          <div
                            className={
                              mission.rover.cargo[i]
                                ? "cargo-slot full"
                                : "cargo-slot"
                            }
                            key={i}
                            title={
                              mission.rover.cargo[i]?.id ?? "Empty storage slot"
                            }
                          >
                            {mission.rover.cargo[i] ? (
                              <>
                                <Sparkles size={16} />
                                <span>{mission.rover.cargo[i].value}</span>
                              </>
                            ) : (
                              <Square size={16} />
                            )}
                          </div>
                        ),
                      )}
                    </div>
                    <p className="panel-note">
                      <Radio size={14} /> Upload is available only at relay
                      cells.
                    </p>
                  </section>
                  <section className="panel energy-panel">
                    <div className="panel-heading">
                      <div>
                        <Zap size={17} />
                        <h2>Energy profile</h2>
                      </div>
                      <span className="small-tag">EU / TICK</span>
                    </div>
                    <EnergyChart mission={mission} />
                    <div className="chart-foot">
                      <span>
                        {mission.metrics.energy_used.toFixed(1)} EU consumed
                      </span>
                      <strong>{mission.metrics.efficiency} pts / EU</strong>
                    </div>
                  </section>
                  <section className="panel inspector-panel">
                    <div className="panel-heading">
                      <div>
                        <Settings2 size={16} />
                        <h2>Cell inspector</h2>
                      </div>
                      <span className="small-tag">
                        {selectedCell ? "OBSERVED" : "UNKNOWN"}
                      </span>
                    </div>
                    <div className="inspect-controls">
                      <label>
                        X
                        <input
                          aria-label="Inspect X coordinate"
                          type="number"
                          min={0}
                          max={mission.config.size - 1}
                          value={inspected[0]}
                          onChange={(e) =>
                            setInspected([Number(e.target.value), inspected[1]])
                          }
                        />
                      </label>
                      <label>
                        Y
                        <input
                          aria-label="Inspect Y coordinate"
                          type="number"
                          min={0}
                          max={mission.config.size - 1}
                          value={inspected[1]}
                          onChange={(e) =>
                            setInspected([inspected[0], Number(e.target.value)])
                          }
                        />
                      </label>
                      <button
                        className="text-button"
                        disabled={locked}
                        onClick={() =>
                          void block(...(inspected as [number, number]))
                        }
                      >
                        Block cell
                      </button>
                    </div>
                    <p className="inspection-text">
                      {selectedCell
                        ? `${pretty(selectedCell.terrain)} terrain${selectedCell.comm ? " · communication relay" : ""}${selectedCell.site ? ` · ${selectedCell.site.id}: ${selectedCell.site.value} pts${selectedCell.site.collected ? " (collected)" : ""}` : ""}${selectedCell.visited ? " · visited" : ""}`
                        : "Outside sensor knowledge. Explore to reveal this cell."}
                    </p>
                  </section>
                </div>
              </div>

              {finished(mission) && (
                <section
                  className={`result-banner ${mission.status === "failed" ? "failure" : ""}`}
                >
                  <span className="result-icon">
                    {mission.metrics.success ? (
                      <Check size={24} />
                    ) : (
                      <Flag size={24} />
                    )}
                  </span>
                  <div>
                    <h3>
                      {mission.metrics.success
                        ? "Mission accomplished."
                        : mission.metrics.returned_safely
                          ? "Rover recovered. No science uploaded."
                          : "Mission ended."}
                    </h3>
                    <p>
                      {mission.metrics.failure_reason ||
                        `${mission.metrics.uploaded_value} science points secured · ${mission.metrics.coverage}% observed · ${mission.rover.energy.toFixed(1)} EU remaining`}
                    </p>
                  </div>
                  <a
                    className="button secondary"
                    href={`/api/missions/${mission.id}/export`}
                    download
                  >
                    <ArrowDownToLine size={16} /> Export report
                  </a>
                </section>
              )}

              <section className="panel event-panel">
                <div className="panel-heading">
                  <div>
                    <Activity size={17} />
                    <h2>Mission activity</h2>
                    <span className="small-tag">
                      {mission.metrics.replans} REPLANS
                    </span>
                  </div>
                  <a
                    className="text-button"
                    href={`/api/missions/${mission.id}/export`}
                    download
                  >
                    <ArrowDownToLine size={14} /> Export JSON
                  </a>
                </div>
                <div className="events">
                  {[...mission.events].reverse().map((event) => (
                    <div className={`event-row ${event.type}`} key={event.id}>
                      <span className="event-tick">
                        T+{String(event.tick).padStart(3, "0")}
                      </span>
                      <span className="event-dot" />
                      <span className="event-kind">{event.type}</span>
                      <span>{event.message}</span>
                    </div>
                  ))}
                </div>
              </section>
              <footer>
                <span>
                  <Orbit size={13} /> ORBIT EXPLORATION SYSTEMS
                </span>
                <span>
                  Simulation telemetry is visible to the operator. Science
                  uploads require a relay.
                </span>
                <span>LOCAL MISSION CONTROL</span>
              </footer>
            </>
          )}
        </div>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Simulation guide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-modal"
              aria-label="Close guide"
              autoFocus
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <Orbit size={36} />
            <div className="eyebrow">MISSION BRIEFING</div>
            <h2>Explore. Upload. Return.</h2>
            <p>
              The rover can only plan through observed terrain. Its radius-2
              sensor reveals the map as it moves. Green cells have been visited;
              dark cells are unknown.
            </p>
            <ol>
              <li>
                <strong>Launch</strong> to explore automatically, or use Step to
                follow each decision.
              </li>
              <li>
                <strong>Science diamonds</strong> hold data. The rover collects
                packets and uploads them at blue relay cells.
              </li>
              <li>
                <strong>Add obstacle</strong> changes observed empty terrain.
                Pause first for precise placement; the next tick replans.
              </li>
              <li>
                <strong>Return</strong> requests recovery. The planner also
                returns automatically when it cannot afford more exploration.
              </li>
            </ol>
            <p>
              Normal moves cost 1.4 EU including sensing; rough terrain costs
              3.4 EU. Collection costs 3 EU and upload costs 2 EU. A mission
              succeeds when science is uploaded and the rover returns with
              energy remaining.
            </p>
            <p className="muted-text">
              New obstacles may make recovery impossible. The simulator reports
              this honestly. Both strategies use the same safety rules;
              “nearest” changes target ranking only.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Ready for launch <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  icon,
  value,
  unit,
  detail,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  unit: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="stat-card">
      <div className="stat-title">
        {label}
        {icon}
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="stat-detail">{detail}</div>
      <div className="stat-bottom">{children}</div>
    </section>
  );
}
function EnergyChart({ mission }: { mission: Mission }) {
  const data = mission.energy_history;
  const last = Math.max(1, data.at(-1)?.tick ?? 1);
  const y = (energy: number) =>
    77 - (energy / mission.rover.initial_energy) * 62;
  const path = data
    .map(
      (p, i) => `${i ? "L" : "M"}${12 + (p.tick / last) * 276},${y(p.energy)}`,
    )
    .join(" ");
  return (
    <svg
      className="energy-chart"
      viewBox="0 0 300 96"
      role="img"
      aria-label={`Energy fell from ${mission.rover.initial_energy} to ${mission.rover.energy} EU across ${mission.tick} ticks`}
    >
      <defs>
        <linearGradient id="energy-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8bdfb9" stopOpacity=".22" />
          <stop offset="100%" stopColor="#8bdfb9" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[20, 48, 77].map((n) => (
        <line key={n} x1="12" x2="288" y1={n} y2={n} stroke="#ffffff09" />
      ))}
      <path
        d={`${path} L${12 + ((data.at(-1)?.tick ?? 0) / last) * 276},77 L12,77 Z`}
        fill="url(#energy-fill)"
      />
      <line
        x1="12"
        x2="288"
        y1={y(mission.rover.reserve)}
        y2={y(mission.rover.reserve)}
        stroke="#e3b16c66"
        strokeDasharray="3 4"
      />
      <path d={path} fill="none" stroke="#8bdfb9" strokeWidth="2" />
      <text x="12" y="94">
        T+0
      </text>
      <text x="288" y="94" textAnchor="end">
        T+{last}
      </text>
    </svg>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

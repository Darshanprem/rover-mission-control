export interface Config {
  seed: number;
  size: number;
  energy: number;
  obstacle_density: number;
  scenario: "discovery" | "rough_terrain" | "low_battery";
  strategy: "balanced" | "nearest";
}
export interface Cell {
  x: number;
  y: number;
  terrain: "plain" | "rough" | "wall";
  comm: boolean;
  site: { id: string; value: number; collected: boolean } | null;
  visited: boolean;
}
export interface Metrics {
  observed_cells: number;
  visited_cells: number;
  coverage: number;
  uploaded_value: number;
  uploaded_packets: number;
  carried_value: number;
  collected_packets: number;
  energy_used: number;
  efficiency: number;
  steps: number;
  replans: number;
  returned_safely: boolean;
  success: boolean;
  failure_reason: string | null;
}
export interface Mission {
  id: string;
  created_at: string;
  config: Config;
  status: string;
  tick: number;
  speed: number;
  base: number[];
  rover: {
    x: number;
    y: number;
    energy: number;
    initial_energy: number;
    reserve: number;
    mode: string;
    cargo: { id: string; value: number }[];
    capacity: number;
  };
  return_cost: number | null;
  known_cells: Cell[];
  path: number[][];
  target: number[] | null;
  reason: string;
  metrics: Metrics;
  events: { id: number; tick: number; type: string; message: string }[];
  energy_history: { tick: number; energy: number }[];
}
export type HistoryItem = Pick<
  Mission,
  "id" | "created_at" | "config" | "status" | "metrics"
>;

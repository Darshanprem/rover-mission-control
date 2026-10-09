import { useEffect, useRef, useState } from "react";
import type { Cell, Mission } from "./types";

interface Props {
  mission: Mission;
  showPath: boolean;
  obstacleMode: boolean;
  onCell: (cell: Cell | null, x: number, y: number) => void;
}
export function PlanetCanvas({
  mission,
  showPath,
  obstacleMode,
  onCell,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number[] | null>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = box.width * ratio;
      canvas.height = box.width * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      const size = mission.config.size;
      const unit = box.width / size;
      ctx.fillStyle = "#121d27";
      ctx.fillRect(0, 0, box.width, box.width);
      const cells = new Map(
        mission.known_cells.map((c) => [`${c.x},${c.y}`, c]),
      );
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const c = cells.get(`${x},${y}`);
          const left = x * unit;
          const top = y * unit;
          ctx.fillStyle = !c
            ? (x * 7 + y * 11) % 5 === 0
              ? "#17232e"
              : "#14212b"
            : c.terrain === "wall"
              ? "#46535d"
              : c.terrain === "rough"
                ? "#5b4940"
                : c.visited
                  ? "#294943"
                  : "#293943";
          ctx.fillRect(left + 1, top + 1, unit - 2, unit - 2);
          if (!c) {
            ctx.fillStyle = "#2b3943";
            ctx.fillRect(left + unit / 2, top + unit / 2, 1, 1);
            continue;
          }
          if (c.comm) {
            ctx.fillStyle = "#4b76b030";
            ctx.fillRect(left, top, unit, unit);
            ctx.strokeStyle = "#8cbbff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(
              left + unit / 2,
              top + unit / 2,
              unit * 0.3,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
            ctx.fillStyle = "#8cbbff";
            ctx.beginPath();
            ctx.arc(left + unit / 2, top + unit / 2, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (c.terrain === "wall") {
            ctx.fillStyle = "#73818b";
            ctx.beginPath();
            ctx.moveTo(left + unit * 0.22, top + unit * 0.72);
            ctx.lineTo(left + unit * 0.45, top + unit * 0.26);
            ctx.lineTo(left + unit * 0.77, top + unit * 0.72);
            ctx.fill();
          }
          if (c.terrain === "rough") {
            ctx.strokeStyle = "#ab846355";
            ctx.lineWidth = 1;
            for (let i = 1; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(left + 3, top + (unit * i) / 4);
              ctx.lineTo(left + unit - 3, top + (unit * i) / 4 - 3);
              ctx.stroke();
            }
          }
          if (c.site) {
            ctx.fillStyle = c.site.collected ? "#6b8478" : "#ffc76b";
            ctx.beginPath();
            ctx.moveTo(left + unit / 2, top + unit * 0.18);
            ctx.lineTo(left + unit * 0.78, top + unit / 2);
            ctx.lineTo(left + unit / 2, top + unit * 0.82);
            ctx.lineTo(left + unit * 0.22, top + unit / 2);
            ctx.closePath();
            if (c.site.collected) {
              ctx.strokeStyle = "#769687";
              ctx.stroke();
            } else ctx.fill();
          }
        }
      if (showPath && mission.path.length) {
        ctx.strokeStyle = "#7ee0c0";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(
          (mission.rover.x + 0.5) * unit,
          (mission.rover.y + 0.5) * unit,
        );
        mission.path.forEach(([x, y]) =>
          ctx.lineTo((x + 0.5) * unit, (y + 0.5) * unit),
        );
        ctx.stroke();
        ctx.setLineDash([]);
        const last = mission.path.at(-1)!;
        ctx.strokeStyle = "#a0ecd3";
        ctx.strokeRect(
          last[0] * unit + 3,
          last[1] * unit + 3,
          unit - 6,
          unit - 6,
        );
      }
      const [bx, by] = mission.base;
      ctx.fillStyle = "#dae7e6";
      ctx.fillRect(
        (bx + 0.23) * unit,
        (by + 0.25) * unit,
        unit * 0.54,
        unit * 0.5,
      );
      ctx.fillStyle = "#17222b";
      ctx.font = `bold ${unit * 0.43}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", (bx + 0.5) * unit, (by + 0.52) * unit);
      const rx = (mission.rover.x + 0.5) * unit;
      const ry = (mission.rover.y + 0.5) * unit;
      ctx.fillStyle = "#80e5be22";
      ctx.beginPath();
      ctx.arc(rx, ry, unit * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "#83ebbd";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#93f0c8";
      ctx.beginPath();
      ctx.arc(rx, ry, unit * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#103b2b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx - unit * 0.14, ry + unit * 0.05);
      ctx.lineTo(rx, ry - unit * 0.14);
      ctx.lineTo(rx + unit * 0.14, ry + unit * 0.05);
      ctx.stroke();
      if (hover) {
        ctx.strokeStyle = obstacleMode ? "#ff977d" : "#d3e4ef88";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          hover[0] * unit + 1,
          hover[1] * unit + 1,
          unit - 2,
          unit - 2,
        );
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mission, showPath, obstacleMode, hover]);
  const position = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.min(
        mission.config.size - 1,
        Math.floor(
          ((event.clientX - rect.left) / rect.width) * mission.config.size,
        ),
      ),
      Math.min(
        mission.config.size - 1,
        Math.floor(
          ((event.clientY - rect.top) / rect.height) * mission.config.size,
        ),
      ),
    ];
  };
  return (
    <canvas
      ref={ref}
      className={`planet-canvas ${obstacleMode ? "crosshair" : ""}`}
      role="img"
      aria-label={`Planet map. Rover at ${mission.rover.x}, ${mission.rover.y}. ${mission.metrics.coverage}% observed. Use the cell inspector below for keyboard terrain editing.`}
      onMouseMove={(e) => setHover(position(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const [x, y] = position(e);
        onCell(
          mission.known_cells.find((c) => c.x === x && c.y === y) || null,
          x,
          y,
        );
      }}
    />
  );
}

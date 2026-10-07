// F11: the same arteries, colours and selection as the 3D viewer, drawn flat in SVG for browsers
// without WebGL. It is the front view of the same paths, so the two can never disagree; the parts
// that run behind the heart are dashed.

import type { KeyboardEvent } from "react";
import { NO_ESTIMATE_COLOR } from "../config/risk";
import { VESSELS, type VesselId } from "../config/vessels";
import { ARTERY_PATHS, arteryPath } from "./arteryPaths";
import { frontOutline, isAnterior, type Vec3 } from "./heartShape";

const SCALE = 100;
const VIEW_BOX = "-185 -150 370 300"; // room on both sides for the labels
const STROKE = 9;
const HEART_FILL = "#e9e4df";
const LEFT_MAIN_COLOR = "#64748b";

const project = ([x, y]: Vec3 | [number, number]) => `${(x * SCALE).toFixed(1)},${(-y * SCALE).toFixed(1)}`;

/** SVG path data for a run of points. */
const line = (points: Vec3[]) => `M${points.map(project).join(" L")}`;

/** Splits a path into runs that are all in front of, or all behind, the heart. */
function runs(points: Vec3[]): { anterior: boolean; points: Vec3[] }[] {
  const result: { anterior: boolean; points: Vec3[] }[] = [];
  for (const point of points) {
    const anterior = isAnterior(point);
    const last = result[result.length - 1];
    if (last && last.anterior === anterior) {
      last.points.push(point);
    } else {
      // Start the new run at the previous point so the two runs join.
      result.push({ anterior, points: last ? [last.points[last.points.length - 1], point] : [point] });
    }
  }
  return result;
}

export interface SchematicVessel {
  id: VesselId;
  name: string; // accessible name, e.g. "LAD · Left Anterior Descending · 58%"
  label: string; // text drawn next to the artery, e.g. "LAD 58%"
  color: string | null; // risk colour, or null when there is no estimate
}

interface VesselSchematic2DProps {
  vessels: SchematicVessel[];
  selectedVessel: VesselId | null;
  hoveredVessel: VesselId | null;
  onSelectVessel: (id: VesselId) => void;
  onSelectHeart: () => void;
  onHoverVessel: (id: VesselId | null) => void;
}

export function VesselSchematic2D({
  vessels,
  selectedVessel,
  hoveredVessel,
  onSelectVessel,
  onSelectHeart,
  onHoverVessel,
}: VesselSchematic2DProps) {
  const leftMain = arteryPath("left_main");

  return (
    <svg
      viewBox={VIEW_BOX}
      role="group"
      aria-label="Heart schematic, front view, with the three coronary arteries"
      className="h-full w-full"
    >
      <polygon
        data-part="heart"
        points={frontOutline().map(project).join(" ")}
        fill={HEART_FILL}
        stroke="#cfc8c1"
        strokeWidth={1.5}
        onClick={onSelectHeart}
      />
      {leftMain && (
        <path d={line(leftMain.points)} fill="none" stroke={LEFT_MAIN_COLOR} strokeWidth={STROKE} strokeLinecap="round" />
      )}
      {VESSELS.map((config) => {
        const path = ARTERY_PATHS.find((candidate) => candidate.id === config.id);
        const vessel = vessels.find((candidate) => candidate.id === config.id);
        if (!path || !vessel) return null;
        const selected = selectedVessel === config.id;
        const emphasized = selected || hoveredVessel === config.id;
        const [labelX, labelY] = project(path.labelAnchors[0].point).split(",").map(Number);

        return (
          <g
            key={config.id}
            role="button"
            tabIndex={0}
            data-vessel={config.id}
            aria-label={vessel.name}
            aria-pressed={selected}
            onClick={() => onSelectVessel(config.id)}
            onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelectVessel(config.id);
            }}
            onMouseEnter={() => onHoverVessel(config.id)}
            onMouseLeave={() => onHoverVessel(null)}
            onFocus={() => onHoverVessel(config.id)}
            onBlur={() => onHoverVessel(null)}
            className="cursor-pointer outline-none [&:focus-visible_text]:underline"
          >
            {/* A wide transparent stroke makes the thin line easy to hit. */}
            <path d={line(path.points)} fill="none" stroke="transparent" strokeWidth={STROKE * 3} />
            {emphasized && (
              <path
                d={line(path.points)}
                fill="none"
                stroke={selected ? "#0f172a" : "#0369a1"}
                strokeWidth={STROKE + 5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {runs(path.points).map((run, index) => (
              <path
                key={index}
                data-run={run.anterior ? "front" : "behind"}
                d={line(run.points)}
                fill="none"
                stroke={vessel.color ?? NO_ESTIMATE_COLOR}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={run.anterior ? undefined : "3 9"}
              />
            ))}
            <text
              x={labelX + (labelX >= 0 ? 14 : -14)}
              y={labelY}
              textAnchor={labelX >= 0 ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-ink text-[11px] font-medium"
            >
              {vessel.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

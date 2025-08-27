import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, Plugin, Chart } from "chart.js";
import { Radar } from "react-chartjs-2";
import styles from "./index.module.css";
// @ts-ignore - plugin has no types bundled
import dragDataPlugin from "chartjs-plugin-dragdata";


// Plugin to draw rounded-corner polygon grid and axes for radar
const roundedRadarGrid: Plugin = {
  id: "roundedRadarGrid",
  beforeDatasetsDraw(chart: Chart, _args: any, _opts: any) {
    const scale: any = (chart as any).scales?.r;
    if (!scale) return;
    const labels: string[] = (chart.data.labels as string[]) ?? [];
    if (!labels.length) return;

    const opts: any = (chart.options as any)?.plugins?.roundedRadarGrid ?? {};
    const levels: number = opts.levels ?? 4;
    const cornerRadius: number = opts.cornerRadius ?? 12;
    const gridFill: string = opts.gridFill ?? "rgba(122, 133, 255, 0.77)";
    const axisColor: string = opts.axisColor ?? "#DADFF3";
    const gridLineColor: string = opts.gridLineColor ?? "#DADFF3";

    const { ctx } = chart as any;
    const cx = scale.xCenter;
    const cy = scale.yCenter;
    const minV: number = typeof scale.min === "number" ? scale.min : 0;
    const maxV: number = typeof scale.max === "number" ? scale.max : 1;
    const moveTowards = (from: { x: number; y: number }, to: { x: number; y: number }, dist: number) => {
      const dx = to.x - from.x; const dy = to.y - from.y; const len = Math.hypot(dx, dy) || 1;
      return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
    };

    ctx.save();
    ctx.lineWidth = 1;
    // draw rounded polygons for grid levels (filled) UNDER axes
    for (let lvl = 1; lvl <= levels; lvl++) {
      const v = minV + ((maxV - minV) * lvl) / levels;
      const vertices = labels.map((_, i) => scale.getPointPositionForValue(i, v));
      const n = vertices.length;
      if (n < 3) continue;

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const prev = vertices[(i - 1 + n) % n];
        const curr = vertices[i];
        const next = vertices[(i + 1) % n];
        const d1 = Math.min(cornerRadius, Math.hypot(curr.x - prev.x, curr.y - prev.y) / 2);
        const d2 = Math.min(cornerRadius, Math.hypot(next.x - curr.x, next.y - curr.y) / 2);
        const p1 = moveTowards(curr, prev, d1);
        const p2 = moveTowards(curr, next, d2);
        if (i === 0) ctx.moveTo(p1.x, p1.y); else ctx.lineTo(p1.x, p1.y);
        ctx.arcTo(curr.x, curr.y, p2.x, p2.y, cornerRadius);
      }
      ctx.closePath();
      // fill only the outermost level to keep single background
      if (lvl === levels) {
        ctx.fillStyle = gridFill;
        ctx.fill();
      }
      // stroke inner levels only (hide outer contour)
      if (lvl < levels) {
        ctx.strokeStyle = gridLineColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // draw axes OVER background/fill
    ctx.strokeStyle = axisColor;
    for (let i = 0; i < labels.length; i++) {
      const p = scale.getPointPositionForValue(i, maxV);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    ctx.restore();
  },
};

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, roundedRadarGrid, dragDataPlugin);

type Series = {
  name: string;
  data: number[];
  color: string;
  draggable?: boolean;
};

export interface RadarChartProps {
  labels: string[];
  series: Series[];
  size?: number;
  labelMaxCharsPerLine?: number;
  pointsOnly?: boolean;
}

const wrapLabel = (label: string, maxChars: number): string[] => {
  const words = String(label).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [label];
};

const RadarChart: React.FC<RadarChartProps> = ({ labels, series, size = 420, labelMaxCharsPerLine = 20, pointsOnly = false }) => {
  const data = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.name,
      data: s.data,
      // Fill only for user (draggable) dataset, keep AI without fill
      backgroundColor: s.draggable ? (s.color + "22") : "rgba(0,0,0,0)",
      borderColor: "rgba(0,0,0,0)",
      borderWidth: 0,
      // points
      pointBackgroundColor: s.draggable ? s.color : s.color,
      pointBorderColor: s.draggable ? s.color : s.color,
      pointBorderWidth: s.draggable ? 1 : 0,
      pointStyle: s.draggable ? "circle" : (pointsOnly && i === 0 ? "rectRounded" : "circle"),
      pointRadius: s.draggable ? 0 : (pointsOnly && i === 0 ? 6 : 0),
      pointHoverRadius: s.draggable ? 0 : (pointsOnly && i === 0 ? 7 : 0),
      hitRadius: s.draggable ? 10 : (pointsOnly && i === 0 ? 12 : 0),
    } as any)),
  };

  const options: any = {
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
      // chartjs-plugin-dragdata configuration: enable dragging & snap to nearest 1..4
      dragData: {
        round: 0,
        magnet: (v: number) => {
          const snapped = Math.round(v);
          if (snapped < 1) return 1;
          if (snapped > 4) return 4;
          return snapped;
        },
        // allow dragging only for datasets explicitly marked as draggable
        onDragStart: function (this: any, _e: any, datasetIndex: number) {
          const ds = series?.[datasetIndex];
          return !!ds?.draggable;
        }
      } as any,
      // plugin config
      roundedRadarGrid: {
        levels: 4,
        cornerRadius: 20,
        gridFill: "rgba(228, 230, 247, 0.5)",
        axisColor: "rgba(47, 35, 84, 0.2)",
        gridLineColor: "rgba(47, 35, 84, 0.2)",
      },
    },
    scales: {
      r: {
        min: 0,
        max: 4,
        ticks: {
          display: false,
        },
        grid: {
          // hide default grid (we draw custom rounded grid)
          color: "transparent",
        },
        angleLines: {
          // hide default spokes (we draw custom axes)
          color: "transparent",
        },
        pointLabels: {
          color: "#656C94",
          font: { size: 12, family: "Onest", weight: "100" },
          callback: (label: any) => wrapLabel(String(label), labelMaxCharsPerLine),
        },
      },
    },
    elements: {
      line: {
        tension: 0.2,
      },
    },
  };

  return (
    <div className={styles.container} style={{ height: size, width: "100%" }}>
      <Radar data={data} options={options} />
    </div>
  );
};

export default RadarChart;



import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, Plugin, Chart } from "chart.js";
import { Radar } from "react-chartjs-2";
import styles from "./index.module.css";

// Plugin to draw rounded-corner polygon grid and axes for radar
const roundedRadarGrid: Plugin<'radar'> = {
  id: "roundedRadarGrid",
  beforeDatasetsDraw(chart: Chart) {
    const scale: any = (chart as any).scales?.r;
    if (!scale) return;
    const labels: string[] = (chart.data.labels as string[]) ?? [];
    if (!labels.length) return;

    const opts: any = (chart.options as any)?.plugins?.roundedRadarGrid ?? {};
    const levels: number = opts.levels ?? 4;
    const cornerRadius: number = opts.cornerRadius ?? 16;
    const gridFill: string = opts.gridFill ?? "rgba(122, 134, 255, 0.12)";
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
    ctx.strokeStyle = axisColor;

    // draw axes strictly using scale positions
    for (let i = 0; i < labels.length; i++) {
      const p = scale.getPointPositionForValue(i, maxV);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // draw rounded polygons for grid levels (filled)
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
      // stroke every level to show grid lines
      ctx.strokeStyle = gridLineColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  },
};

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, roundedRadarGrid);

type Series = {
  name: string;
  data: number[];
  color: string;
};

export interface RadarChartProps {
  labels: string[];
  series: Series[];
  maxValue?: number;
  size?: number;
  labelMaxCharsPerLine?: number;
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

const RadarChart: React.FC<RadarChartProps> = ({ labels, series, maxValue = 5, size = 420, labelMaxCharsPerLine = 20 }) => {
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.name,
      data: s.data,
      backgroundColor: s.color + "33", // ~20% opacity
      borderColor: s.color,
      borderWidth: 1,
      pointBackgroundColor: s.color,
      pointRadius: 0,
    })),
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
      // plugin config
      roundedRadarGrid: {
        levels: 3,
        cornerRadius: 12,
        gridFill: "rgba(122, 134, 255, 0.12)",
        axisColor: "#DADFF3",
      },
    },
    scales: {
      r: {
        min: 0,
        max: maxValue,
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
        tension: 0.05,
      },
    },
  };

  return (
    <div className={styles.container} style={{ height: size }}>
      <Radar data={data} options={options} />
    </div>
  );
};

export default RadarChart;



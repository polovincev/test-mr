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

// Node hover tooltip plugin: shows info for any grid node (axis x integer level)
const nodeHoverTooltip: Plugin = {
  id: "nodeHoverTooltip",
  afterInit(chart: any) {
    const parent: HTMLElement = chart.canvas.parentNode as HTMLElement;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.pointerEvents = "none";
    el.style.transform = "translate(5%, -101%)";
    // Card styles (mimic level cards)
    el.style.background = "#FFFFFF";
    el.style.border = "none";
    el.style.borderRadius = "16px";
    el.style.boxShadow = "0px 2px 8px 0px #0000000F, -2px 0px 16px 0px #0000000F";
    el.style.padding = "14px 8px";
    el.style.maxWidth = "180px";
    el.style.fontFamily = "Onest";
    el.style.fontSize = "12px";
    el.style.color = "#2F2354";
    el.style.zIndex = "10";
    el.style.opacity = "0";
    chart._nodeTooltip = el;
    parent.appendChild(el);
  },
  afterEvent(chart: any, args: any) {
    const scale = chart.scales?.r;
    const canvas: HTMLCanvasElement | undefined = chart?.canvas;
    const el: HTMLDivElement | undefined = chart._nodeTooltip;
    if (!scale || !canvas || !el) return;
    const type: string = args.event?.type || "";
    const x: number = args.event?.x;
    const y: number = args.event?.y;
    if (type === "mouseout") {
      el.style.opacity = "0";
      return;
    }
    if (type !== "mousemove" && type !== "pointermove") return;

    const labels: string[] = (chart.data.labels as string[]) ?? [];
    if (!labels.length) return;
    const minV: number = typeof scale.min === "number" ? scale.min : 0;
    const maxV: number = typeof scale.max === "number" ? scale.max : 4;
    const intMin = Math.ceil(minV);
    const intMax = Math.floor(maxV);
    const nodes: { axis: number; level: number; px: number; py: number }[] = [];
    for (let axis = 0; axis < labels.length; axis++) {
      for (let v = intMin; v <= intMax; v++) {
        const p = scale.getPointPositionForValue(axis, v);
        nodes.push({ axis, level: v, px: p.x, py: p.y });
      }
    }
    let best = { idx: -1, d: Infinity };
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.hypot(nodes[i].px - x, nodes[i].py - y);
      if (d < best.d) best = { idx: i, d };
    }
    if (best.idx < 0 || best.d > 18) {
      el.style.opacity = "0";
      return;
    }
    const node = nodes[best.idx];
    // Retrieve info from the first dataset that provides nodeInfo
    let html = "";
    const datasets: any[] = chart.data.datasets || [];
    let info: any = undefined;
    for (const ds of datasets) {
      if (ds?.nodeInfo && Array.isArray(ds.nodeInfo)) {
        const arr = ds.nodeInfo as any[];
        const byLevel = arr[node.level];
        if (Array.isArray(byLevel)) {
          info = byLevel[node.axis];
          break;
        }
      }
    }
    const label = labels[node.axis] ?? "";
    // Skip tooltip when title is explicitly marked as unknown
    if (typeof info === "string") {
      if (!info || info.trim() === "") { el.style.opacity = "0"; return; }
    } else if (info) {
      const t = (info.title ?? "").trim().toLowerCase();
      if (!t || t === "неизвестно") { el.style.opacity = "0"; return; }
    } else {
      el.style.opacity = "0"; return;
    }
    // Styles are set on the container in afterInit to match level cards.
    const titleStyle = "font-family:Onest;font-size:14px;font-weight:600;color:#000000;";
    const metaStyle = "font-family:Onest;font-size:12px;color:#656C94;margin-top:4px;font-weight:200;";
    const textStyle = "margin-top:10px;color:#161A33;font-size:12px;line-height:1.2;font-weight:200;font-family:Onest;";
    if (typeof info === "string") {
      const t = `${label} — уровень ${node.level}`;
      html = `<div><div style=\"${titleStyle}\">${t}</div><div style=\"${textStyle}\">${info}</div></div>`;
    } else if (info && (info.title || info.text || info.meta)) {
      const title = info.title || `${label} — уровень ${node.level}`;
      const meta = info.meta ? `<div style=\"${metaStyle}\">${info.meta}</div>` : "";
      const text = info.text ? `<div style=\"${textStyle}\">${info.text}</div>` : "";
      html = `<div><div style=\"${titleStyle}\">${title}</div>${meta}${text}</div>`;
    } else {
      const t = `${label} — уровень ${node.level}`;
      html = `<div><div style=\"${titleStyle}\">${t}</div></div>`;
    }
    el.innerHTML = html;
    const rect = chart.canvas.getBoundingClientRect();
    el.style.left = `${rect.left + window.scrollX + node.px}px`;
    el.style.top = `${rect.top + window.scrollY + node.py}px`;
    el.style.opacity = "1";
  },
};

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, roundedRadarGrid, dragDataPlugin, nodeHoverTooltip);

type Series = {
  name: string;
  data: number[];
  color: string;
  draggable?: boolean;
  nodeInfo?: Array<Array<string | { title?: string; meta?: string; text?: string }>>;
};

export interface RadarChartProps {
  labels: string[];
  series: Series[];
  size?: number;
  labelMaxCharsPerLine?: number;
  pointsOnly?: boolean;
  onChange?: (datasetIndex: number, data: number[]) => void;
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

const RadarChart: React.FC<RadarChartProps> = ({ labels, series, size = 420, labelMaxCharsPerLine = 20, pointsOnly = false, onChange }) => {
  const data = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.name,
      data: s.data,
      // custom per-series node info for nodeHoverTooltip plugin
      nodeInfo: s.nodeInfo,
      // Fill only for user (draggable) dataset, keep AI without fill
      backgroundColor: s.draggable ? (s.color + "22") : "rgba(0,0,0,0)",
      // Outline the area for draggable dataset (same color as fill)
      borderColor: s.draggable ? (s.color + "22") : "rgba(0,0,0,0)",
      borderWidth: s.draggable ? 4 : 0,
      // points
      pointBackgroundColor: s.draggable ? "#FFFFFF" : s.color,
      pointBorderColor: s.draggable ? s.color : s.color,
      pointBorderWidth: s.draggable ? 0 : 0,
      pointStyle: s.draggable ? "circle" : (pointsOnly && i === 0 ? "rectRounded" : "circle"),
      pointRadius: s.draggable ? 0 : (pointsOnly && i === 0 ? 6 : 0),
      pointHoverRadius: s.draggable ? 0 : (pointsOnly && i === 0 ? 7 : 0),
      hitRadius: s.draggable ? 12 : (pointsOnly && i === 0 ? 12 : 0),
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
        enabled: false,
      },
      // chartjs-plugin-dragdata configuration: enable dragging & snap to nearest 1..4
      dragData: {
        round: 0,
        magnet: (v: number) => {
          const snapped = Math.round(v);
          if (snapped < 1) return 0.1;
          if (snapped > 4) return 4;
          return snapped;
        },
        // allow dragging only for datasets explicitly marked as draggable
        onDragStart: function (this: any, _e: any, datasetIndex: number) {
          const ds = series?.[datasetIndex];
          return !!ds?.draggable;
        },
        onDragEnd: function (this: any, _e: any, datasetIndex: number) {
          try {
            if (!onChange) return;
            const ds = series?.[datasetIndex];
            if (!ds) return;
            const arr = Array.from(ds.data as any).map((x: any) => Number(x));
            onChange(datasetIndex, arr);
          } catch { }
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



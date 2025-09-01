import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { metaExpand, updateGoalLevels } from "../../services/api";
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, Connection, Edge, Node, Handle, Position, NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import styles from "./index.module.css";
import LoaderOverlay from "../../components/LoaderOverlay";

type TopicNodeData = {
  title: string;
  imageUrl?: string;
  handleSide?: "left" | "right";
  levelCounts?: { total: number; l2: number; l3: number; l4: number };
  goalLevel?: number; // 2|3|4 when selected, otherwise undefined
  onOpen?: () => void;
  noImage?: boolean;
  onSetLevel?: (level: 2 | 3 | 4) => void;
};

const TopicNode: React.FC<NodeProps<TopicNodeData>> = ({ data }) => {
  const title = data?.title || "Тема";
  const imageUrl = data?.imageUrl; // for expansion nodes we intentionally omit image
  const side: "left" | "right" = data?.handleSide || "left";
  const positionForHandles = side === "left" ? Position.Left : Position.Right;

  const formatTasksCount = (n: number): string => {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs >= 11 && abs <= 14) return `${n} заданий`;
    if (last === 1) return `${n} задание`;
    if (last >= 2 && last <= 4) return `${n} задания`;
    return `${n} заданий`;
  };

  return (
    <>
      <div className={`${styles.topicNode} ${data?.noImage ? styles.topicNodeCompact : ""}`} onClick={(e) => {
        e.stopPropagation();
        try { data?.onOpen && data.onOpen(); } catch { /* ignore */ }
      }}>
        {!data?.noImage && imageUrl && <img src={imageUrl} alt="" className={styles.topicImage} />}
        <div className={styles.topicContent}>
          <div className={styles.topicBadge}>Тема</div>
          <div className={data?.noImage ? styles.topicTitleSmall : styles.topicTitle}>{title}</div>
        </div>
        {data?.noImage ? (
          <>
            <Handle type="target" position={Position.Left} id="left" className={styles.handleInvisible} />
            <Handle type="source" position={Position.Left} id="left" className={styles.handleInvisible} />
            <Handle type="target" position={Position.Right} id="right" className={styles.handleInvisible} />
            <Handle type="source" position={Position.Right} id="right" className={styles.handleInvisible} />
            <Handle type="target" position={Position.Top} id="top" className={styles.handleInvisible} />
            <Handle type="source" position={Position.Top} id="top" className={styles.handleInvisible} />
            <Handle type="target" position={Position.Bottom} id="bottom" className={styles.handleInvisible} />
            <Handle type="source" position={Position.Bottom} id="bottom" className={styles.handleInvisible} />
          </>
        ) : (
          <>
            <Handle type="target" position={positionForHandles} className={styles.handleInvisible} />
            <Handle type="source" position={positionForHandles} className={styles.handleInvisible} />
          </>
        )}
      </div>
      {data?.levelCounts && !data?.noImage && (
        <div
          className={styles.nodeTasksBox}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <div className={styles.nodeTasksHeader}>Задания <span className={styles.nodeTasksNum}>{data.levelCounts.total}</span></div>
          <div className={styles.nodeChipRow}>
            <div className={`${styles.nodeChip} ${data?.goalLevel === 2 ? styles.nodeChipActive : ""}`} onClick={(e) => { e.stopPropagation(); try { data?.onSetLevel && data.onSetLevel(2); } catch {} }}>
              <div className={styles.nodeChipTitle}>⭐</div>
              <div className={styles.nodeChipCount}>{formatTasksCount(data.levelCounts.l2)}</div>
            </div>
            <div className={`${styles.nodeChip} ${data?.goalLevel === 3 ? styles.nodeChipActive : ""}`} onClick={(e) => { e.stopPropagation(); try { data?.onSetLevel && data.onSetLevel(3); } catch {} }}>
              <div className={styles.nodeChipTitle}>⭐⭐</div>
              <div className={styles.nodeChipCount}>{formatTasksCount(data.levelCounts.l3)}</div>
            </div>
            <div className={`${styles.nodeChip} ${data?.goalLevel === 4 ? styles.nodeChipActive : ""}`} onClick={(e) => { e.stopPropagation(); try { data?.onSetLevel && data.onSetLevel(4); } catch {} }}>
              <div className={styles.nodeChipTitle}>⭐⭐⭐</div>
              <div className={styles.nodeChipCount}>{formatTasksCount(data.levelCounts.l4)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const wrapperStyle: React.CSSProperties = { width: "100vw", height: "calc(100vh - 0px)" };

const My: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const trajectory = (location.state as any)?.trajectory as { items?: { title: string; image_url?: string; skills?: { levels?: { level: number; tasks?: { title: string }[] }[]; name?: string; goal_level?: number } }[]; goal?: string } | undefined;
  const search = new URLSearchParams(location.search);
  const chatIdParam = search.get("chat_id");
  const chatId = chatIdParam ? Number(chatIdParam) : (location.state as any)?.chatId ? Number((location.state as any)?.chatId) : undefined;
  const [expansions, setExpansions] = useState<Record<string, string[]>>({});
  const [loadingExpansions, setLoadingExpansions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [levelOpen, setLevelOpen] = useState(false);
  const [level, setLevel] = useState<"all" | 2 | 3 | 4>("all");
  const levelRef = useRef<HTMLDivElement | null>(null);
  const rfRef = useRef<any>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!levelRef.current) return;
      if (!levelRef.current.contains(e.target as HTMLElement)) setLevelOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        if (typeof chatId === "number") {
          if (!ignore) setLoadingExpansions(true);
          const resp = await metaExpand(chatId);
          const map: Record<string, string[]> = {};
          (resp.items || []).forEach((it) => { map[it.title] = it.expansions || []; });
          if (!ignore) setExpansions(map);
        }
      } catch { /* ignore */ }
      finally {
        if (!ignore) setLoadingExpansions(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [chatId]);

  // Force layout/resize and fit graph on initial mount
  useEffect(() => {
    try { window.dispatchEvent(new Event("resize")); } catch { /* ignore */ }
    const id1 = window.setTimeout(() => {
      try { rfRef.current && rfRef.current.fitView({ padding: 0.2, includeHiddenNodes: true } as any); } catch { /* ignore */ }
    }, 0);
    // second tick for images/fonts
    const id2 = window.setTimeout(() => {
      try { rfRef.current && rfRef.current.fitView({ padding: 0.2, includeHiddenNodes: true } as any); } catch { /* ignore */ }
    }, 200);
    return () => { window.clearTimeout(id1); window.clearTimeout(id2); };
  }, []);

  const nodeTypes = useMemo(() => ({ topic: TopicNode }), []);

  const defaultEdgeOptions = useMemo(() => ({
    type: "bezier",
    style: { stroke: "#37C5F0", strokeWidth: 3 },
  }), []);

  const computedNodes: Node<TopicNodeData>[] = useMemo(() => {
    const items = Array.isArray(trajectory?.items) && trajectory?.items?.length
      ? (trajectory?.items as any[]).map((it) => {
        const levels = (it?.skills?.levels || []) as any[];
        const counts = { total: 0, l2: 0, l3: 0, l4: 0 };
        for (const li of levels) {
          const c = Array.isArray(li?.tasks) ? li.tasks.length : 0;
          if (li?.level === 2) counts.l2 += c;
          if (li?.level === 3) counts.l3 += c;
          if (li?.level === 4) counts.l4 += c;
          counts.total += c;
        }
        const glRaw = Number(it?.skills?.goal_level);
        const goalLevel = !isNaN(glRaw) && glRaw > 1 ? Math.max(2, Math.min(4, Math.round(glRaw))) : undefined;
        return { title: String(it?.title || "Тема"), imageUrl: it?.image_url as string | undefined, levelCounts: counts, goalLevel, onOpen: () => setSelectedIdx(trajectory?.items?.indexOf(it) || 0) };
      })
      : [
        { title: "Наследственность и изменчивость организмов", imageUrl: new URL("../../icon/goal.png", import.meta.url).href, levelCounts: { total: 10, l2: 7, l3: 2, l4: 1 }, goalLevel: undefined, onOpen: () => setSelectedIdx(0) },
        { title: "Молекулярные основы жизни", imageUrl: new URL("../../icon/profile.png", import.meta.url).href, levelCounts: { total: 6, l2: 2, l3: 3, l4: 1 }, goalLevel: 3, onOpen: () => setSelectedIdx(1) },
        { title: "Эволюционное учение", imageUrl: new URL("../../icon/profile.png", import.meta.url).href, levelCounts: { total: 5, l2: 1, l3: 2, l4: 2 }, goalLevel: 4, onOpen: () => setSelectedIdx(2) },
        { title: "Экосистемы и биосфера", imageUrl: new URL("../../icon/profile.png", import.meta.url).href, levelCounts: { total: 4, l2: 1, l3: 2, l4: 1 }, goalLevel: 2, onOpen: () => setSelectedIdx(3) },
      ];
    const nodes: Node<TopicNodeData>[] = [];
    const leftX = 100;
    const rightX = 900;
    const startY = 40;
    const stepY = 160;
    items.forEach((t, i) => {
      const isLeft = i % 2 === 0;
      const x = isLeft ? leftX : rightX;
      const y = startY + i * (stepY / 1);
      nodes.push({
        id: String(i + 1),
        type: "topic",
        position: { x, y },
        data: {
          title: t.title,
          imageUrl: t.imageUrl || new URL("../../icon/profile.png", import.meta.url).href,
          handleSide: isLeft ? "right" : "left",
          levelCounts: (t as any).levelCounts,
          goalLevel: (t as any).goalLevel,
          onOpen: () => setSelectedIdx(i),
          onSetLevel: (lvl: 2 | 3 | 4) => {
            try {
              const newLevel = Math.max(2, Math.min(4, Number(lvl)));
              // Update the real trajectory object in router state if provided
              try {
                const idx = i;
                const tr: any = (trajectory as any);
                if (tr && Array.isArray(tr.items) && tr.items[idx]) {
                  tr.items[idx].skills = { ...(tr.items[idx].skills || {}), goal_level: newLevel };
                }
              } catch { }
              // Trigger UI update by updating expansions state (no-op mutate)
              setExpansions((prev) => ({ ...prev }));
              // Persist to backend
              if (typeof chatId === 'number') {
                try {
                  const levels = (trajectory?.items || []).map((it, k) => (k === i ? newLevel : Math.round(Number(it?.skills?.goal_level || 0.1)) || 0.1));
                  updateGoalLevels(chatId, levels as any).catch(() => void 0);
                } catch { }
              }
            } catch { }
          },
        },
      });

      // expansion children below the parent node if any
      const exps = expansions[t.title] || [];
      exps.forEach((title, idx) => {
        const id = `${i + 1}-e${idx + 1}`;
        const exX = x + (isLeft ? -280 : 500);
        const exY = y + 40 + idx * 84;
        nodes.push({
          id,
          type: "topic",
          position: { x: exX, y: exY },
          data: {
            title,
            handleSide: isLeft ? "right" : "left",
            levelCounts: { total: 0, l2: 0, l3: 0, l4: 0 },
            goalLevel: undefined,
            onOpen: () => void 0,
            noImage: true,
          },
        });
      });
    });
    return nodes;
  }, [trajectory, expansions]);

  const computedEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    const n = computedNodes.length;
    for (let i = 0; i < n - 1; i++) {
      edges.push({ id: `e${i + 1}-${i + 2}`, source: String(i + 1), target: String(i + 2), type: "bezier" });
    }
    // connect expansions to their parents
    computedNodes.forEach((node) => {
      if (node.id.includes("-e")) {
        const parentId = node.id.split("-e")[0];
        const parent = computedNodes.find((n) => n.id === parentId);
        const child = node;
        if (parent) {
          const dx = child.position.x - parent.position.x;
          const dy = child.position.y - parent.position.y;
          const useHorizontal = Math.abs(dx) >= Math.abs(dy);
          const sourceHandle = useHorizontal
            ? (dx >= 0 ? "right" : "left")
            : (dy >= 0 ? "bottom" : "top");
          const targetHandle = useHorizontal
            ? (dx >= 0 ? "left" : "right")
            : (dy >= 0 ? "top" : "bottom");
          edges.push({
            id: `p${parentId}-${node.id}`,
            source: parentId,
            target: node.id,
            sourceHandle,
            targetHandle,
            type: "straight",
            style: { strokeDasharray: "6 4", stroke: "#37C5F0", strokeWidth: 2 },
          } as any);
        }
      }
    });
    return edges;
  }, [computedNodes]);

  const taskSummary = useMemo(() => {
    const result = { total: 0, l2: 0, l3: 0, l4: 0 };
    const items = trajectory?.items || [];
    for (const it of items) {
      const levels = it?.skills?.levels || [];
      for (const li of levels) {
        const count = Array.isArray(li?.tasks) ? li.tasks.length : 0;
        if (li.level === 2) { result.l2 += count; }
        if (li.level === 3) { result.l3 += count; }
        if (li.level === 4) { result.l4 += count; }
        result.total += count;
      }
    }
    return result;
  }, [trajectory]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  // Keep state in sync when computed graph changes (e.g., after meta_expand loads)
  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes, setNodes]);

  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

  // Fit viewport to show the whole map on mount and after graph changes
  useEffect(() => {
    if (rfRef.current) {
      try { rfRef.current.fitView({ padding: 0.2, duration: 400, includeHiddenNodes: true } as any); } catch { /* ignore */ }
    }
  }, [computedNodes.length, computedEdges.length, loadingExpansions]);

  // Defer fitView until after nodes/edges are rendered to DOM
  useEffect(() => {
    if (!rfRef.current) return;
    const id = window.setTimeout(() => {
      try { rfRef.current?.fitView({ padding: 0.2, duration: 300, includeHiddenNodes: true } as any); } catch { /* ignore */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, [nodes.length, edges.length, loadingExpansions]);

  const selectedItem = selectedIdx !== null ? trajectory?.items?.[selectedIdx] : undefined;

  if (loadingExpansions) {
    return <LoaderOverlay text="Загружаю расширения…" />;
  }

  return (
    <>
      <div className={styles.wrapper}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          ← Назад
        </button>
        {trajectory?.goal && (
          <div className={styles.goalBlock}>
            <div className={styles.goalText}>{trajectory.goal}</div>
          </div>
        )}
        <div className={styles.levelFilterWrap} ref={levelRef}>
          <button className={styles.levelFilterBtn} onClick={() => setLevelOpen(v => !v)}>
            <span className={styles.levelFilterLabel}>Уровень: </span>
            <span className={styles.levelFilterValue}>{level === "all" ? "Все" : level === 2 ? "⭐ Базовый" : level === 3 ? "⭐⭐ Уверенный" : "⭐⭐⭐ Продвинутый"}</span>
          </button>
          {levelOpen && (
            <div className={styles.levelDropdown}>
              <div className={`${styles.levelItem} ${level === "all" ? styles.levelItemSelected : ""}`} onClick={() => { setLevel("all"); setLevelOpen(false); }}>Все</div>
              <div className={`${styles.levelItem} ${level === 2 ? styles.levelItemSelected : ""}`} onClick={() => { setLevel(2); setLevelOpen(false); }}>⭐ Базовый</div>
              <div className={`${styles.levelItem} ${level === 3 ? styles.levelItemSelected : ""}`} onClick={() => { setLevel(3); setLevelOpen(false); }}>⭐⭐ Уверенный</div>
              <div className={`${styles.levelItem} ${level === 4 ? styles.levelItemSelected : ""}`} onClick={() => { setLevel(4); setLevelOpen(false); }}>⭐⭐⭐ Продвинутый</div>
            </div>
          )}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2, includeHiddenNodes: true } as any}
          onInit={(instance) => { rfRef.current = instance; try { instance.fitView({ padding: 0.2, includeHiddenNodes: true } as any); } catch { /* ignore */ } }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            try {
              const d: any = node?.data;
              if (d && !d.noImage && typeof d.onOpen === 'function') d.onOpen();
            } catch { /* ignore */ }
          }}
        >
          <Background color="rgba(255, 255, 255, 0.6)" />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>
      {selectedItem && (
        <TopicModal
          item={selectedItem as any}
          onClose={() => setSelectedIdx(null)}
          onGoTasks={() => {
            const it: any = selectedItem;
            const topic = it?.title || it?.skills?.name || "";
            navigate(`/tasks${topic ? `?topic=${encodeURIComponent(topic)}` : ""}` as string, { state: { item: it } });
          }}
        />
      )}
    </>
  );
};

export default My;

const splitBullets = (text?: string | null): string[] => {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const TopicModal: React.FC<{ item: any; onClose: () => void; onGoTasks: () => void }> = ({ item, onClose, onGoTasks }) => {
  const levels = (item?.skills?.levels || []) as any[];
  const byLevel = new Map<number, any>();
  levels.forEach((l) => byLevel.set(l.level, l));
  const l2 = byLevel.get(2);
  const l3 = byLevel.get(3);
  const l4 = byLevel.get(4);
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalBreadcrumb}>Все задания</div>
            <div className={styles.modalTitle}>{item?.title || item?.skills?.name || "Тема"}</div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalProgress}>Готово <span>0/10</span></div>
        {item?.description && (
          <div className={styles.modalIntro}>{item.description}</div>
        )}
        {l2 && (
          <>
            <div className={styles.modalLevelTitle}>⭐ Базовый уровень</div>
            <ul className={styles.modalList}>
              {splitBullets(l2?.description).map((t, i) => <li key={`l2-${i}`}>{t}</li>)}
            </ul>
          </>
        )}
        {l3 && (
          <>
            <div className={styles.modalLevelTitle}>⭐⭐ Уверенный уровень <span className={styles.modalBadge}>Целевой</span></div>
            <ul className={styles.modalList}>
              {splitBullets(l3?.description).map((t, i) => <li key={`l3-${i}`}>{t}</li>)}
            </ul>
          </>
        )}
        {l4 && (
          <>
            <div className={styles.modalLevelTitle}>⭐⭐⭐ Продвинутый уровень</div>
            <ul className={styles.modalList}>
              {splitBullets(l4?.description).map((t, i) => <li key={`l4-${i}`}>{t}</li>)}
            </ul>
          </>
        )}
        <div className={styles.modalFooter}>
          <button className={styles.modalCta} onClick={onGoTasks}>К заданиям</button>
        </div>
      </div>
    </div>
  );
};


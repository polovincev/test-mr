import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  metaExpand,
  metaExtendNew,
  updateGoalLevels,
  metaCentral,
  getTrajectory,
  type TrajectoryResponse,
  getTrajectoryByTopic,
} from "../../services/api";
import ReactFlow, {
  Background,
  Panel,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import styles from "./index.module.css";
import LoaderOverlay from "../../components/LoaderOverlay";
import plusIcon from "../../icon/plus.svg";
import minusIcon from "../../icon/minus.svg";
import collapseIcon from "../../icon/collapse.svg";

type TopicNodeData = {
  title: string;
  imageUrl?: string;
  handleSide?: "left" | "right";
  levelCounts?: { total: number; l2: number; l3: number; l4: number };
  goalLevel?: number; // 2|3|4 when selected, otherwise undefined
  onOpen?: () => void;
  onOpenMain?: () => void;
  noImage?: boolean;
  onSetLevel?: (level: 2 | 3 | 4) => void;
  hideTasksBox?: boolean;
  forceOpaque?: boolean;
  isActive?: boolean;
  selectedFilter?: "all" | 2 | 3 | 4;
  filteredTotal?: number;
};

const GoalNode: React.FC<
  NodeProps<{ title?: string; centralText?: string }>
> = ({ data }) => {
  const title = data?.title || "Цель";
  return (
    <div className={styles.goalNode} onClick={(e) => e.stopPropagation()}>
      {/* <div className={styles.goalTitle}>{title}</div> */}
      {data?.centralText && (
        <div className={styles.goalTitle}>{data.centralText}</div>
      )}
      <Handle
        type="source"
        position={Position.Left}
        id="goal-left"
        className={styles.handleInvisible}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="goal-right"
        className={styles.handleInvisible}
      />
    </div>
  );
};

const TopicNode: React.FC<NodeProps<TopicNodeData>> = ({ data }) => {
  const title = data?.title || "Тема";
  const imageUrl = data?.imageUrl; // for expansion nodes we intentionally omit image

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
      <div
        className={`${styles.topicNode} ${
          data?.noImage ? styles.topicNodeCompact : ""
        } ${data?.isActive ? styles.topicNodeActive : ""}`}
        style={data?.forceOpaque ? { opacity: 1 } : undefined}
        onClick={(e) => {
          e.stopPropagation();
          try {
            if (typeof data?.onOpenMain === "function") data.onOpenMain();
            else if (typeof data?.onOpen === "function") data.onOpen();
          } catch {
            /* ignore */
          }
        }}
      >
        {!data?.noImage && imageUrl && (
          <img src={imageUrl} alt="" className={styles.topicImage} />
        )}
        <div className={styles.topicContent}>
          <div className={styles.topicBadge}>Тема</div>
          <div
            className={
              data?.noImage ? styles.topicTitleSmall : styles.topicTitle
            }
          >
            {title}
          </div>
        </div>
        {/* Target handles on both sides; source handles on opposite sides for outgoing */}
        <Handle
          type="target"
          position={Position.Left}
          id="topic-left"
          className={styles.handleInvisible}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="topic-right"
          className={styles.handleInvisible}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="topic-src-left"
          className={styles.handleInvisible}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="topic-src-right"
          className={styles.handleInvisible}
        />
      </div>
      {data?.levelCounts && !data?.noImage && !data?.hideTasksBox && (
        <div
          className={styles.nodeTasksBox}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            try {
              data?.onOpen && data.onOpen();
            } catch {}
          }}
        >
          <div className={styles.nodeTasksHeader}>
            Задания{" "}
            <span className={styles.nodeTasksNum}>
              {typeof data.filteredTotal === "number"
                ? data.filteredTotal
                : data.levelCounts?.total || 0}
            </span>
          </div>
          <div className={styles.nodeChipRow}>
            {(() => {
              const f = data?.selectedFilter ?? "all";
              return f === "all" || f === 2 || f === 3 || f === 4;
            })() && (
              <div
                className={`${styles.nodeChip} ${
                  data?.goalLevel === 2 ? styles.nodeChipActive : ""
                }`}
              >
                <div className={styles.nodeChipTitle}>⭐</div>
                <div className={styles.nodeChipCount}>
                  {formatTasksCount(data.levelCounts?.l2 || 0)}
                </div>
              </div>
            )}
            {(() => {
              const f = data?.selectedFilter ?? "all";
              return f === "all" || f === 3 || f === 4;
            })() && (
              <div
                className={`${styles.nodeChip} ${
                  data?.goalLevel === 3 ? styles.nodeChipActive : ""
                }`}
              >
                <div className={styles.nodeChipTitle}>⭐⭐</div>
                <div className={styles.nodeChipCount}>
                  ещё {formatTasksCount(data.levelCounts?.l3 || 0)}
                </div>
              </div>
            )}
            {(() => {
              const f = data?.selectedFilter ?? "all";
              return f === "all" || f === 4;
            })() && (
              <div
                className={`${styles.nodeChip} ${
                  data?.goalLevel === 4 ? styles.nodeChipActive : ""
                }`}
              >
                <div className={styles.nodeChipTitle}>⭐⭐⭐</div>
                <div className={styles.nodeChipCount}>
                  ещё {formatTasksCount(data.levelCounts?.l4 || 0)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const My: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const trajectoryInit = (location.state as any)?.trajectory as
    | {
        items?: {
          title: string;
          image_url?: string;
          skills?: {
            levels?: { level: number; tasks?: { title: string }[] }[];
            name?: string;
            goal_level?: number;
          };
        }[];
        goal?: string;
      }
    | undefined;
  const search = new URLSearchParams(location.search);
  const chatIdParam = search.get("chat_id");
  const chatId = chatIdParam
    ? Number(chatIdParam)
    : (location.state as any)?.chatId
    ? Number((location.state as any)?.chatId)
    : undefined;
  const fromChatMode =
    (search.get("from") || "").toLowerCase() === "chat" ||
    Boolean((location.state as any)?.fromChat);
  const [trajectory, setTrajectory] = useState<TrajectoryResponse | undefined>(
    trajectoryInit as any
  );
  const trajFetchedRef = useRef<boolean>(Boolean(trajectoryInit));
  const fetchingRef = useRef<boolean>(false);
  const [expansions, setExpansions] = useState<Record<string, string[]>>({});
  const [metaText, setMetaText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [mainOpenIdx, setMainOpenIdx] = useState<number | null>(null);
  const [extLoading, setExtLoading] = useState<boolean>(false);
  const [relatedTitle, setRelatedTitle] = useState<string | null>(null);
  const [relExtLoading, setRelExtLoading] = useState<boolean>(false);
  const [relatedItem, setRelatedItem] = useState<any | null>(null);
  const [relatedLoading, setRelatedLoading] = useState<boolean>(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [level, setLevel] = useState<"all" | 2 | 3 | 4>("all");
  const levelRef = useRef<HTMLDivElement | null>(null);
  const rfRef = useRef<any>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!levelRef.current) return;
      if (!levelRef.current.contains(e.target as HTMLElement))
        setLevelOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Sequential fetching: trajectory -> expansions -> metaCentral (StrictMode-safe)
  useEffect(() => {
    const fetchAll = async () => {
      if (!chatId) {
        setLoading(false);
        return;
      }
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;
      try {
        setLoading(true);
        // 1) trajectory
        let tr = trajectory;
        if (!trajFetchedRef.current) {
          trajFetchedRef.current = true; // lock before starting request (prevents double call under StrictMode)
          tr = await getTrajectory(chatId);
          setTrajectory(tr);
        }

        // 2) expansions
        const expResp = await metaExpand(chatId);
        const map: Record<string, string[]> = {};
        (expResp.items || []).forEach((it) => {
          map[it.title] = it.expansions || [];
        });
        setExpansions(map);

        // 3) meta central
        const mc = await metaCentral(chatId);
        setMetaText(String(mc.content || ""));
      } catch {
        // ignore errors, leave what we could load
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };
    fetchAll();
    // No cleanup needed; we intentionally allow async to finish even after unmount (StrictMode first pass)
  }, [chatId]);

  // Force layout/resize and fit graph on initial mount
  useEffect(() => {
    try {
      window.dispatchEvent(new Event("resize"));
    } catch {
      /* ignore */
    }
  }, []);

  const nodeTypes = useMemo(() => ({ topic: TopicNode, goal: GoalNode }), []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "bezier",
      style: { stroke: "#37C5F0", strokeWidth: 3 },
    }),
    []
  );

  const computedNodes: Node<TopicNodeData>[] = useMemo(() => {
    const items =
      Array.isArray(trajectory?.items) && trajectory?.items?.length
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
            const goalLevel =
              !isNaN(glRaw) && glRaw > 1
                ? Math.max(2, Math.min(4, Math.round(glRaw)))
                : undefined;
            const filteredTotal =
              level === "all"
                ? counts.total
                : level === 2
                ? counts.l2
                : level === 3
                ? counts.l2 + counts.l3
                : counts.total;
            return {
              title: String(it?.title || "Тема"),
              imageUrl: it?.image_url as string | undefined,
              levelCounts: counts,
              goalLevel,
              onOpen: () => setSelectedIdx(trajectory?.items?.indexOf(it) || 0),
              hideTasksBox: fromChatMode,
              selectedFilter: level,
              filteredTotal,
            };
          })
        : [
            {
              title: "Наследственность и изменчивость организмов",
              imageUrl: new URL("../../icon/goal.png", import.meta.url).href,
              levelCounts: { total: 10, l2: 7, l3: 2, l4: 1 },
              goalLevel: undefined,
              onOpen: () => setSelectedIdx(0),
              hideTasksBox: fromChatMode,
              selectedFilter: level,
              filteredTotal:
                level === "all"
                  ? 10
                  : level === 2
                  ? 7
                  : level === 3
                  ? 7 + 2
                  : 10,
            },
            {
              title: "Молекулярные основы жизни",
              imageUrl: new URL("../../icon/profile.png", import.meta.url).href,
              levelCounts: { total: 6, l2: 2, l3: 3, l4: 1 },
              goalLevel: 3,
              onOpen: () => setSelectedIdx(1),
              hideTasksBox: fromChatMode,
              selectedFilter: level,
              filteredTotal:
                level === "all" ? 6 : level === 2 ? 2 : level === 3 ? 2 + 3 : 6,
            },
            {
              title: "Эволюционное учение",
              imageUrl: new URL("../../icon/profile.png", import.meta.url).href,
              levelCounts: { total: 5, l2: 1, l3: 2, l4: 2 },
              goalLevel: 4,
              onOpen: () => setSelectedIdx(2),
              hideTasksBox: fromChatMode,
              selectedFilter: level,
              filteredTotal:
                level === "all" ? 5 : level === 2 ? 1 : level === 3 ? 1 + 2 : 5,
            },
            {
              title: "Экосистемы и биосфера",
              imageUrl: new URL("../../icon/profile.png", import.meta.url).href,
              levelCounts: { total: 4, l2: 1, l3: 2, l4: 1 },
              goalLevel: 2,
              onOpen: () => setSelectedIdx(3),
              hideTasksBox: fromChatMode,
              selectedFilter: level,
              filteredTotal:
                level === "all" ? 4 : level === 2 ? 1 : level === 3 ? 1 + 2 : 4,
            },
          ];
    const modalOpen =
      selectedIdx !== null || relatedTitle !== null || mainOpenIdx !== null;
    const activeMainId =
      selectedIdx !== null
        ? String((selectedIdx as number) + 1)
        : mainOpenIdx !== null
        ? String((mainOpenIdx as number) + 1)
        : null;
    const activeRelatedTitle = relatedTitle;
    const nodes: Node<TopicNodeData>[] = [];
    const anchorCenterX = 0;
    const anchorCenterY = 0;
    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const goalHalf = 0; // 140x140 goal node
    const topicWidth = 380; // approx width of topic node
    const baseGap = Math.max(120, Math.min(280, Math.round(viewportW * 0.08)));
    const leftX = anchorCenterX - goalHalf - baseGap - topicWidth;
    const rightX = anchorCenterX + goalHalf + baseGap;
    // independent vertical spacing for left and right columns (center-based)
    const childGap = 80; // vertical gap between compact nodes
    const mainMinSpan = 120; // minimal span allocated even if no children
    const getSpan = (idx: number) => {
      const n = (expansions[(items[idx] as any)?.title] || []).length as number;
      const childSpan = n > 1 ? (n - 1) * childGap : 0; // total vertical span occupied by children
      return Math.max(mainMinSpan, childSpan + (n > 0 ? childGap : 0));
    };
    const leftIdx: number[] = [];
    const rightIdx: number[] = [];
    for (let i = 0; i < items.length; i++) {
      (i % 2 === 0 ? leftIdx : rightIdx).push(i);
    }
    const leftSpans = leftIdx.map(getSpan);
    const rightSpans = rightIdx.map(getSpan);
    const sum = (arr: number[]) =>
      arr.reduce((a: number, b: number) => a + b, 0);
    const leftStart = anchorCenterY - Math.round(sum(leftSpans) / 2);
    const rightStart = anchorCenterY - Math.round(sum(rightSpans) / 2);
    const yForIndex = new Map<number, number>();
    let acc = leftStart;
    leftIdx.forEach((idx, k) => {
      const span = leftSpans[k];
      yForIndex.set(idx, acc + Math.round(span / 2));
      acc += span;
    });
    acc = rightStart;
    rightIdx.forEach((idx, k) => {
      const span = rightSpans[k];
      yForIndex.set(idx, acc + Math.round(span / 2));
      acc += span;
    });
    items.forEach((t, i) => {
      const isLeft = i % 2 === 0;
      const x =
        (isLeft ? leftX : rightX) +
        (isLeft
          ? -Math.floor(Math.random() * 100)
          : Math.floor(Math.random() * 100));
      const y = yForIndex.get(i) ?? 0;
      const isActiveMain = activeMainId === String(i + 1);
      nodes.push({
        id: String(i + 1),
        type: "topic",
        position: { x, y },
        style: modalOpen
          ? isActiveMain
            ? { opacity: 1 }
            : { opacity: 0.5 }
          : undefined,
        data: {
          title: t.title,
          imageUrl:
            t.imageUrl ||
            new URL("../../icon/profile.png", import.meta.url).href,
          handleSide: isLeft ? "right" : "left",
          levelCounts: (t as any).levelCounts,
          goalLevel: (t as any).goalLevel,
          onOpen: () => setSelectedIdx(i),
          onOpenMain: () => setMainOpenIdx(i),
          isActive: modalOpen && isActiveMain,
          selectedFilter: (t as any).selectedFilter,
          filteredTotal: (t as any).filteredTotal,
          onSetLevel: (lvl: 2 | 3 | 4) => {
            try {
              const newLevel = Math.max(2, Math.min(4, Number(lvl)));
              // Update the real trajectory object in router state if provided
              try {
                const idx = i;
                const tr: any = trajectory as any;
                if (tr && Array.isArray(tr.items) && tr.items[idx]) {
                  tr.items[idx].skills = {
                    ...(tr.items[idx].skills || {}),
                    goal_level: newLevel,
                  };
                }
              } catch {}
              // Trigger UI update by updating expansions state (no-op mutate)
              setExpansions((prev) => ({ ...prev }));
              // Persist to backend
              if (typeof chatId === "number") {
                try {
                  const levels = (trajectory?.items || []).map((it, k) =>
                    k === i
                      ? newLevel
                      : Math.round(Number(it?.skills?.goal_level || 0.1)) || 0.1
                  );
                  updateGoalLevels(chatId, levels as any).catch(() => void 0);
                } catch {}
              }
            } catch {}
          },
          hideTasksBox: fromChatMode,
        },
      });

      // expansion children below the parent node if any
      const exps = expansions[t.title] || [];

      const ys = exps.map((_, k) =>
        Math.round(y + (k - (exps.length - 1) / 2) * childGap)
      );
      exps.forEach((title, idx) => {
        const id = `${i + 1}-e${idx + 1}`;
        const expOffsetX = isLeft
          ? -(topicWidth / 2 + Math.max(140, baseGap))
          : topicWidth + Math.max(140, baseGap);
        const exX = x + expOffsetX;
        const exY = ys[idx];
        const isActiveRelated = Boolean(
          activeRelatedTitle && activeRelatedTitle === title
        );
        nodes.push({
          id,
          type: "topic",
          position: { x: exX, y: exY },
          style: modalOpen
            ? isActiveMain || isActiveRelated
              ? { opacity: 1 }
              : { opacity: 1 }
            : undefined,
          data: {
            title,
            handleSide: isLeft ? "right" : "left",
            levelCounts: { total: 0, l2: 0, l3: 0, l4: 0 },
            goalLevel: undefined,
            onOpen: () => setRelatedTitle(title),
            noImage: true,
            forceOpaque: modalOpen && (isActiveMain || isActiveRelated),
            isActive: modalOpen && isActiveRelated,
          },
        });

        // render second-level related topics (grandchildren) if present in expansions map
        const ex2 = expansions[title] || [];
        if (ex2.length > 0) {
          const childGap2 = Math.max(56, Math.min(90, childGap - 10));
          const ys2 = ex2.map((_, kk) =>
            Math.round(exY + (kk - (ex2.length - 1) / 2) * childGap2)
          );
          const ex2OffsetX = isLeft
            ? -(topicWidth / 2 + Math.max(120, baseGap))
            : topicWidth / 2 + Math.max(120, baseGap);
          ex2.forEach((t2, j) => {
            const id2 = `${id}-g${j + 1}`;
            nodes.push({
              id: id2,
              type: "topic",
              position: { x: exX + ex2OffsetX, y: ys2[j] },
              data: {
                title: t2,
                handleSide: isLeft ? "right" : "left",
                levelCounts: { total: 0, l2: 0, l3: 0, l4: 0 },
                goalLevel: undefined,
                onOpen: () => setRelatedTitle(t2),
                noImage: true,
                forceOpaque: false,
                isActive: false,
              },
            });
          });
        }
      });
    });
    // Add centered goal node at flow center (top-left offset for 140x140)
    nodes.push({
      id: "goal",
      type: "goal" as any,
      position: { x: anchorCenterX - 70, y: anchorCenterY - 70 },
      style: modalOpen ? { opacity: 0.5 } : undefined,
      data: { title: "", centralText: metaText } as any,
      draggable: false,
    });
    return nodes;
  }, [
    trajectory,
    expansions,
    metaText,
    fromChatMode,
    selectedIdx,
    relatedTitle,
    mainOpenIdx,
    level,
  ]);

  const computedEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    // connect each main node to the central goal node, attach to left/right handle based on x
    const goalNode = computedNodes.find((n) => n.id === "goal");
    const goalX = goalNode ? goalNode.position.x : 0;
    computedNodes.forEach((node) => {
      if (/^\d+$/.test(node.id)) {
        const isRight = node.position.x > goalX;
        edges.push({
          id: `goal-${node.id}`,
          source: "goal",
          sourceHandle: isRight ? "goal-right" : "goal-left",
          target: node.id,
          targetHandle: isRight ? "topic-left" : "topic-right",
          type: "bezier",
        } as any);
      }
    });
    // connect ONLY first-level expansions (ids like "N-eM") to their main parent
    computedNodes.forEach((node) => {
      if (/^\d+-e\d+$/.test(node.id)) {
        const parentId = node.id.split("-e")[0];
        const parent = computedNodes.find((n) => n.id === parentId);
        const child = node;
        if (parent) {
          const isParentRight =
            goalX !== undefined
              ? parent.position.x > goalX
              : parent.position.x > 0;
          const sourceHandle = isParentRight
            ? "topic-src-right"
            : "topic-src-left";
          const targetHandle =
            child.position.x > parent.position.x ? "topic-left" : "topic-right";
          edges.push({
            id: `p${parentId}-${node.id}`,
            source: parentId,
            sourceHandle,
            target: node.id,
            targetHandle,
            type: "bezier",
            style: {
              strokeDasharray: "6 4",
              stroke: "#37C5F0",
              strokeWidth: 2,
            },
          } as any);
        }
      }
    });
    // connect second-level related nodes to their parent expansion
    computedNodes.forEach((node) => {
      if (node.id.includes("-g")) {
        const parentId = node.id.split("-g")[0]; // like 1-e2
        const parent = computedNodes.find((n) => n.id === parentId);
        const child = node;
        if (parent) {
          const sourceHandle =
            child.position.x > parent.position.x
              ? "topic-src-right"
              : "topic-src-left";
          const targetHandle =
            child.position.x > parent.position.x ? "topic-left" : "topic-right";
          edges.push({
            id: `p${parentId}-${node.id}`,
            source: parentId,
            sourceHandle,
            target: node.id,
            targetHandle,
            type: "bezier",
            style: {
              strokeDasharray: "6 4",
              stroke: "#37C5F0",
              strokeWidth: 2,
            },
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
        if (li.level === 2) {
          result.l2 += count;
        }
        if (li.level === 3) {
          result.l3 += count;
        }
        if (li.level === 4) {
          result.l4 += count;
        }
        result.total += count;
      }
    }
    return result;
  }, [trajectory]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  // Keep state in sync when computed graph changes (e.g., after meta_expand loads)
  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes, setNodes]);

  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

  // Load single-item trajectory for related modal
  useEffect(() => {
    const run = async () => {
      if (!relatedTitle || typeof chatId !== "number") {
        setRelatedItem(null);
        return;
      }
      setRelatedLoading(true);
      try {
        const resp = await getTrajectoryByTopic(chatId, relatedTitle);
        const item =
          Array.isArray(resp?.items) && resp.items.length > 0
            ? resp.items[0]
            : null;
        setRelatedItem(item);
      } catch {
        setRelatedItem(null);
      } finally {
        setRelatedLoading(false);
      }
    };
    run();
  }, [relatedTitle, chatId]);

  // Fit viewport to show the whole map on mount and after graph changes
  // intentionally skip fitView to keep goal centered

  // Center viewport on the goal node after render and on resize
  useEffect(() => {
    const centerOnGoal = () => {
      try {
        const rf = rfRef.current as any;
        if (!rf) return;
        const goal = nodes.find((n) => n.id === "goal");
        if (!goal) return;
        const x = goal.position.x; // center of 140px node
        const y = goal.position.y;
        rf.setCenter(0, 0, { zoom: 1.1, duration: 1000 });
      } catch {
        /* ignore */
      }
    };
    const id = window.setTimeout(centerOnGoal, 0);
    window.addEventListener("resize", centerOnGoal);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", centerOnGoal);
    };
  }, [nodes.length, edges.length]);

  // When modal is open, gently center on the active node once (no auto zoom on move)
  useEffect(() => {
    const rf = rfRef.current as any;
    if (!rf) return;
    const modalOpen =
      selectedIdx !== null || relatedTitle !== null || mainOpenIdx !== null;
    try {
      if (modalOpen) {
        let target: any = null;
        if (selectedIdx !== null) {
          target = nodes.find(
            (n) => n.id === String((selectedIdx as number) + 1)
          );
        } else if (mainOpenIdx !== null) {
          target = nodes.find(
            (n) => n.id === String((mainOpenIdx as number) + 1)
          );
        } else if (relatedTitle) {
          target = nodes.find(
            (n) =>
              n.id.includes("-e") &&
              String((n.data as any)?.title) === String(relatedTitle)
          );
        }
        if (target) {
          try {
            rf.fitView({
              nodes: [target],
              padding: 0.2,
              includeHiddenNodes: false,
              duration: 1000,
              minZoom: 0.8,
              maxZoom: 1.5,
            } as any);
          } catch {
            const tx = target.position?.x ?? 0;
            const ty = target.position?.y ?? 0;
            rf.setCenter(tx, ty, { zoom: 0.9, duration: 1000 });
          }
        }
      } else {
        // restore default view on goal
        rf.setCenter(0, 0, { zoom: 1.1, duration: 1000 });
      }
    } catch {
      /* noop */
    }
  }, [selectedIdx, relatedTitle, mainOpenIdx, nodes]);

  const selectedItem =
    selectedIdx !== null ? trajectory?.items?.[selectedIdx] : undefined;

  if (loading) {
    return <LoaderOverlay text="Формирую тематические связи..." />;
  }

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.headerWrap}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            ← Назад
          </button>
          {trajectory?.goal && (
            <div className={styles.goalBlock}>
              <div className={styles.goalText}>{trajectory.goal}</div>
            </div>
          )}
          <div className={styles.levelFilterWrap} ref={levelRef}>
            {fromChatMode ? (
              <button
                className={styles.trajectoryBtn}
                onClick={() => {
                  const chatQ =
                    typeof chatId === "number" ? `?chat_id=${chatId}` : "";
                  navigate(`/trajectory${chatQ}` as string);
                }}
              >
                В траекторию →
              </button>
            ) : (
              <>
                <button
                  className={styles.levelFilterBtn}
                  onClick={() => setLevelOpen((v) => !v)}
                >
                  <span className={styles.levelFilterLabel}>Уровень: </span>
                  <span className={styles.levelFilterValue}>
                    {level === "all"
                      ? "Все"
                      : level === 2
                      ? "⭐ Базовый"
                      : level === 3
                      ? "⭐⭐ Уверенный"
                      : "⭐⭐⭐ Продвинутый"}
                  </span>
                </button>
                {levelOpen && (
                  <div className={styles.levelDropdown}>
                    <div
                      className={`${styles.levelItem} ${
                        level === "all" ? styles.levelItemSelected : ""
                      }`}
                      onClick={() => {
                        setLevel("all");
                        setLevelOpen(false);
                      }}
                    >
                      Все
                    </div>
                    <div
                      className={`${styles.levelItem} ${
                        level === 2 ? styles.levelItemSelected : ""
                      }`}
                      onClick={() => {
                        setLevel(2);
                        setLevelOpen(false);
                      }}
                    >
                      ⭐ Базовый
                    </div>
                    <div
                      className={`${styles.levelItem} ${
                        level === 3 ? styles.levelItemSelected : ""
                      }`}
                      onClick={() => {
                        setLevel(3);
                        setLevelOpen(false);
                      }}
                    >
                      ⭐⭐ Уверенный
                    </div>
                    <div
                      className={`${styles.levelItem} ${
                        level === 4 ? styles.levelItemSelected : ""
                      }`}
                      onClick={() => {
                        setLevel(4);
                        setLevelOpen(false);
                      }}
                    >
                      ⭐⭐⭐ Продвинутый
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2, includeHiddenNodes: true } as any}
          onInit={(instance) => {
            rfRef.current = instance;
            try {
              instance.fitView({
                padding: 0.2,
                includeHiddenNodes: true,
              } as any);
            } catch {
              /* ignore */
            }
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            try {
              const d: any = node?.data;
              if (d && typeof d.onOpen === "function") d.onOpen();
            } catch {
              /* ignore */
            }
          }}
        >
          <Background color="rgba(255, 255, 255, 0.6)" />
          <Panel position="bottom-left" className={styles.legendPanel as any}>
            <div className={styles.legendWrap}>
              <div className={styles.legendControlsRow}>
                <button
                  className={styles.legendCtrlBtn}
                  onClick={() => {
                    try {
                      (rfRef.current as any)?.zoomIn?.();
                    } catch {}
                  }}
                  aria-label="Zoom in"
                >
                  <img src={plusIcon} alt="+" />
                </button>
                <button
                  className={styles.legendCtrlBtn}
                  onClick={() => {
                    try {
                      (rfRef.current as any)?.zoomOut?.();
                    } catch {}
                  }}
                  aria-label="Zoom out"
                >
                  <img src={minusIcon} alt="-" />
                </button>
                <button
                  className={styles.legendCtrlBtn}
                  onClick={() => {
                    try {
                      const rf = rfRef.current as any;
                      rf?.fitView?.({ padding: 0.2, includeHiddenNodes: true });
                    } catch {}
                  }}
                  aria-label="Fit view"
                >
                  <img src={collapseIcon} alt="fit" />
                </button>
              </div>
              {!fromChatMode && (
                <div className={styles.legendRow}>
                  <div className={styles.legendTitle}>Легенда</div>
                  <div className={styles.legendItems}>
                    <div className={styles.legendItem}>
                      <span className={styles.legendTarget} />
                      <span>Целевой уровень</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendStars}>⭐</span>
                      <span>Базовый уровень</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendStars}>⭐⭐</span>
                      <span>Уверенный уровень</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendStars}>⭐⭐⭐</span>
                      <span>Продвинутый уровень</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>
      {selectedItem && (
        <TopicModal
          item={selectedItem as any}
          filterLevel={level}
          onClose={() => setSelectedIdx(null)}
          onGoTasks={() => {
            const it: any = selectedItem;
            const topic = it?.title || it?.skills?.name || "";
            const goalSelected =
              typeof it?.skills?.goal_level === "number" &&
              it?.skills?.goal_level > 0.1;
            const chatQ =
              typeof chatId === "number" ? `?chat_id=${chatId}` : "";
            if (goalSelected) {
              const qp = topic
                ? `${chatQ}${chatQ ? "&" : "?"}topic=${encodeURIComponent(
                    topic
                  )}`
                : chatQ;
              navigate(`/tasks${qp}` as string, {
                state: { item: it, chatId },
              });
            } else {
              navigate(`/level-select${chatQ}` as string, {
                state: { item: it, index: selectedIdx, chatId },
              });
            }
          }}
        />
      )}
      {mainOpenIdx !== null && (
        <div
          className={styles.modalOverlay}
          onClick={() => setMainOpenIdx(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const it: any = trajectory?.items?.[mainOpenIdx] || {};
              const img =
                it?.image_url ||
                new URL("../../icon/goal.png", import.meta.url).href;
              const levels = (it?.skills?.levels || []) as any[];
              const total = levels.reduce(
                (acc, l) =>
                  acc + (Array.isArray(l?.tasks) ? l.tasks.length : 0),
                0
              );
              const done = Number(it?.passedCount || 0);
              const gl = Math.round(Number(it?.skills?.goal_level || 0));
              const glText =
                gl === 2
                  ? "Базовый"
                  : gl === 3
                  ? "Уверенный"
                  : gl === 4
                  ? "Продвинутый"
                  : "—";
              const goTasks = () => {
                const topic = it?.title || it?.skills?.name || "";
                const goalSelected =
                  typeof it?.skills?.goal_level === "number" &&
                  it?.skills?.goal_level > 0.1;
                const chatQ =
                  typeof chatId === "number" ? `?chat_id=${chatId}` : "";
                if (goalSelected) {
                  const qp = topic
                    ? `${chatQ}${chatQ ? "&" : "?"}topic=${encodeURIComponent(
                        topic
                      )}`
                    : chatQ;
                  navigate(`/tasks${qp}` as string, {
                    state: { item: it, chatId },
                  });
                } else {
                  navigate(`/level-select${chatQ}` as string, {
                    state: { item: it, index: mainOpenIdx, chatId },
                  });
                }
              };
              return (
                <div className={styles.modalContent}>
                  <img src={img} alt="" className={styles.modalHero} />
                  <button
                    className={styles.modalCloseTheme}
                    onClick={() => setMainOpenIdx(null)}
                  >
                    ×
                  </button>
                  <div className={styles.modalHeader}>
                    <div>
                      <div className={styles.modalBreadcrumb}>Тема</div>
                      <div className={styles.modalTitle}>
                        {it?.title || "Тема"}
                      </div>
                    </div>
                  </div>
                  <div className={styles.modalMetaRow}>
                    <div className={styles.modalProgress}>
                      Готово{" "}
                      <span>
                        {done}/{total}
                      </span>
                    </div>
                    <div className={styles.modalGoalLevel}>
                      Целевой уровень темы:
                      <select
                        className={styles.goalSelect}
                        value={
                          gl === 2 || gl === 3 || gl === 4 ? String(gl) : ""
                        }
                        required
                        onChange={(e) => {
                          try {
                            const raw = Number(e.target.value);
                            const chosen: any =
                              raw === 2 || raw === 3 || raw === 4 ? raw : 0.1;
                            // update local trajectory object
                            try {
                              const tr: any = trajectory as any;
                              if (
                                tr &&
                                Array.isArray(tr.items) &&
                                typeof mainOpenIdx === "number"
                              ) {
                                const idx = mainOpenIdx as number;
                                const prev = tr.items[idx]?.skills || {};
                                tr.items[idx].skills = {
                                  ...prev,
                                  goal_level: chosen,
                                };
                              }
                            } catch {}
                            // trigger UI update
                            setExpansions((prev) => ({ ...prev }));
                            // persist to backend
                            if (typeof chatId === "number") {
                              try {
                                const levels = (trajectory?.items || []).map(
                                  (it, k) =>
                                    k === (mainOpenIdx as number)
                                      ? chosen
                                      : Math.round(
                                          Number(it?.skills?.goal_level || 0.1)
                                        ) || 0.1
                                );
                                updateGoalLevels(chatId, levels as any).catch(
                                  () => void 0
                                );
                              } catch {}
                            }
                          } catch {}
                        }}
                      >
                        <option value="" disabled hidden>
                          Не выбран
                        </option>
                        <option value="2">⭐ Базовый</option>
                        <option value="3">⭐⭐ Уверенный</option>
                        <option value="4">⭐⭐⭐ Продвинутый</option>
                      </select>
                    </div>
                  </div>
                  {it?.description && (
                    <div className={styles.modalIntroText}>
                      {it.description}
                    </div>
                  )}
                  <div className={styles.modalActionsRow}>
                    <button
                      className={`${styles.modalCta} ${
                        extLoading ? styles.modalCtaLoading : ""
                      }`}
                      onClick={async () => {
                        try {
                          setExtLoading(true);
                          const it: any =
                            trajectory?.items?.[mainOpenIdx as number] || {};
                          const topic = String(
                            it?.title || it?.skills?.name || ""
                          );
                          if (typeof chatId === "number" && topic) {
                            const resp = await metaExtendNew(chatId, topic);
                            // merge into existing expansions, update only returned topics
                            if (
                              resp &&
                              Array.isArray(resp.items) &&
                              resp.items.length > 0
                            ) {
                              setExpansions((prev) => {
                                const next = { ...(prev || {}) } as Record<
                                  string,
                                  string[]
                                >;
                                resp.items.forEach((x) => {
                                  if (x && typeof x.title === "string") {
                                    next[x.title] = Array.isArray(x.expansions)
                                      ? x.expansions
                                      : [];
                                  }
                                });
                                return next;
                              });
                            }
                          }
                        } catch {
                        } finally {
                          setExtLoading(false);
                          setMainOpenIdx(null);
                        }
                      }}
                    >
                      {extLoading ? "Загружаю…" : "Посмотреть связанные темы"}
                    </button>
                    <button
                      className={styles.modalCtaSecondary}
                      onClick={() => goTasks()}
                    >
                      К заданиям
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {relatedTitle && (
        <div
          className={styles.modalOverlay}
          onClick={() => setRelatedTitle(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {relatedLoading && (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <div className={styles.modalBreadcrumb}>Тема</div>
                    <div className={styles.modalTitle}>
                      {relatedTitle || "Тема"}
                    </div>
                  </div>
                </div>
                <div className={styles.modalSpinner}>
                  <span className={styles.modalDots}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <div>Формирую информацию по теме</div>
                </div>
              </>
            )}
            {!relatedLoading &&
              (() => {
                const it: any = relatedItem || {
                  title: relatedTitle,
                  image_url: new URL("../../icon/goal.png", import.meta.url)
                    .href,
                  skills: { name: relatedTitle, goal_level: 0.1, levels: [] },
                };
                const img =
                  it?.image_url ||
                  new URL("../../icon/goal.png", import.meta.url).href;
                const levels = (it?.skills?.levels || []) as any[];
                const total = levels.reduce(
                  (acc, l) =>
                    acc + (Array.isArray(l?.tasks) ? l.tasks.length : 0),
                  0
                );
                const done = Number(it?.passedCount || 0);
                const gl = Math.round(Number(it?.skills?.goal_level || 0));
                const glText =
                  gl === 2
                    ? "Базовый"
                    : gl === 3
                    ? "Уверенный"
                    : gl === 4
                    ? "Продвинутый"
                    : "—";
                const goTasks = () => {
                  const topic = it?.title || it?.skills?.name || "";
                  const goalSelected =
                    typeof it?.skills?.goal_level === "number" &&
                    it?.skills?.goal_level > 0.1;
                  const chatQ =
                    typeof chatId === "number" ? `?chat_id=${chatId}` : "";
                  if (goalSelected) {
                    const qp = topic
                      ? `${chatQ}${chatQ ? "&" : "?"}topic=${encodeURIComponent(
                          topic
                        )}`
                      : chatQ;
                    navigate(`/tasks${qp}` as string, {
                      state: { item: it, chatId },
                    });
                  } else {
                    navigate(`/level-select${chatQ}` as string, {
                      state: { item: it, index: null, chatId },
                    });
                  }
                };
                return (
                  <div className={styles.modalContent}>
                    <img src={img} alt="" className={styles.modalHero} />
                    <button
                      className={styles.modalCloseTheme}
                      onClick={() => setRelatedTitle(null)}
                    >
                      ×
                    </button>
                    <div className={styles.modalHeader}>
                      <div>
                        <div className={styles.modalBreadcrumb}>Тема</div>
                        <div className={styles.modalTitle}>
                          {it?.title || "Тема"}
                        </div>
                      </div>
                    </div>
                    <div className={styles.modalMetaRow}>
                      <div className={styles.modalProgress}>
                        Готово{" "}
                        <span>
                          {done}/{total}
                        </span>
                      </div>
                      <div className={styles.modalGoalLevel}>
                        Целевой уровень темы:
                        <select
                          className={styles.goalSelect}
                          value={
                            gl === 2 || gl === 3 || gl === 4 ? String(gl) : ""
                          }
                          required
                          onChange={(e) => {
                            try {
                              const raw = Number(e.target.value);
                              const chosen: any =
                                raw === 2 || raw === 3 || raw === 4 ? raw : 0.1;
                              try {
                                setRelatedItem((prev: any) => ({
                                  ...(prev || it),
                                  skills: {
                                    ...((prev || it).skills || {}),
                                    goal_level: chosen,
                                  },
                                }));
                              } catch {}
                              setExpansions((prev) => ({ ...prev }));
                            } catch {}
                          }}
                        >
                          <option value="" disabled hidden>
                            Не выбран
                          </option>
                          <option value="2">⭐ Базовый</option>
                          <option value="3">⭐⭐ Уверенный</option>
                          <option value="4">⭐⭐⭐ Продвинутый</option>
                        </select>
                      </div>
                    </div>
                    {it?.description && (
                      <div className={styles.modalIntroText}>
                        {it.description}
                      </div>
                    )}
                    <div className={styles.modalActionsRow}>
                      <button
                        className={`${styles.modalCta} ${
                          relExtLoading ? styles.modalCtaLoading : ""
                        }`}
                        onClick={async () => {
                          try {
                            if (!relatedTitle) return;
                            if (typeof chatId !== "number") return;
                            setRelExtLoading(true);
                            const resp = await metaExtendNew(
                              chatId,
                              relatedTitle
                            );
                            if (resp && Array.isArray(resp.items)) {
                              setExpansions((prev) => {
                                const next = { ...(prev || {}) } as Record<
                                  string,
                                  string[]
                                >;
                                resp.items.forEach((x) => {
                                  if (x && typeof x.title === "string") {
                                    const list = Array.isArray(x.expansions)
                                      ? x.expansions
                                      : [];
                                    next[x.title] =
                                      x.title === relatedTitle
                                        ? list.slice(0, 3)
                                        : list;
                                  }
                                });
                                return next;
                              });
                            }
                          } catch {
                          } finally {
                            setRelExtLoading(false);
                          }
                        }}
                      >
                        {relExtLoading
                          ? "Загружаю…"
                          : "Посмотреть связанные темы"}
                      </button>
                      <button
                        className={styles.modalCtaSecondary}
                        onClick={() => goTasks()}
                      >
                        К заданиям
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
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

const TopicModal: React.FC<{
  item: any;
  filterLevel: "all" | 2 | 3 | 4;
  onClose: () => void;
  onGoTasks: () => void;
}> = ({ item, filterLevel, onClose, onGoTasks }) => {
  const levels = (item?.skills?.levels || []) as any[];
  const byLevel = new Map<number, any>();
  levels.forEach((l) => byLevel.set(l.level, l));
  const l2 = byLevel.get(2);
  const l3 = byLevel.get(3);
  const l4 = byLevel.get(4);
  const goalLvl = Math.round(Number(item?.skills?.goal_level || 0));
  const countL2 = splitBullets(l2?.description).length;
  const countL3 = splitBullets(l3?.description).length;
  const countL4 = splitBullets(l4?.description).length;
  const totalAll = countL2 + countL3 + countL4;
  const filteredTotal =
    filterLevel === "all"
      ? totalAll
      : filterLevel === 2
      ? countL2
      : filterLevel === 3
      ? countL2 + countL3
      : totalAll;
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalBreadcrumb}>Все задания</div>
            <div className={styles.modalTitle}>
              {item?.title || item?.skills?.name || "Тема"}
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.modalProgress}>
          Готово <span>0/{filteredTotal}</span>
        </div>
        {item?.description && (
          <div className={styles.modalIntro}>{item.description}</div>
        )}
        {(filterLevel === "all" ||
          filterLevel === 2 ||
          filterLevel === 3 ||
          filterLevel === 4) &&
          l2 && (
            <>
              <div className={styles.modalLevelTitle}>
                ⭐ Базовый уровень{" "}
                {goalLvl === 2 && (
                  <span className={styles.modalBadge}>Целевой</span>
                )}
              </div>
              <ul className={styles.modalList}>
                {splitBullets(l2?.description).map((t, i) => (
                  <li key={`l2-${i}`}>{t}</li>
                ))}
              </ul>
            </>
          )}
        {(filterLevel === "all" || filterLevel === 3 || filterLevel === 4) &&
          l3 && (
            <>
              <div className={styles.modalLevelTitle}>
                ⭐⭐ Уверенный уровень{" "}
                {goalLvl === 3 && (
                  <span className={styles.modalBadge}>Целевой</span>
                )}
              </div>
              <ul className={styles.modalList}>
                {splitBullets(l3?.description).map((t, i) => (
                  <li key={`l3-${i}`}>{t}</li>
                ))}
              </ul>
            </>
          )}
        {(filterLevel === "all" || filterLevel === 4) && l4 && (
          <>
            <div className={styles.modalLevelTitle}>
              ⭐⭐⭐ Продвинутый уровень{" "}
              {goalLvl === 4 && (
                <span className={styles.modalBadge}>Целевой</span>
              )}
            </div>
            <ul className={styles.modalList}>
              {splitBullets(l4?.description).map((t, i) => (
                <li key={`l4-${i}`}>{t}</li>
              ))}
            </ul>
          </>
        )}
        <div className={styles.modalFooter}>
          <button className={styles.modalCta} onClick={onGoTasks}>
            К заданиям
          </button>
        </div>
      </div>
    </div>
  );
};

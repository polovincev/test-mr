import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, Connection, Edge, Node, Handle, Position, NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import styles from "./index.module.css";

type TopicNodeData = {
  title: string;
  imageUrl?: string;
  handleSide?: "left" | "right";
};

const TopicNode: React.FC<NodeProps<TopicNodeData>> = ({ data }) => {
  const title = data?.title || "Тема";
  const imageUrl = data?.imageUrl || new URL("../../icon/profile.png", import.meta.url).href;
  const side: "left" | "right" = data?.handleSide || "left";
  const positionForHandles = side === "left" ? Position.Left : Position.Right;

  return (
    <div className={styles.topicNode}>
      <img src={imageUrl} alt="" className={styles.topicImage} />
      <div className={styles.topicContent}>
        <div className={styles.topicBadge}>Тема</div>
        <div className={styles.topicTitle}>{title}</div>
      </div>
      <Handle type="target" position={positionForHandles} className={styles.handleInvisible} />
      <Handle type="source" position={positionForHandles} className={styles.handleInvisible} />
    </div>
  );
};

const wrapperStyle: React.CSSProperties = { width: "100vw", height: "calc(100vh - 0px)" };

const My: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const trajectory = (location.state as any)?.trajectory as { items?: { title: string; image_url?: string }[] } | undefined;
  const [levelOpen, setLevelOpen] = useState(false);
  const [level, setLevel] = useState<"all" | 2 | 3 | 4>("all");
  const levelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!levelRef.current) return;
      if (!levelRef.current.contains(e.target as Node)) setLevelOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const nodeTypes = useMemo(() => ({ topic: TopicNode }), []);

  const defaultEdgeOptions = useMemo(() => ({
    type: "bezier",
    style: { stroke: "#37C5F0", strokeWidth: 3 },
  }), []);

  const computedNodes: Node<TopicNodeData>[] = useMemo(() => {
    const items = Array.isArray(trajectory?.items) && trajectory?.items?.length
      ? (trajectory?.items as any[]).map((it) => ({ title: String(it?.title || "Тема"), imageUrl: it?.image_url as string | undefined }))
      : [
          { title: "Наследственность и изменчивость организмов", imageUrl: new URL("../../icon/goal.png", import.meta.url).href },
          { title: "Молекулярные основы жизни", imageUrl: new URL("../../icon/profile.png", import.meta.url).href },
          { title: "Эволюционное учение", imageUrl: new URL("../../icon/profile.png", import.meta.url).href },
          { title: "Экосистемы и биосфера", imageUrl: new URL("../../icon/profile.png", import.meta.url).href },
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
        },
      });
    });
    return nodes;
  }, [trajectory]);

  const computedEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    const n = computedNodes.length;
    for (let i = 0; i < n - 1; i++) {
      edges.push({ id: `e${i + 1}-${i + 2}`, source: String(i + 1), target: String(i + 2), type: "bezier" });
    }
    return edges;
  }, [computedNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  return (
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background color="rgba(255, 255, 255, 0.6)" />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
};

export default My;


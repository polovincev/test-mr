import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

  const nodeTypes = useMemo(() => ({ topic: TopicNode }), []);

  const defaultEdgeOptions = useMemo(() => ({
    type: "bezier",
    style: { stroke: "#37C5F0", strokeWidth: 3 },
  }), []);

  const initialNodes: Node<TopicNodeData>[] = [
    {
      id: "1",
      type: "topic",
      position: { x: 100, y: 40 },
      data: {
        title: "Наследственность и изменчивость организмов",
        imageUrl: new URL("../../icon/goal.png", import.meta.url).href,
        handleSide: "right",
      },
    },
    { id: "2", type: "topic", position: { x: 780, y: 200 }, data: { title: "Молекулярные основы жизни", imageUrl: new URL("../../icon/profile.png", import.meta.url).href, handleSide: "left" } },
    { id: "3", type: "topic", position: { x: 100, y: 360 }, data: { title: "Эволюционное учение", imageUrl: new URL("../../icon/profile.png", import.meta.url).href, handleSide: "right" } },
    { id: "4", type: "topic", position: { x: 780, y: 520 }, data: { title: "Экосистемы и биосфера", imageUrl: new URL("../../icon/profile.png", import.meta.url).href, handleSide: "left" } },
  ];

  const initialEdges: Edge[] = [
    { id: "e1-2", source: "1", target: "2", type: "bezier" },
    { id: "e1-3", source: "2", target: "3", type: "bezier" },
    { id: "e2-4", source: "3", target: "4", type: "bezier" },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  return (
    <div className={styles.wrapper}>
      <button onClick={() => navigate("/")} className={styles.backButton}>
        ← Назад
      </button>
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
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default My;


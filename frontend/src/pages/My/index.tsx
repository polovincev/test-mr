import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, Connection, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";

const initialNodes: Node[] = [
  { id: "1", position: { x: 250, y: 5 }, data: { label: "Start" }, type: "input" },
  { id: "2", position: { x: 100, y: 100 }, data: { label: "Step A" } },
  { id: "3", position: { x: 400, y: 100 }, data: { label: "Step B" } },
  { id: "4", position: { x: 250, y: 200 }, data: { label: "Finish" }, type: "output" }
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e1-3", source: "1", target: "3" },
  { id: "e2-4", source: "2", target: "4" },
  { id: "e3-4", source: "3", target: "4" }
];

const wrapperStyle: React.CSSProperties = { width: "100vw", height: "calc(100vh - 0px)" };

const My: React.FC = () => {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  return (
    <div style={wrapperStyle}>
      <button
        onClick={() => navigate("/")}
        style={{ position: "fixed", top: 12, left: 12, zIndex: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
      >
        ← Назад
      </button>
      <div
        style={{
          position: "fixed",
          top: 60,
          left: 12,
          zIndex: 9,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
          gap: 12,
          maxWidth: 480,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              fontWeight: 600,
            }}
          >
            Основы кинематики
          </div>
        ))}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default My;


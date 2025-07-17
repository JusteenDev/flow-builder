import React, { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// 📌 Hierarchy layout function
function layoutTrace(trace) {
  const levels = {};
  const graph = {};

  for (const step of trace.steps) {
    if (!graph[step.id]) graph[step.id] = [];
    for (const next of step.next) {
      if (!graph[next]) graph[next] = [];
      graph[next].push(step.id); // reverse direction for hierarchy
    }
  }

  function assignLevel(id, level = 0) {
    if (levels[id] === undefined || levels[id] < level) {
      levels[id] = level;
      for (const parent of graph[id] || []) {
        assignLevel(parent, level + 1);
      }
    }
  }

  for (const step of trace.steps) {
    if (!graph[step.id] || graph[step.id].length === 0) {
      assignLevel(step.id, 0); // roots
    }
  }

  const yGap = 150;
  const xGap = 220;
  const levelMap = {};
  const nodeMap = {};

  for (const step of trace.steps) {
    const level = levels[step.id] || 0;
    if (!levelMap[level]) levelMap[level] = [];
    levelMap[level].push(step.id);
  }

  const nodes = [];
  const edges = [];

  for (const [level, ids] of Object.entries(levelMap)) {
    ids.forEach((id, index) => {
      const x = index * xGap;
      const y = level * yGap;
      nodes.push({
        id,
        data: { label: id },
        position: { x, y },
        sourcePosition: "bottom",
        targetPosition: "top",
        type: "default",
      });
      nodeMap[id] = true;
    });
  }

  for (const step of trace.steps) {
    for (const next of step.next) {
      if (nodeMap[step.id] && nodeMap[next]) {
        edges.push({
          id: `${step.id}->${next}`,
          source: step.id,
          target: next,
          animated: true,
        });
      }
    }
  }

  return { nodes, edges };
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const loadTrace = useCallback(async () => {
    try {
      const res = await fetch("/api/trace");
      const trace = await res.json();
      const { nodes, edges } = layoutTrace(trace);
      setNodes(nodes);
      setEdges(edges);
    } catch (err) {
      console.error("[flow] Failed to fetch trace:", err);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadTrace();

    const socket = new WebSocket(`ws://${location.host}`);

    socket.addEventListener("open", () => {
      console.log("[flow] WebSocket connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "custom" && msg.event === "flow:traceUpdate") {
          const { nodes, edges } = layoutTrace(msg.data);
          setNodes(nodes);
          setEdges(edges);
        }
      } catch (err) {
        console.error("[flow] Failed to handle WebSocket message:", err);
      }
    });

    socket.addEventListener("error", (e) => {
      console.error("[flow] WebSocket error:", e);
    });

    socket.addEventListener("close", () => {
      console.warn("[flow] WebSocket closed");
    });

    return () => socket.close();
  }, [loadTrace, setNodes, setEdges]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable={true}
        nodesConnectable={false}
        panOnScroll
        zoomOnScroll
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}

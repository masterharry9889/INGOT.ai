"use client";

import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { use } from 'react';
import { Type, Image as ImageIcon, Globe } from 'lucide-react';

import TextNode from '@/app/components/canvas-nodes/TextNode';
import ImageNode from '@/app/components/canvas-nodes/ImageNode';
import WebNode from '@/app/components/canvas-nodes/WebNode';

const nodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  webNode: WebNode,
};

export default function CanvasView() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('id'));
  }, []);

  const storageKey = projectId ? `ingot_canvas_${projectId}` : null;

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { savedNodes, savedEdges } = JSON.parse(saved);
        if (savedNodes) setNodes(savedNodes);
        if (savedEdges) setEdges(savedEdges);
      } catch (e) {
        console.error("Failed to parse canvas data");
      }
    }
    setIsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (isLoaded && storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ savedNodes: nodes, savedEdges: edges }));
    }
  }, [nodes, edges, isLoaded, storageKey]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [],
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: Date.now().toString(),
      type,
      position: { x: 250 + Math.random() * 100, y: 250 + Math.random() * 100 },
      data: {
        onChange: (val: any) => {
           setNodes(nds => nds.map(n => n.id === newNode.id ? { ...n, data: { ...n.data, url: val, text: val } } : n));
        },
        onDelete: (nodeId: string) => {
           setNodes(nds => nds.filter(n => n.id !== nodeId));
        }
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  useEffect(() => {
    if (isLoaded && nodes.length > 0) {
      let needsUpdate = false;
      const updatedNodes = nodes.map(n => {
        if (!n.data.onChange || !n.data.onDelete) {
           needsUpdate = true;
           return {
             ...n,
             data: {
               ...n.data,
               onChange: (val: any) => {
                 setNodes(currentNds => currentNds.map(cn => cn.id === n.id ? { ...cn, data: { ...cn.data, url: val, text: val } } : cn));
               },
               onDelete: (nodeId: string) => {
                 setNodes(currentNds => currentNds.filter(cn => cn.id !== nodeId));
               }
             }
           };
        }
        return n;
      });
      
      if (needsUpdate) {
          setNodes(updatedNodes);
      }
    }
  }, [isLoaded]);


  if (!projectId || !isLoaded) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="canvas-bg"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="rgba(255,255,255,0.1)" />
        <Controls style={{ bottom: '20px', left: '20px' }} />
      </ReactFlow>

      {/* Floating Toolbar */}
      <div className="glass" style={{ 
        position: 'absolute', 
        bottom: '2rem', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        display: 'flex', 
        gap: '1rem',
        padding: '0.5rem 1rem',
        borderRadius: '30px',
        zIndex: 100
      }}>
        <button className="notch-icon-btn" title="Add Text Note" onClick={() => addNode('textNode')}>
          <Type size={18} />
        </button>
        <button className="notch-icon-btn" title="Add Image Card" onClick={() => addNode('imageNode')}>
          <ImageIcon size={18} />
        </button>
        <button className="notch-icon-btn" title="Embed Web Page" onClick={() => addNode('webNode')}>
          <Globe size={18} />
        </button>
      </div>
    </div>
  );
}

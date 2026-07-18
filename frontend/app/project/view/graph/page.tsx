"use client";

import { useState, useEffect, useRef, useCallback, use } from 'react';
import dynamic from 'next/dynamic';
import { Edit3, X, Save, Trash2, Link as LinkIcon, GitMerge, MousePointer2 } from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

import { API_BASE_URL as API_BASE } from '@/lib/config';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

export default function GraphView() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('id'));
  }, []);
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Editor State
  const [editMode, setEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  const [panelOpen, setPanelOpen] = useState(false);
  
  // Interactive Tools
  const [connectSource, setConnectSource] = useState<any>(null);
  const [mergeSource, setMergeSource] = useState<any>(null);
  
  // Form State
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('');

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    setTimeout(updateDimensions, 100);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!projectId) return;

    fetch(`${API_BASE}/graph/${projectId}`)
      .then(res => res.json())
      .then(data => {
        const formattedData = {
          nodes: data.nodes.map((n: any) => ({ ...n, val: Math.sqrt(n.mention_count || 1) * 5 })),
          links: data.edges.map((e: any) => ({ ...e, source: e.source, target: e.target, label: e.type }))
        };
        setGraphData(formattedData as any);
      })
      .catch(console.error);

    const ws = new WebSocket(`${WS_BASE}/graph/live`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'graph.update') {
        const { project_id, nodes, edges } = msg.data;
        if (project_id && project_id !== projectId) return;
        
        setGraphData(prev => {
          const newNodes = [...prev.nodes];
          const newLinks = [...prev.links];
          
          nodes.forEach((n: any) => {
            const idx = newNodes.findIndex((existing: any) => existing.id === n.id);
            if (n.action === 'deleted') {
              if (idx >= 0) newNodes.splice(idx, 1);
            } else {
              const formatted = { ...n, val: Math.sqrt(n.mention_count || 1) * 5 };
              if (idx >= 0) newNodes[idx] = { ...newNodes[idx], ...formatted };
              else newNodes.push(formatted);
            }
          });
          
          edges.forEach((e: any) => {
            const idx = newLinks.findIndex((existing: any) => existing.id === e.id);
            if (e.action === 'deleted') {
              if (idx >= 0) newLinks.splice(idx, 1);
            } else {
              const formatted = { ...e, source: e.source, target: e.target, label: e.type };
              if (idx >= 0) newLinks[idx] = { ...newLinks[idx], ...formatted };
              else newLinks.push(formatted);
            }
          });
          
          // Filter out links that reference deleted nodes
          const validNodes = new Set(newNodes.map((n: any) => n.id));
          const validLinks = newLinks.filter((l: any) => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return validNodes.has(sourceId) && validNodes.has(targetId);
          });
          
          return { nodes: newNodes, links: validLinks };
        });
      }
    };
    
    return () => ws.close();
  }, [projectId]);

  const nodeColor = useCallback((node: any) => {
    if (connectSource?.id === node.id) return '#fbbf24'; // Warning yellow for selected source
    if (mergeSource?.id === node.id) return '#f87171'; // Red for merge source
    if (selectedNode?.id === node.id) return '#38bdf8'; // Highlight selected
    
    if (node.type === 'Concept') return '#6366f1';
    if (node.type === 'Person') return '#ec4899';
    if (node.type === 'Organization') return '#10b981';
    return '#94a3b8';
  }, [connectSource, mergeSource, selectedNode]);

  // --- API Actions ---
  
  const handleUpdateNode = async () => {
    if (!selectedNode) return;
    try {
      await fetch(`${API_BASE}/graph/node/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel, type: editType })
      });
      // WebSocket will update UI
      closePanel();
    } catch (err) {
      console.error(err);
      alert("Failed to update node");
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (!confirm("Are you sure you want to delete this node and all its connections?")) return;
    try {
      await fetch(`${API_BASE}/graph/node/${selectedNode.id}`, {
        method: 'DELETE'
      });
      closePanel();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMergeNodes = async (targetNode: any) => {
    if (!mergeSource || mergeSource.id === targetNode.id) return;
    if (!confirm(`Merge "${mergeSource.label}" into "${targetNode.label}"?`)) {
      setMergeSource(null);
      return;
    }
    try {
      await fetch(`${API_BASE}/graph/node/${mergeSource.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetNode.id })
      });
      setMergeSource(null);
      closePanel();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectNodes = async (targetNode: any) => {
    if (!connectSource || connectSource.id === targetNode.id) return;
    const relationType = prompt(`Enter relationship type from "${connectSource.label}" to "${targetNode.label}":`, "related_to");
    if (!relationType) {
      setConnectSource(null);
      return;
    }
    
    try {
      await fetch(`${API_BASE}/graph/edge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          source_id: connectSource.id,
          target_id: targetNode.id,
          relation_type: relationType
        })
      });
      setConnectSource(null);
      closePanel();
    } catch (err) {
      console.error(err);
    }
  };

  // --- UI Handlers ---

  const openPanel = (node: any) => {
    setSelectedNode(node);
    setEditLabel(node.label || '');
    setEditType(node.type || '');
    setPanelOpen(true);
    setConnectSource(null);
    setMergeSource(null);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelectedNode(null);
    setConnectSource(null);
    setMergeSource(null);
  };

  const onNodeClick = (node: any) => {
    if (editMode) {
      if (connectSource) {
        handleConnectNodes(node);
      } else if (mergeSource) {
        handleMergeNodes(node);
      } else {
        openPanel(node);
      }
    } else {
      console.log(node);
    }
  };

  const onBackgroundClick = () => {
    if (editMode) {
      if (connectSource || mergeSource) {
        setConnectSource(null);
        setMergeSource(null);
      } else {
        closePanel();
      }
    }
  };

  if (!projectId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', width: '100%', paddingTop: '4rem' }}>
      
      {/* Top Bar for Graph Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2rem' }}>
        <button 
          onClick={() => {
            setEditMode(!editMode);
            closePanel();
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', borderRadius: '8px',
            background: editMode ? 'var(--primary)' : 'var(--glass-bg)',
            border: `1px solid ${editMode ? 'var(--primary)' : 'var(--glass-border)'}`,
            color: 'white', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: editMode ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none'
          }}
        >
          {editMode ? <MousePointer2 size={18} /> : <Edit3 size={18} />}
          {editMode ? 'Exit Edit Mode' : 'Edit Graph'}
        </button>
      </div>

      {/* Editor State Banner */}
      {editMode && (connectSource || mergeSource) && (
        <div style={{
          position: 'absolute', top: '6rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          background: 'rgba(15, 17, 21, 0.9)', padding: '0.75rem 1.5rem', borderRadius: '24px',
          border: `1px solid ${connectSource ? '#fbbf24' : '#f87171'}`,
          color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)'
        }}>
          {connectSource ? <LinkIcon size={16} color="#fbbf24" /> : <GitMerge size={16} color="#f87171" />}
          <span>
            {connectSource ? `Select target node to connect with "${connectSource.label}"` : `Select target node to merge "${mergeSource.label}" into`}
          </span>
          <button 
            onClick={() => { setConnectSource(null); setMergeSource(null); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: '1rem', padding: '0.25rem' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Graph Container */}
      <div style={{ flex: 1, position: 'relative', margin: '1rem', borderRadius: '12px', overflow: 'hidden' }} className="glass" ref={containerRef}>
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel={(node: any) => `
            <div style="background: rgba(15, 17, 21, 0.9); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif;">
              <strong style="font-size: 14px;">${node.label || 'Unknown'}</strong><br/>
              <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${node.type}</span>
            </div>
          `}
          nodeColor={nodeColor}
          nodeRelSize={5}
          nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
            const label = node.label || '';
            const fontSize = Math.max(12 / globalScale, 1);
            
            const radius = 6;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            
            // Highlight styling
            if (node === selectedNode || node === connectSource || node === mergeSource) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            }
            
            ctx.fillStyle = nodeColor(node);
            ctx.fill();
            
            if (globalScale > 0.8) {
              ctx.font = `${fontSize}px Inter, Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillText(label, node.x, node.y + radius + 4);
            }
          }}
          nodePointerAreaPaint={(node: any, color: string, ctx: any) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkColor={() => '#94a3b8'}
          linkWidth={1.5}
          backgroundColor="transparent"
          onNodeHover={(node: any) => {
            if (containerRef.current) {
              containerRef.current.style.cursor = node ? (editMode ? 'cell' : 'pointer') : 'default';
            }
          }}
          onNodeClick={onNodeClick}
          onBackgroundClick={onBackgroundClick}
        />
        
        {/* Floating Node Editor Panel */}
        {editMode && panelOpen && selectedNode && (
          <div style={{
            position: 'absolute', top: '1rem', right: '1rem', width: '320px',
            background: 'rgba(15, 17, 21, 0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)', borderRadius: '16px',
            padding: '1.5rem', color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Edit Node</h3>
              <button onClick={closePanel} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Label</label>
              <input 
                type="text" 
                value={editLabel} 
                onChange={e => setEditLabel(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.75rem', borderRadius: '8px', color: 'white', fontSize: '0.95rem'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Type</label>
              <input 
                type="text" 
                value={editType} 
                onChange={e => setEditType(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.75rem', borderRadius: '8px', color: 'white', fontSize: '0.95rem'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleUpdateNode} style={{
                flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                background: 'var(--primary)', border: 'none', padding: '0.75rem', borderRadius: '8px',
                color: 'white', fontWeight: 600, cursor: 'pointer'
              }}>
                <Save size={16} /> Save
              </button>
              <button onClick={handleDeleteNode} style={{
                padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Trash2 size={16} />
              </button>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                onClick={() => { setConnectSource(selectedNode); setPanelOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', color: '#e2e8f0', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <LinkIcon size={16} color="#fbbf24" /> Create Connection...
              </button>
              <button 
                onClick={() => { setMergeSource(selectedNode); setPanelOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', color: '#e2e8f0', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <GitMerge size={16} color="#f87171" /> Merge Into...
              </button>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}

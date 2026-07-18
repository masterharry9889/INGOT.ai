"use client";

import { useState, useEffect } from 'react';
import { Plus, X, MessageSquare, ArrowRight, Upload, MessageCircle, Settings, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import { fetchApi } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  date: string;
  type: 'conversation' | 'upload';
}

export default function MainView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<'conversation' | 'upload'>('conversation');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('brainweb_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved projects");
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('brainweb_projects', JSON.stringify(projects));
    }
  }, [projects, isLoaded]);

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(projects.filter(p => p.id !== id));
    
    // Wipe isolated frontend state
    const chatsData = localStorage.getItem(`brainweb_chats_${id}`);
    if (chatsData) {
      try {
        const chats = JSON.parse(chatsData);
        chats.forEach((chat: any) => {
          localStorage.removeItem(`brainweb_chat_${id}_${chat.id}`);
        });
      } catch (err) {}
      localStorage.removeItem(`brainweb_chats_${id}`);
    }
    localStorage.removeItem(`brainweb_chat_${id}`); // Legacy
    localStorage.removeItem(`brainweb_canvas_nodes_${id}`);
    localStorage.removeItem(`brainweb_canvas_edges_${id}`);
    localStorage.removeItem(`brainweb_active_agents_${id}`);
    
    // Wipe backend resources
    try {
      await fetchApi(`${API_BASE_URL}/graph/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete backend graph for project", id, err);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    
    if (projectType === 'upload' && (!selectedFiles || selectedFiles.length === 0)) {
      alert("Please select at least one file to upload.");
      return;
    }
    
    setIsUploading(true);
    const newProjectId = Date.now().toString();
    const newProject: Project = {
      id: newProjectId,
      name: projectName,
      date: new Date().toLocaleDateString(),
      type: projectType
    };
    
    if (projectType === 'upload' && selectedFiles) {
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }
      
      try {
        const res = await fetch(`${API_BASE_URL}/project/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        const initialMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: `Please analyze these uploaded files and extract the knowledge graph entities:\n\n${data.text}`,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`brainweb_chats_${newProjectId}`, JSON.stringify([{ id: 'default', name: 'Default Chat' }]));
        localStorage.setItem(`brainweb_chat_${newProjectId}_default`, JSON.stringify([initialMessage]));
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed. Make sure the backend server is running.");
        setIsUploading(false);
        return;
      }
    } else {
      localStorage.setItem(`brainweb_chats_${newProjectId}`, JSON.stringify([{ id: 'default', name: 'Default Chat' }]));
    }
    
    setProjects([newProject, ...projects]);
    setProjectName('');
    setSelectedFiles(null);
    setIsModalOpen(false);
    setIsUploading(false);
    
    window.location.href = `./project/view/chat/index.html?id=${newProjectId}`;
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      width: '100%',
      alignItems: 'center',
      overflowY: 'auto',
      position: 'relative'
    }}>
      {/* Dashboard Minimal Header */}
      <header style={{ width: '100%', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="logo-small" style={{ fontSize: '1.5rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="./logo.webp" alt="BrainWeb Logo" style={{ height: '36px', width: 'auto', borderRadius: '8px' }} />
          BrainWeb
        </div>
        <a href="./settings/index.html" className="notch-icon-btn" style={{ background: 'transparent', margin: 0 }} title="Settings">
          <Settings size={20} />
        </a>
      </header>
      
      <div style={{ width: '100%', padding: '3rem 5%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Your Dashboard</h1>
        </div>

        {projects.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '6rem 2rem',
            background: 'var(--glass-bg)',
            border: '1px dashed rgba(255,255,255,0.2)',
            borderRadius: '16px',
            color: 'var(--text-secondary)'
          }}>
            <MessageSquare size={48} style={{ opacity: 0.5, marginBottom: '1.5rem' }} />
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No activity yet</h3>
            <p style={{ textAlign: 'center', maxWidth: '400px', marginBottom: '2rem' }}>
              Click the + button in the bottom corner to start a new independent conversation or upload a new project.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {projects.map(p => (
              <div 
                key={p.id} 
                onClick={() => window.location.href = `./project/view/chat/index.html?id=${p.id}`}
                className="glass" 
                style={{ 
                  padding: '1.5rem', 
                  cursor: 'pointer',
                  transition: 'transform 0.2s, background 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '1rem' }}>{p.name}</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      title="Delete Project"
                    >
                      <Trash2 size={18} />
                    </button>
                    {p.type === 'conversation' ? <MessageCircle size={20} color="var(--primary)" /> : <Upload size={20} color="var(--secondary)" />}
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span>Created {p.date}</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '3rem',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          color: 'white',
          border: 'none',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          zIndex: 50
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(236, 72, 153, 0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.4)';
        }}
      >
        <Plus size={32} />
      </button>

      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', animation: 'slideUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Create New</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div 
                onClick={() => setProjectType('conversation')}
                style={{ 
                  padding: '1.5rem 1rem', 
                  borderRadius: '12px', 
                  border: projectType === 'conversation' ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.1)',
                  background: projectType === 'conversation' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <MessageCircle size={32} color={projectType === 'conversation' ? 'var(--primary)' : 'var(--text-secondary)'} style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, color: projectType === 'conversation' ? 'white' : 'var(--text-secondary)' }}>Independent Conversation</div>
              </div>
              
              <div 
                onClick={() => setProjectType('upload')}
                style={{ 
                  padding: '1.5rem 1rem', 
                  borderRadius: '12px', 
                  border: projectType === 'upload' ? '2px solid var(--secondary)' : '2px solid rgba(255,255,255,0.1)',
                  background: projectType === 'upload' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={32} color={projectType === 'upload' ? 'var(--secondary)' : 'var(--text-secondary)'} style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, color: projectType === 'upload' ? 'white' : 'var(--text-secondary)' }}>Upload New Project</div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label className="input-label">Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder={projectType === 'conversation' ? "e.g. Chat with Codebase" : "e.g. Q3 Marketing Plan"}
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              />
            </div>
            
            {projectType === 'upload' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="input-label">Select Files to Analyze</label>
                <input 
                  type="file" 
                  multiple
                  onChange={e => setSelectedFiles(e.target.files)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'white'
                  }}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isUploading}>Cancel</button>
              <button className="btn" onClick={handleCreateProject} disabled={!projectName.trim() || isUploading}>
                {isUploading ? 'Uploading...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

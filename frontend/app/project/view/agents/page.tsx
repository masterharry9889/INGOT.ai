"use client";

import { useState, useEffect, use } from 'react';
import { Bot, Check, Search, Info } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

interface Agent {
  id: string;
  name: string;
  description: string;
}

export default function AgentsView() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('id'));
  }, []);
  const storageKey = projectId ? `ingot_active_agents_${projectId}` : null;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/agents`)
      .then(res => res.json())
      .then(data => {
        setAgents(data);
      })
      .catch(err => console.error("Failed to load agents", err));

    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setActiveAgents(JSON.parse(saved));
      } catch (e) {}
    }
    setIsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (isLoaded && storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(activeAgents));
    }
  }, [activeAgents, isLoaded, storageKey]);

  const toggleAgent = (agentId: string) => {
    setActiveAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  if (!projectId || !isLoaded) return null;

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      width: '100%', 
      paddingTop: '6rem',
      paddingLeft: '2rem',
      paddingRight: '2rem',
      overflowY: 'auto'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', paddingBottom: '4rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Bot size={36} color="var(--primary)" /> Agent Directory
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem' }}>
              Select the agents you want to actively listen and respond in this project.
            </p>
          </div>
          
          <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '30px', width: '300px' }}>
            <Search size={18} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search agents..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                paddingLeft: '0.5rem',
                fontFamily: 'inherit',
                fontSize: '0.95rem'
              }}
            />
          </div>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="glass" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
            <Info size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-secondary)' }} />
            <h3>No agents found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            {filteredAgents.map(agent => {
              const isActive = activeAgents.includes(agent.id);
              return (
                <div 
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className="glass"
                  style={{ 
                    padding: '1.5rem', 
                    display: 'flex', 
                    flexDirection: 'column',
                    cursor: 'pointer',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    transition: 'all 0.2s',
                    background: isActive ? 'rgba(99, 102, 241, 0.05)' : 'var(--glass-bg)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{agent.name}</h3>
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      border: isActive ? 'none' : '2px solid var(--text-secondary)',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {isActive && <Check size={14} color="white" />}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {agent.description}
                  </p>
                  
                  {isActive && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--primary)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

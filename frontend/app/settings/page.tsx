"use client";

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { API_BASE_URL as API_BASE } from '@/lib/config';

export default function SettingsView() {
  const [settings, setSettings] = useState({ provider: 'anthropic', api_key: '', model_name: 'claude-3-5-sonnet-20240620' });
  const [maskedKey, setMaskedKey] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  
  const [customAgents, setCustomAgents] = useState<any[]>([]);
  const [newAgent, setNewAgent] = useState({ id: '', name: '', description: '', system_prompt: '' });

  const [settingsList, setSettingsList] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSettingsList(data);
          // Pre-fill the form with the first provider or leave default
        }
      })
      .catch(console.error);
      
    loadAgents();
  }, []);

  const loadAgents = () => {
    fetch(`${API_BASE}/agents`)
      .then(res => res.json())
      .then(data => {
        setCustomAgents(data);
      })
      .catch(console.error);
  };

  const handleSaveSettings = async () => {
    try {
      setSaveStatus('Saving...');
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      
      // Refresh the list
      const updatedRes = await fetch(`${API_BASE}/settings`);
      const data = await updatedRes.json();
      if (Array.isArray(data)) setSettingsList(data);
      
      setSettings({ ...settings, api_key: '' });
      setSaveStatus('Saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e: any) {
      setSaveStatus(e.message);
    }
  };

  const handleCreateAgent = async () => {
    try {
      const payload = {
        ...newAgent,
        tools: [],
        input_schema: { query: "string" },
        output_schema: { entities: "array", summary: "string" }
      };
      
      const res = await fetch(`${API_BASE}/agents/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create agent');
      setNewAgent({ id: '', name: '', description: '', system_prompt: '' });
      loadAgents();
    } catch (e) {
      alert(e);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      const res = await fetch(`${API_BASE}/agents/custom/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete agent (might be built-in)');
      loadAgents();
    } catch (e) {
      alert(e);
    }
  };

  const handleEditSettings = (s: any) => {
    setSettings({
      provider: s.provider,
      model_name: s.model_name,
      api_key: '' // Leave blank so user doesn't see raw string, but they can enter a new one
    });
    setMaskedKey(s.api_key_masked);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: '2rem 5%', height: '100%', overflowY: 'auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <a href="../../index.html" className="notch-icon-btn" title="Back to Dashboard" style={{ margin: 0 }}>
          <ArrowLeft size={20} />
        </a>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Settings Panel */}
        <div className="glass" style={{ padding: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            LLM Settings
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label className="input-label">Provider</label>
              <select 
                className="input-field"
                value={settings.provider}
                onChange={e => setSettings({...settings, provider: e.target.value})}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            
            <div>
              <label className="input-label">Model Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={settings.model_name}
                onChange={e => setSettings({...settings, model_name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="input-label">API Key</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder={maskedKey && settings.provider === settingsList.find(s => s.provider === settings.provider)?.provider ? `Current: ${maskedKey}` : "sk-..."}
                value={settings.api_key}
                onChange={e => setSettings({...settings, api_key: e.target.value})}
              />
              <small style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                API keys are encrypted at rest using Fernet symmetric encryption.
              </small>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn" onClick={handleSaveSettings}>
                <Save size={18} /> Save Settings
              </button>
              {saveStatus && <span style={{ color: saveStatus.includes('Error') ? 'var(--error)' : 'var(--success)' }}>{saveStatus}</span>}
            </div>
          </div>
          
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>Saved Configurations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {settingsList.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No configurations saved.</div>}
            {settingsList.map((s, idx) => (
              <div key={idx} style={{ background: '#000000', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.provider}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Model: {s.model_name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Key: {s.api_key_masked}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handleEditSettings(s)}
                    style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to delete the saved API key for ${s.provider}?`)) return;
                      try {
                        const res = await fetch(`${API_BASE}/settings/${s.provider}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('Failed to delete setting');
                        const updatedRes = await fetch(`${API_BASE}/settings`);
                        setSettingsList(await updatedRes.json());
                        if (settings.provider === s.provider) {
                          setMaskedKey('');
                        }
                      } catch (e) {
                        alert(e);
                      }
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Custom Agents Panel */}
        <div className="glass" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Agent Registry</h2>
          
          <div style={{ background: '#000000', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Create Custom Agent</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input-field" placeholder="ID (e.g. support-agent)" value={newAgent.id} onChange={e => setNewAgent({...newAgent, id: e.target.value})} />
              <input className="input-field" placeholder="Name" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} />
              <input className="input-field" placeholder="Description" value={newAgent.description} onChange={e => setNewAgent({...newAgent, description: e.target.value})} />
              <textarea className="input-field" placeholder="System Prompt" value={newAgent.system_prompt} onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})} rows={3} />
              <button className="btn btn-secondary" onClick={handleCreateAgent} style={{ alignSelf: 'flex-start' }}>
                <Plus size={18} /> Create Agent
              </button>
            </div>
          </div>
          
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Available Agents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {customAgents.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.id}</div>
                </div>
                <button 
                  onClick={() => handleDeleteAgent(a.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  title="Delete Agent (Custom only)"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
}

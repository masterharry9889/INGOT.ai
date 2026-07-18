"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CursorTrackingLink from '@/app/components/CursorTrackingLink';

import { API_BASE_URL as API_BASE } from '@/lib/config';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

interface Agent {
  id: string;
  name: string;
  description: string;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  status?: 'streaming' | 'finished' | 'error';
  agentName?: string;
  parsedData?: any;
}

export default function ChatView() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('id'));
  }, []);

  const router = useRouter();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [chats, setChats] = useState<{id: string, name: string}[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('default');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState<string>('');

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize and load chats
  useEffect(() => {
    if (!projectId) return;
    
    const newChatsKey = `brainweb_chats_${projectId}`;
    const legacyKey = `brainweb_chat_${projectId}`;
    
    const savedChats = localStorage.getItem(newChatsKey);
    let currentChats = [{ id: 'default', name: 'Default Chat' }];
    
    if (savedChats) {
      try {
        currentChats = JSON.parse(savedChats);
      } catch (e) {}
    } else {
      // Migration check
      const legacyData = localStorage.getItem(legacyKey);
      if (legacyData) {
        localStorage.setItem(`brainweb_chat_${projectId}_default`, legacyData);
      }
      localStorage.setItem(newChatsKey, JSON.stringify(currentChats));
    }
    
    setChats(currentChats);
    if (currentChats.length > 0) {
      setActiveChatId(currentChats[0].id);
    }
    setIsLoaded(true);
  }, [projectId]);

  // Persist chats array
  useEffect(() => {
    if (!projectId || !isLoaded) return;
    localStorage.setItem(`brainweb_chats_${projectId}`, JSON.stringify(chats));
  }, [chats, isLoaded, projectId]);

  const storageKey = projectId && activeChatId ? `brainweb_chat_${projectId}_${activeChatId}` : '';

  // Load messages for the active chat
  useEffect(() => {
    if (!storageKey || !isLoaded) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cleaned = parsed.map((m: Message) => 
          m.status === 'streaming' ? { ...m, status: 'error', content: m.content + '\n[Connection interrupted]' } : m
        );
        setMessages(cleaned);
      } catch (e) {
        console.error("Failed to parse saved chat history");
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [storageKey, isLoaded, activeChatId]);

  // Save messages for the active chat
  useEffect(() => {
    if (!storageKey) return;
    if (isLoaded) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, isLoaded, storageKey]);

  useEffect(() => {
    fetch(`${API_BASE}/agents`)
      .then(res => res.json())
      .then(data => {
        setAgents(data);
      })
      .catch(err => console.error("Failed to load agents", err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewChat = () => {
    const newChatId = Date.now().toString();
    const newChatName = `New Chat ${chats.length + 1}`;
    setChats([...chats, { id: newChatId, name: newChatName }]);
    setActiveChatId(newChatId);
    setEditingChatId(newChatId);
    setEditingChatName(newChatName);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newChats = chats.filter(c => c.id !== id);
    if (newChats.length === 0) {
      const newDefault = { id: Date.now().toString(), name: 'Default Chat' };
      setChats([newDefault]);
      setActiveChatId(newDefault.id);
    } else {
      setChats(newChats);
      if (activeChatId === id) {
        setActiveChatId(newChats[0].id);
      }
    }
    localStorage.removeItem(`brainweb_chat_${projectId}_${id}`);
  };

  const startRenameChat = (chat: {id: string, name: string}, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingChatName(chat.name);
  };

  const saveRenameChat = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    if (!editingChatName.trim()) {
      setEditingChatId(null);
      return;
    }
    setChats(chats.map(c => c.id === editingChatId ? { ...c, name: editingChatName.trim() } : c));
    setEditingChatId(null);
  };

  const handleSend = async () => {
    const activeAgentsKey = `brainweb_active_agents_${projectId}`;
    const savedAgents = localStorage.getItem(activeAgentsKey);
    let activeAgentsToRun: string[] = [];
    if (savedAgents) {
      try {
        activeAgentsToRun = JSON.parse(savedAgents);
      } catch (e) {}
    }
    
    if (activeAgentsToRun.length === 0) {
       if (agents.length > 0) {
         activeAgentsToRun = [agents[0].id];
       } else {
         alert("Cannot connect to the backend server. Please make sure your API server is running (uvicorn backend.main:app) and refresh the page.");
         return; 
       }
    }

    if (!input.trim() || isProcessing) return;

    const userMsgId = Date.now().toString();
    const orchestratorMsgId = `${Date.now() + 1}`;
    
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: input },
      { 
        id: orchestratorMsgId, 
        role: 'agent', 
        content: '', 
        status: 'streaming', 
        agentName: 'Orchestrator' 
      }
    ]);
    
    const currentInput = input;
    setInput('');
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: "orchestrator-agent",
          project_id: projectId,
          input: { 
            query: currentInput,
            sub_agents: activeAgentsToRun
          } 
        })
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error("API Key not configured. Please configure it in the Dashboard.");
        throw new Error(`Failed to start orchestrator-agent`);
      }

      const { run_id } = await res.json();
      const ws = new WebSocket(`${WS_BASE}/runs/${run_id}`);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'run.token') {
          setMessages(prev => prev.map(msg => 
            msg.id === orchestratorMsgId ? { ...msg, content: msg.content + data.data.token } : msg
          ));
        } else if (data.type === 'run.finished') {
          setMessages(prev => prev.map(msg => 
            msg.id === orchestratorMsgId ? { 
              ...msg, 
              status: 'finished',
              parsedData: data.data.output
            } : msg
          ));
          ws.close();
          setIsProcessing(false);
        } else if (data.type === 'run.error') {
          setMessages(prev => prev.map(msg => 
            msg.id === orchestratorMsgId ? { ...msg, status: 'error', content: msg.content + `\n\nError: ${data.data.error}` } : msg
          ));
          ws.close();
          setIsProcessing(false);
        }
      };
      
      ws.onerror = () => {
        setMessages(prev => prev.map(msg => 
          msg.id === orchestratorMsgId && msg.status === 'streaming' ? { ...msg, status: 'error', content: msg.content + '\n\nWebSocket connection error' } : msg
        ));
      };
      
      ws.onclose = () => {
        setMessages(prev => {
          const isStillStreaming = prev.some(msg => msg.id === orchestratorMsgId && msg.status === 'streaming');
          if (isStillStreaming) {
             setIsProcessing(false);
             return prev.map(msg => msg.id === orchestratorMsgId && msg.status === 'streaming' ? { ...msg, status: 'error', content: msg.content + '\n\n[Connection closed unexpectedly]' } : msg);
          }
          return prev;
        });
      };

    } catch (error: any) {
      setMessages(prev => prev.map(msg => 
        msg.id === orchestratorMsgId ? { ...msg, status: 'error', content: error.message } : msg
      ));
      setIsProcessing(false);
    }
  };

  if (!projectId) return null;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', paddingTop: '5rem' }}>
      
      {/* Sidebar for multiple chats */}
      <div className="sidebar" style={{ width: '260px', borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', padding: '1.5rem', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontFamily: 'Outfit', fontWeight: 600, color: 'white' }}>Chats</h2>
          <button className="notch-icon-btn" style={{ margin: 0, width: '32px', height: '32px' }} onClick={createNewChat} title="New Chat">
            <Plus size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {chats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChatId(chat.id)}
              style={{ 
                padding: '0.75rem', 
                borderRadius: '8px', 
                background: activeChatId === chat.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                borderLeft: activeChatId === chat.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              onMouseEnter={(e) => { if(activeChatId !== chat.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if(activeChatId !== chat.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {editingChatId === chat.id ? (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                  <input 
                    autoFocus
                    value={editingChatName}
                    onChange={(e) => setEditingChatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRenameChat(e)}
                    onBlur={() => saveRenameChat()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, width: '100%', background: '#000', border: '1px solid var(--primary)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', outline: 'none', fontSize: '0.9rem' }}
                  />
                  <button onClick={saveRenameChat} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: 0 }}><Check size={16} /></button>
                </div>
              ) : (
                <>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500, fontSize: '0.95rem' }}>
                    {chat.name}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', opacity: activeChatId === chat.id ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                    <button onClick={(e) => startRenameChat(chat, e)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.1rem' }} title="Rename">
                      <Edit2 size={14} style={{ transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'} />
                    </button>
                    <button onClick={(e) => deleteChat(chat.id, e)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.1rem' }} title="Delete">
                      <Trash2 size={14} style={{ transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-container" style={{ flex: 1, padding: '2rem 10%', height: 'calc(100vh - 5rem)', position: 'relative' }}>
        <div className="chat-messages" style={{ height: 'calc(100% - 80px)' }}>
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Bot size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h3>Select an agent and start chatting</h3>
            </div>
          )}
          
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className={`avatar ${msg.role}`}>
                {msg.role === 'user' ? <User size={20} color="white" /> : <Bot size={20} color="white" />}
              </div>
              <div className="message-bubble">
                <div className={`markdown-body ${msg.role}`}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: CursorTrackingLink
                    }}
                  >
                    {msg.content.replace(/```json[\s\S]*?```/g, '').trim()}
                  </ReactMarkdown>
                </div>
                {msg.role === 'agent' && msg.status === 'streaming' && (
                  <span style={{ display: 'inline-block', width: '8px', height: '16px', background: 'var(--primary)', marginLeft: '4px', animation: 'pulse 1s infinite' }} />
                )}
                {msg.parsedData && msg.parsedData.entities && msg.parsedData.entities.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <strong>Extracted Entities:</strong>
                    <ul style={{ margin: '0.5rem 0 0 1.5rem' }}>
                      {msg.parsedData.entities.map((e: any, i: number) => (
                        <li key={i}>{e.label} <span style={{ color: 'var(--text-secondary)' }}>({e.type})</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ position: 'absolute', bottom: '2rem', left: '10%', right: '10%' }}>
          <input 
            type="text" 
            className="chat-input" 
            placeholder="Type your request here..." 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isProcessing}
          />
          <button 
            className="send-btn" 
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL as API_BASE } from '@/lib/config';
const WS_BASE = API_BASE.replace(/^http/, 'ws');
import ChatSidebar from '@/app/components/ChatSidebar';
import ChatMessageArea from '@/app/components/ChatMessageArea';
import { Message, Chat } from '@/lib/types';
import styles from './chat.module.css';

interface Agent {
  id: string;
  name: string;
  description: string;
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
    setChats(prev => {
      const newChats = prev.map(c => c.id === editingChatId ? { ...c, name: editingChatName.trim() } : c);
      localStorage.setItem(`brainweb_chats_${projectId}`, JSON.stringify(newChats));
      return newChats;
    });
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

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessages(prev => prev.map(msg => 
        msg.id === orchestratorMsgId ? { ...msg, status: 'error', content: errorMessage } : msg
      ));
      setIsProcessing(false);
    }
  };

  if (!projectId) return null;

  return (
    <div className={styles.chatPageContainer}>
      
      <ChatSidebar 
        chats={chats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        editingChatId={editingChatId}
        editingChatName={editingChatName}
        setEditingChatName={setEditingChatName}
        saveRenameChat={saveRenameChat}
        startRenameChat={startRenameChat}
        deleteChat={deleteChat}
        createNewChat={createNewChat}
      />
      <ChatMessageArea 
        messages={messages}
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isProcessing={isProcessing}
        messagesEndRef={messagesEndRef}
      />
    </div>
  );
}

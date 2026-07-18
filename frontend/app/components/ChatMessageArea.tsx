import React from 'react';
import { Send, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CursorTrackingLink from '@/app/components/CursorTrackingLink';
import styles from '../project/view/chat/chat.module.css';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  status?: 'streaming' | 'finished' | 'error';
  agentName?: string;
  parsedData?: any;
}

interface ChatMessageAreaProps {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  handleSend: () => void;
  isProcessing: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatMessageArea({
  messages,
  input,
  setInput,
  handleSend,
  isProcessing,
  messagesEndRef
}: ChatMessageAreaProps) {
  return (
    <div className={`chat-container ${styles.chatContainer}`}>
      <div className={`chat-messages ${styles.chatMessages}`}>
        {messages.length === 0 && (
          <div className={styles.emptyChatState}>
            <Bot size={48} className={styles.emptyChatIcon} />
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
                <span className={styles.streamingIndicator} />
              )}
              {msg.parsedData && msg.parsedData.entities && msg.parsedData.entities.length > 0 && (
                <div className={styles.entitiesContainer}>
                  <strong>Extracted Entities:</strong>
                  <ul className={styles.entitiesList}>
                    {msg.parsedData.entities.map((e: any, i: number) => (
                      <li key={i}>{e.label} <span className={styles.entityType}>({e.type})</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={`chat-input-area ${styles.chatInputArea}`}>
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
  );
}

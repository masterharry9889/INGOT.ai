import React from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import styles from '../project/view/chat/chat.module.css';

export interface Chat {
  id: string;
  name: string;
}

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  editingChatId: string | null;
  editingChatName: string;
  setEditingChatName: (name: string) => void;
  saveRenameChat: (e?: React.MouseEvent | React.KeyboardEvent) => void;
  startRenameChat: (chat: Chat, e: React.MouseEvent) => void;
  deleteChat: (id: string, e: React.MouseEvent) => void;
  createNewChat: () => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  setActiveChatId,
  editingChatId,
  editingChatName,
  setEditingChatName,
  saveRenameChat,
  startRenameChat,
  deleteChat,
  createNewChat
}: ChatSidebarProps) {
  return (
    <div className={`sidebar ${styles.sidebar}`}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Chats</h2>
        <button className={`notch-icon-btn ${styles.newChatBtn}`} onClick={createNewChat} title="New Chat">
          <Plus size={18} />
        </button>
      </div>
      <div className={styles.chatList}>
        {chats.map(chat => (
          <div 
            key={chat.id} 
            onClick={() => setActiveChatId(chat.id)}
            className={`${styles.chatItem} ${activeChatId === chat.id ? styles.chatItemActive : ''}`}
          >
            {editingChatId === chat.id ? (
              <div className={styles.editChatContainer}>
                <input 
                  autoFocus
                  value={editingChatName}
                  onChange={(e) => setEditingChatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRenameChat(e)}
                  onBlur={() => saveRenameChat()}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.editChatInput}
                />
                <button onClick={saveRenameChat} className={styles.editChatConfirmBtn}><Check size={16} /></button>
              </div>
            ) : (
              <>
                <div className={styles.chatItemName}>
                  {chat.name}
                </div>
                <div className={styles.chatItemActions} style={{ opacity: activeChatId === chat.id ? 1 : 0.5 }}>
                  <button onClick={(e) => startRenameChat(chat, e)} className={styles.actionBtn} title="Rename">
                    <Edit2 size={14} className={styles.actionIconEdit} />
                  </button>
                  <button onClick={(e) => deleteChat(chat.id, e)} className={styles.actionBtn} title="Delete">
                    <Trash2 size={14} className={styles.actionIconDelete} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

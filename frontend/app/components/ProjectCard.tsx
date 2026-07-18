import React from 'react';
import { Trash2, MessageCircle, Upload, ArrowRight } from 'lucide-react';
import styles from '../page.module.css';

export interface Project {
  id: string;
  name: string;
  date: string;
  type: 'conversation' | 'upload';
}

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export default function ProjectCard({ project: p, onDelete }: ProjectCardProps) {
  return (
    <div 
      onClick={() => window.location.href = `./project/view/chat/index.html?id=${p.id}`}
      className={`glass ${styles.card}`}
    >
      <div className={styles.cardTop}>
        <h3 className={styles.cardTitle}>{p.name}</h3>
        <div className={styles.cardActions}>
          <button 
            onClick={(e) => onDelete(p.id, e)}
            className={styles.deleteBtn}
            title="Delete Project"
          >
            <Trash2 size={18} />
          </button>
          {p.type === 'conversation' ? <MessageCircle size={20} color="var(--primary)" /> : <Upload size={20} color="var(--secondary)" />}
        </div>
      </div>
      <div className={styles.cardBottom}>
        <span>Created {p.date}</span>
        <ArrowRight size={16} />
      </div>
    </div>
  );
}

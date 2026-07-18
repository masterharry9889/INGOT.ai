import React from 'react';
import { X, MessageCircle, Upload } from 'lucide-react';
import styles from '../page.module.css';

interface CreateProjectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (val: boolean) => void;
  projectType: 'conversation' | 'upload';
  setProjectType: (val: 'conversation' | 'upload') => void;
  projectName: string;
  setProjectName: (val: string) => void;
  setSelectedFiles: (files: FileList | null) => void;
  handleCreateProject: () => void;
  isUploading: boolean;
}

export default function CreateProjectModal({
  isModalOpen,
  setIsModalOpen,
  projectType,
  setProjectType,
  projectName,
  setProjectName,
  setSelectedFiles,
  handleCreateProject,
  isUploading
}: CreateProjectModalProps) {
  if (!isModalOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={`glass ${styles.modalContent}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create New</h2>
          <button 
            onClick={() => setIsModalOpen(false)}
            className={styles.closeBtn}
          >
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.typeGrid}>
          <div 
            onClick={() => setProjectType('conversation')}
            className={`${styles.typeCard} ${projectType === 'conversation' ? styles.typeCardConversationActive : ''}`}
          >
            <MessageCircle size={32} color={projectType === 'conversation' ? 'var(--primary)' : 'var(--text-secondary)'} className={styles.typeIcon} />
            <div className={`${styles.typeLabel} ${projectType === 'conversation' ? styles.typeLabelActive : ''}`}>Independent Conversation</div>
          </div>
          
          <div 
            onClick={() => setProjectType('upload')}
            className={`${styles.typeCard} ${projectType === 'upload' ? styles.typeCardUploadActive : ''}`}
          >
            <Upload size={32} color={projectType === 'upload' ? 'var(--secondary)' : 'var(--text-secondary)'} className={styles.typeIcon} />
            <div className={`${styles.typeLabel} ${projectType === 'upload' ? styles.typeLabelActive : ''}`}>Upload New Project</div>
          </div>
        </div>

        <div className={styles.formGroup}>
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
          <div className={styles.formGroup}>
            <label className="input-label">Select Files to Analyze</label>
            <input 
              type="file" 
              multiple
              onChange={e => setSelectedFiles(e.target.files)}
              className={styles.fileInput}
            />
          </div>
        )}
        
        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isUploading}>Cancel</button>
          <button className="btn" onClick={handleCreateProject} disabled={!projectName.trim() || isUploading}>
            {isUploading ? 'Uploading...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

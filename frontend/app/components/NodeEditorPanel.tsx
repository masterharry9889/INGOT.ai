import React from 'react';
import { X, Save, Trash2, Link as LinkIcon, GitMerge } from 'lucide-react';
import styles from '../project/view/graph/graph.module.css';

interface NodeEditorPanelProps {
  editMode: boolean;
  panelOpen: boolean;
  selectedNode: any;
  closePanel: () => void;
  editLabel: string;
  setEditLabel: (val: string) => void;
  editType: string;
  setEditType: (val: string) => void;
  handleUpdateNode: () => void;
  handleDeleteNode: () => void;
  setConnectSource: (node: any) => void;
  setMergeSource: (node: any) => void;
  setPanelOpen: (val: boolean) => void;
}

export default function NodeEditorPanel({
  editMode,
  panelOpen,
  selectedNode,
  closePanel,
  editLabel,
  setEditLabel,
  editType,
  setEditType,
  handleUpdateNode,
  handleDeleteNode,
  setConnectSource,
  setMergeSource,
  setPanelOpen
}: NodeEditorPanelProps) {
  if (!editMode || !panelOpen || !selectedNode) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Edit Node</h3>
        <button onClick={closePanel} className={styles.closePanelBtn}><X size={18} /></button>
      </div>
      
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Label</label>
        <input 
          type="text" 
          value={editLabel} 
          onChange={e => setEditLabel(e.target.value)}
          className={styles.formInput}
        />
      </div>
      
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Type</label>
        <input 
          type="text" 
          value={editType} 
          onChange={e => setEditType(e.target.value)}
          className={styles.formInput}
        />
      </div>
      
      <div className={styles.actionRow}>
        <button onClick={handleUpdateNode} className={styles.saveBtn}>
          <Save size={16} /> Save
        </button>
        <button onClick={handleDeleteNode} className={styles.deleteBtn}>
          <Trash2 size={16} />
        </button>
      </div>
      
      <hr className={styles.divider} />
      
      <div className={styles.connectionRow}>
        <button 
          onClick={() => { setConnectSource(selectedNode); setPanelOpen(false); }}
          className={styles.connectionBtn}
        >
          <LinkIcon size={16} color="#fbbf24" /> Create Connection...
        </button>
        <button 
          onClick={() => { setMergeSource(selectedNode); setPanelOpen(false); }}
          className={styles.connectionBtn}
        >
          <GitMerge size={16} color="#f87171" /> Merge Into...
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { Plus, X, MessageSquare, ArrowRight, Upload, MessageCircle, Settings, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import { fetchApi } from '@/lib/api';

import DashboardHeader from './components/DashboardHeader';
import ProjectCard from './components/ProjectCard';
import { Project, Chat } from '@/lib/types';
import CreateProjectModal from './components/CreateProjectModal';
import styles from './page.module.css';

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
        chats.forEach((chat: Chat) => {
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
    
    setProjects(prev => {
      const newProjects = [newProject, ...prev];
      localStorage.setItem('brainweb_projects', JSON.stringify(newProjects));
      return newProjects;
    });
    setProjectName('');
    setSelectedFiles(null);
    setIsModalOpen(false);
    setIsUploading(false);
    
    router.push(`/project/view/chat?id=${newProjectId}`);
  };

  return (
    <div className={styles.mainContainer}>
      {/* Dashboard Minimal Header */}
      <DashboardHeader />
      
      <div className={styles.dashboardContent}>
        <div className={styles.dashboardHeaderRow}>
          <h1 className={styles.dashboardTitle}>Your Dashboard</h1>
        </div>

        {projects.length === 0 ? (
          <div className={styles.emptyStateContainer}>
            <MessageSquare size={48} className={styles.emptyStateIcon} />
            <h3 className={styles.emptyStateTitle}>No activity yet</h3>
            <p className={styles.emptyStateText}>
              Click the + button in the bottom corner to start a new independent conversation or upload a new project.
            </p>
          </div>
        ) : (
          <div className={styles.projectsGrid}>
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onDelete={handleDeleteProject} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className={styles.fab}
      >
        <Plus size={32} />
      </button>

      <CreateProjectModal 
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        projectType={projectType}
        setProjectType={setProjectType}
        projectName={projectName}
        setProjectName={setProjectName}
        setSelectedFiles={setSelectedFiles}
        handleCreateProject={handleCreateProject}
        isUploading={isUploading}
      />
    </div>
  );
}

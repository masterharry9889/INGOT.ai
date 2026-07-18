import { Settings } from 'lucide-react';
import styles from '../page.module.css';

export default function DashboardHeader() {
  return (
    <header className={styles.header}>
      <div className={`logo-small ${styles.logoContainer}`}>
        <img src="./logo.webp" alt="BrainWeb Logo" className={styles.logoImg} />
        BrainWeb
      </div>
      <a href="./settings/index.html" className={`notch-icon-btn ${styles.settingsBtn}`} title="Settings">
        <Settings size={20} />
      </a>
    </header>
  );
}

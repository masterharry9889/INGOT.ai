const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // icon: path.join(__dirname, 'icon.ico') // Optional: Add if icon exists
  });

  // Load the static export of Next.js
  const frontendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'index.html')
    : path.join(__dirname, '..', 'frontend', 'out', 'index.html');
    
  mainWindow.loadFile(frontendPath);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'brainweb-backend.exe' : 'brainweb-backend';

    const backendPath = app.isPackaged 
      ? path.join(process.resourcesPath, binaryName)
      : path.join(__dirname, '..', 'backend', 'dist', binaryName);

    console.log("Starting backend at:", backendPath);
    
    backendProcess = spawn(backendPath, [], { detached: false });

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend process.', err);
      reject(err);
    });

    // Simple polling to check when backend is up
    let retries = 0;
    const interval = setInterval(() => {
      http.get('http://127.0.0.1:8000/docs', (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', (err) => {
        retries++;
        if (retries > 30) { // Wait up to 15 seconds
          clearInterval(interval);
          reject(new Error("Backend timeout"));
        }
      });
    }, 500);
  });
}

app.on('ready', async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    console.error("Failed to initialize app:", err);
    app.quit();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log("Killing backend process...");
    if (process.platform === 'win32') {
      const killProcess = spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      killProcess.on('close', () => {
        console.log("Backend process killed on Windows.");
      });
    } else {
      backendProcess.kill();
      console.log("Backend process killed on Unix.");
    }
  }
});

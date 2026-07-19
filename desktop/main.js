const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
let mainWindow;
let backendProcess;
let loadURL;

const serve = require('electron-serve');

const directory = app.isPackaged 
  ? path.join(process.resourcesPath, 'app') 
  : path.join(__dirname, '..', 'frontend', 'out');

loadURL = serve({ directory });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    // icon: path.join(__dirname, 'icon.ico') // Optional: Add if icon exists
  });

  // Load the static export using the pre-configured electron-serve
  loadURL(mainWindow);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'brainweb-backend.exe' : 'brainweb-backend';

    if (app.isPackaged) {
      const backendPath = path.join(process.resourcesPath, binaryName);
      console.log("Starting packaged backend at:", backendPath);
      backendProcess = spawn(backendPath, [], { 
        cwd: path.dirname(backendPath),
        detached: false,
        env: { ...process.env, PARENT_PID: String(process.pid) }
      });
    } else {
      const pythonPath = isWin 
        ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', 'venv', 'bin', 'python');
      const mainPyPath = path.join(__dirname, '..', 'backend', 'main.py');
      console.log("Starting dev backend using python at:", mainPyPath);
      backendProcess = spawn(pythonPath, [mainPyPath], { 
        cwd: path.join(__dirname, '..', 'backend'),
        detached: false,
        env: { ...process.env, PARENT_PID: String(process.pid) }
      });
    }

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

    backendProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Backend process exited unexpectedly with code ${code}. Check backend logs or missing dependencies.`));
      }
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
        if (retries > 120) { // Wait up to 60 seconds
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
    dialog.showErrorBox('Startup Failed', `Backend failed to start:\n${err.message}`);
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

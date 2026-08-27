const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

async function startBackend() {
  process.env.DEALFLOW_DATA_DIR = app.getPath("userData");
  try {
    const response = await fetch("http://127.0.0.1:8787/api/health", { signal: AbortSignal.timeout(1200) });
    const data = await response.json();
    if (response.ok && data?.service === "投研项目工作台本地服务") return;
  } catch {}
  await import(pathToFileURL(path.join(__dirname, "..", "local-server.mjs")).href);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#ffffff",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "desktop-dist", "index.html"));
}

ipcMain.handle("choose-workspace", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"], title: "选择项目总文件夹" });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("open-output", async (_event, filePath) => shell.openPath(String(filePath)));
ipcMain.handle("reveal-output", async (_event, filePath) => shell.showItemInFolder(String(filePath)));

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  try {
    await startBackend();
    createWindow();
  } catch (error) {
    dialog.showErrorBox("本地服务启动失败", error instanceof Error ? error.message : String(error));
    app.quit();
  }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

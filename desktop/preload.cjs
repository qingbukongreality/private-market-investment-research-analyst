const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dealflowDesktop", {
  chooseWorkspace: () => ipcRenderer.invoke("choose-workspace"),
  openOutput: (filePath) => ipcRenderer.invoke("open-output", filePath),
  revealOutput: (filePath) => ipcRenderer.invoke("reveal-output", filePath),
  isDesktop: true,
});

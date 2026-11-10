import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { randomInt } from "node:crypto";
import { createLocalServer, getLocalAddresses, type GestureName } from "./server";
import { executeShortcut, type ShortcutAction } from "./shortcuts";

let mainWindow: BrowserWindow | null = null;
let targetPath: string | null = null;
const pin = String(randomInt(100000, 999999));

const actionByGesture: Record<GestureName, ShortcutAction> = {
  "three-finger-swipe-up": "command-palette",
  "two-finger-tap": "save",
  "pinch-in": "undo",
  "pinch-out": "command-palette"
};

const localServer = createLocalServer(pin, {
  onGesture: async (gesture) => {
    if (!targetPath) throw new Error("Choisis d’abord une application sur l’ordinateur.");
    await executeShortcut(targetPath, actionByGesture[gesture]);
  }
});

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: "#101114",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadURL("http://localhost:5173");
  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("desktop:get-info", () => ({
  addresses: getLocalAddresses(),
  port: localServer.port,
  pin,
  targetPath
}));

ipcMain.handle("desktop:choose-application", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choisir une application Windows",
    properties: ["openFile"],
    filters: [{ name: "Applications Windows", extensions: ["exe"] }]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  targetPath = result.filePaths[0];
  return targetPath;
});

ipcMain.handle("desktop:set-target", (_event, value: unknown) => {
  targetPath = typeof value === "string" && value.length > 0 ? value : null;
});

app.whenReady().then(async () => {
  await localServer.start();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("before-quit", () => {
  void localServer.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

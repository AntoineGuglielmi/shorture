import { app, BrowserWindow, ipcMain } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomInt } from "node:crypto";
import { createLocalServer, getLocalAddresses } from "./server";
import { activateApplication, executeApplicationShortcut, executeWindowsShortcut, getForegroundProcessName, getInstalledApplications } from "./shortcuts";
import { createDefaultConfig, parseConfig } from "./config";
import type { GestureName, InstalledApplication, ShortcutFailure, ShortureConfig } from "./types";

let mainWindow: BrowserWindow | null = null;
let installedApplications: InstalledApplication[] = [];
let config: ShortureConfig = { globalCommands: [], contextApps: [] };
const pin = String(randomInt(100000, 999999));
const configPath = () => path.join(app.getPath("userData"), "shorture.config.json");

async function loadConfig(): Promise<void> {
  installedApplications = await getInstalledApplications();
  try {
    const stored = await readFile(configPath(), "utf8");
    config = parseConfig(JSON.parse(stored) as unknown, installedApplications);
  } catch {
    config = createDefaultConfig(installedApplications);
    await saveConfig(config);
  }
}

async function saveConfig(value: ShortureConfig): Promise<void> {
  const folder = app.getPath("userData");
  await mkdir(folder, { recursive: true });
  await writeFile(configPath(), JSON.stringify(value, null, 2), "utf8");
  config = value;
}

function getBindingLabel(gesture: GestureName): string {
  const global = config.globalCommands.find((item) => item.gesture === gesture);
  if (global?.action.type === "activate-application") {
    return "activate-" + (installedApplications.find((app) => app.id === global.action.applicationId)?.name ?? "application");
  }
  if (global?.action.type === "windows-shortcut") return global.action.shortcut;
  for (const context of config.contextApps) {
    const command = context.commands.find((item) => item.gesture === gesture);
    if (command?.action.type === "keyboard-shortcut") return context.application.name + " · " + command.action.shortcut;
  }
  return "unconfigured";
}

const localServer = createLocalServer(pin, {
  onGesture: async (gesture) => {
    const globalCommand = config.globalCommands.find((command) => command.gesture === gesture);
    if (globalCommand) {
      if (globalCommand.action.type === "activate-application") {
        const application = installedApplications.find((item) => item.id === globalCommand.action.applicationId);
        if (!application) throw new Error("L’application cible n’est plus disponible.");
        await activateApplication(application);
        return;
      }
      if (globalCommand.action.type === "windows-shortcut") {
        await executeWindowsShortcut(globalCommand.action.shortcut);
        return;
      }
    }

    const processName = await getForegroundProcessName();
    const activeContext = config.contextApps.find((context) =>
      context.application.processName.toLowerCase() === processName
    );
    if (!activeContext) {
      throw new Error("Aucune contextapp configurée ne correspond à la fenêtre active.");
    }
    const command = activeContext.commands.find((item) => item.gesture === gesture);
    if (!command) throw new Error("Aucune commande n’est configurée pour ce geste dans " + activeContext.application.name + ".");
    if (command.action.type === "keyboard-shortcut") {
      await executeApplicationShortcut(activeContext.application, command.action.shortcut);
      return;
    }
    throw new Error("Fonctionnalité non prise en charge dans ce contexte.");
  },
  onError: (gesture, error) => {
    const failure: ShortcutFailure = {
      gesture,
      action: getBindingLabel(gesture),
      message: error instanceof Error ? error.message : "Erreur inconnue.",
      details: error instanceof Error && error.stack ? error.stack : String(error),
      occurredAt: new Date().toISOString()
    };
    mainWindow?.webContents.send("desktop:shortcut-error", failure);
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
  config,
  installedApplications
}));

ipcMain.handle("desktop:save-config", async (_event, value: unknown) => {
  const parsed = parseConfig(value, installedApplications);
  await saveConfig(parsed);
  return parsed;
});

app.whenReady().then(async () => {
  await loadConfig();
  await localServer.start();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("before-quit", () => { void localServer.stop(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

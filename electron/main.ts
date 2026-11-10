import { app, BrowserWindow, ipcMain } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomInt } from "node:crypto";
import { createLocalServer, getLocalAddresses } from "./server";
import { activateApplication, executeApplicationShortcut, getForegroundApplication } from "./shortcuts";
import { createDefaultConfig, parseConfig } from "./config";
import type { GestureName, ShortcutFailure, ShortureConfig } from "./types";

let mainWindow: BrowserWindow | null = null;
let config: ShortureConfig = createDefaultConfig();
const pin = String(randomInt(100000, 999999));
const configPath = () => path.join(app.getPath("userData"), "shorture.config.json");

async function loadConfig(): Promise<void> {
  try {
    const stored = await readFile(configPath(), "utf8");
    config = parseConfig(JSON.parse(stored) as unknown);
  } catch {
    config = createDefaultConfig();
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
  const binding = config.bindings.find((item) => item.gesture === gesture && item.scope.type === "global");
  if (binding?.action.type === "activate-application") return "activate-" + binding.action.application;
  const appBinding = config.bindings.find((item) => item.gesture === gesture && item.scope.type === "application");
  if (appBinding?.action.type === "keyboard-shortcut") return appBinding.action.shortcut;
  return "unconfigured";
}

const localServer = createLocalServer(pin, {
  onGesture: async (gesture) => {
    const globalBinding = config.bindings.find((binding) =>
      binding.scope.type === "global" && binding.gesture === gesture
    );

    if (globalBinding) {
      if (globalBinding.action.type === "activate-application") {
        await activateApplication(globalBinding.action.application);
        return;
      }
      throw new Error("Cette action globale n’est pas encore prise en charge.");
    }

    const activeApplication = await getForegroundApplication();
    if (!activeApplication) {
      throw new Error("Aucune application cible reconnue n’est actuellement au premier plan.");
    }

    const binding = config.bindings.find((item) =>
      item.scope.type === "application" &&
      item.scope.application === activeApplication &&
      item.gesture === gesture
    );

    if (!binding) {
      throw new Error("Aucune action n’est configurée pour ce geste dans " + activeApplication + ".");
    }

    if (binding.action.type === "keyboard-shortcut") {
      await executeApplicationShortcut(activeApplication, binding.action.shortcut);
      return;
    }

    throw new Error("Type d’action non pris en charge.");
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
  config
}));

ipcMain.handle("desktop:save-config", async (_event, value: unknown) => {
  const parsed = parseConfig(value);
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

app.on("before-quit", () => {
  void localServer.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

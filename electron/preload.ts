import { contextBridge, ipcRenderer } from "electron";
import type { DesktopInfo, ShortcutFailure, ShortureConfig } from "./types";

contextBridge.exposeInMainWorld("shorture", {
  getDesktopInfo: (): Promise<DesktopInfo> => ipcRenderer.invoke("desktop:get-info"),
  chooseApplication: (): Promise<string | null> => ipcRenderer.invoke("desktop:choose-application"),
  saveConfig: (config: ShortureConfig): Promise<ShortureConfig> => ipcRenderer.invoke("desktop:save-config", config),
  onShortcutError: (callback: (failure: ShortcutFailure) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, failure: ShortcutFailure) => callback(failure);
    ipcRenderer.on("desktop:shortcut-error", listener);
    return () => ipcRenderer.removeListener("desktop:shortcut-error", listener);
  }
});
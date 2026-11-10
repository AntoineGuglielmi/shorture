import { contextBridge, ipcRenderer } from "electron";

export type DesktopInfo = {
  addresses: string[];
  port: number;
  pin: string;
  targetPath: string | null;
};

contextBridge.exposeInMainWorld("shorture", {
  getDesktopInfo: (): Promise<DesktopInfo> => ipcRenderer.invoke("desktop:get-info"),
  chooseApplication: (): Promise<string | null> => ipcRenderer.invoke("desktop:choose-application"),
  setTargetPath: (targetPath: string | null): Promise<void> =>
    ipcRenderer.invoke("desktop:set-target", targetPath)
});

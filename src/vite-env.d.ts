/// <reference types="vite/client" />

import type { DesktopInfo } from "../electron/preload";

declare global {
  interface Window {
    shorture: {
      getDesktopInfo: () => Promise<DesktopInfo>;
      chooseApplication: () => Promise<string | null>;
      setTargetPath: (targetPath: string | null) => Promise<void>;
    };
  }
}

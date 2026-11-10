/// <reference types="vite/client" />

import type { DesktopInfo, ShortcutFailure, ShortureConfig } from "../electron/types";

declare global {
  interface Window {
    shorture: {
      getDesktopInfo: () => Promise<DesktopInfo>;
      saveConfig: (config: ShortureConfig) => Promise<ShortureConfig>;
      onShortcutError: (callback: (failure: ShortcutFailure) => void) => () => void;
    };
  }
}
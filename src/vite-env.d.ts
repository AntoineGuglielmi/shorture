/// <reference types="vite/client" />

import type { DesktopInfo, ShortcutFailure } from "../electron/types";

declare global {
  interface Window {
    shorture: {
      getDesktopInfo: () => Promise<DesktopInfo>;
      chooseApplication: () => Promise<string | null>;
      setTargetPath: (targetPath: string | null) => Promise<void>;
      onShortcutError: (callback: (failure: ShortcutFailure) => void) => () => void;
    };
  }
}
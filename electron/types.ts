export type GestureName =
  | "one-finger-tap"
  | "two-finger-tap"
  | "two-finger-swipe-left"
  | "two-finger-swipe-right"
  | "two-finger-swipe-up"
  | "two-finger-swipe-down"
  | "pinch-in"
  | "pinch-out";

export type InstalledApplication = {
  id: string;
  name: string;
  executablePath: string;
  arguments: string;
  processName: string;
};

export type GestureAction =
  | { type: "activate-application"; applicationId: string }
  | { type: "windows-shortcut"; shortcut: string }
  | { type: "keyboard-shortcut"; shortcut: string };

export type GestureCommand = {
  id: string;
  fingers: 1 | 2;
  gesture: GestureName;
  action: GestureAction;
};

export type ContextApp = {
  id: string;
  application: InstalledApplication;
  commands: GestureCommand[];
};

export type ShortureConfig = {
  globalCommands: GestureCommand[];
  contextApps: ContextApp[];
};

export type DesktopInfo = {
  addresses: string[];
  port: number;
  pin: string;
  config: ShortureConfig;
  installedApplications: InstalledApplication[];
};

export type ShortcutFailure = {
  gesture: GestureName;
  action: string;
  message: string;
  details: string;
  occurredAt: string;
};

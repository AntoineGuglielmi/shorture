export type GestureName =
  | "two-finger-tap"
  | "two-finger-swipe-left"
  | "two-finger-swipe-right"
  | "two-finger-swipe-up"
  | "two-finger-swipe-down"
  | "pinch-in"
  | "pinch-out";
export type ShortcutAction =
  | "command-palette"
  | "save"
  | "undo"
  | "activate-vscode"
  | "activate-phpstorm"
  | "activate-chrome"
  | "activate-teams";

export type DesktopInfo = {
  addresses: string[];
  port: number;
  pin: string;
  targetPath: string | null;
};

export type ShortcutFailure = {
  gesture: GestureName;
  action: ShortcutAction;
  message: string;
  details: string;
  occurredAt: string;
};
export type GestureName = "two-finger-tap" | "three-finger-swipe-up" | "pinch-in" | "pinch-out";
export type ShortcutAction = "command-palette" | "open-terminal" | "save" | "undo";

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
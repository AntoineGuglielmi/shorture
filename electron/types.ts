export type TargetApplication = "vscode" | "phpstorm" | "chrome" | "teams";

export type GestureName =
  | "two-finger-tap"
  | "two-finger-swipe-left"
  | "two-finger-swipe-right"
  | "two-finger-swipe-up"
  | "two-finger-swipe-down"
  | "pinch-in"
  | "pinch-out";

export type GestureScope =
  | { type: "global" }
  | { type: "application"; application: TargetApplication };

export type GestureAction =
  | { type: "activate-application"; application: TargetApplication }
  | { type: "keyboard-shortcut"; shortcut: string };

export type GestureBinding = {
  id: string;
  fingers: 2;
  gesture: GestureName;
  scope: GestureScope;
  action: GestureAction;
};

export type ShortureConfig = {
  bindings: GestureBinding[];
};

export type DesktopInfo = {
  addresses: string[];
  port: number;
  pin: string;
  targetPath: string | null;
  config: ShortureConfig;
};

export type ShortcutFailure = {
  gesture: GestureName;
  action: string;
  message: string;
  details: string;
  occurredAt: string;
};

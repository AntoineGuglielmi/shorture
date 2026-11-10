import type { GestureName, InstalledApplication, ShortureConfig } from "./types";

export const gestures: Array<{ id: GestureName; label: string; fingers: 1 | 2 }> = [
  { id: "one-finger-tap", label: "Tap", fingers: 1 },
  { id: "two-finger-tap", label: "Tap", fingers: 2 },
  { id: "two-finger-swipe-left", label: "Glisser à gauche", fingers: 2 },
  { id: "two-finger-swipe-right", label: "Glisser à droite", fingers: 2 },
  { id: "two-finger-swipe-up", label: "Glisser vers le haut", fingers: 2 },
  { id: "two-finger-swipe-down", label: "Glisser vers le bas", fingers: 2 },
  { id: "pinch-in", label: "Pincer (rapprocher)", fingers: 2 },
  { id: "pinch-out", label: "Pincer (écarter)", fingers: 2 }
];

export function createDefaultConfig(installed: InstalledApplication[] = []): ShortureConfig {
  const vscode = installed.find((item) => /^(code|code-insiders)$/i.test(item.processName) ||
    /visual studio code/i.test(item.name));
  if (!vscode) return { globalCommands: [], contextApps: [] };

  return {
    globalCommands: [{
      id: crypto.randomUUID(),
      fingers: 2,
      gesture: "two-finger-swipe-left",
      action: { type: "activate-application", applicationId: vscode.id }
    }],
    contextApps: [{
      id: crypto.randomUUID(),
      application: vscode,
      commands: [{
        id: randomUUID(),
        fingers: 1,
        gesture: "one-finger-tap",
        action: { type: "keyboard-shortcut", shortcut: "Ctrl+N" }
      }]
    }]
  };
}

const validShortcut = (shortcut: unknown): shortcut is string =>
  typeof shortcut === "string" &&
  shortcut.length <= 40 &&
  /^(Ctrl|Alt|Shift)(\+(Ctrl|Alt|Shift))*\+([A-Za-z0-9])$/i.test(shortcut);

export function parseConfig(value: unknown, installed: InstalledApplication[]): ShortureConfig {
  if (!value || typeof value !== "object") throw new Error("Configuration invalide.");
  const candidate = value as Partial<ShortureConfig>;
  if (!Array.isArray(candidate.globalCommands) || !Array.isArray(candidate.contextApps)) {
    throw new Error("Structure de configuration invalide.");
  }
  if (candidate.globalCommands.length > 100 || candidate.contextApps.length > 100) {
    throw new Error("La configuration contient trop d’éléments.");
  }

  const installedById = new Map(installed.map((item) => [item.id, item]));
  const ids = new Set<string>();
  const normalizeCommands = (commands: unknown, scope: "global" | "application") => {
    if (!Array.isArray(commands)) throw new Error("Liste de commandes invalide.");
    const gesturesSeen = new Set<string>();
    return commands.map((raw) => {
      const command = raw as ShortureConfig["globalCommands"][number];
      if (!command || typeof command.id !== "string" || !command.id.trim() || ids.has(command.id)) {
        throw new Error("Identifiant de commande invalide ou dupliqué.");
      }
      ids.add(command.id);
      const definition = gestures.find((item) => item.id === command.gesture);
      if (!definition || command.fingers !== definition.fingers) {
        throw new Error("Cette combinaison de doigts et ce geste ne sont pas pris en charge.");
      }
      if (gesturesSeen.has(command.gesture)) throw new Error("Ce geste est déjà utilisé dans ce contexte.");
      gesturesSeen.add(command.gesture);

      if (scope === "global" && command.action?.type === "activate-application") {
        if (typeof command.action.applicationId !== "string" || !installedById.has(command.action.applicationId)) {
          throw new Error("Application cible introuvable.");
        }
      } else if (command.action?.type === "windows-shortcut" && scope === "global") {
        if (!validShortcut(command.action.shortcut)) throw new Error("Raccourci Windows invalide.");
      } else if (command.action?.type === "keyboard-shortcut" && scope === "application") {
        if (!validShortcut(command.action.shortcut)) throw new Error("Raccourci clavier invalide.");
      } else {
        throw new Error("Cette fonctionnalité n’est pas autorisée dans ce contexte.");
      }
      return { ...command };
    });
  };

  const contextIds = new Set<string>();
  const contextApps = candidate.contextApps.map((context) => {
    if (!context || typeof context.id !== "string" || !context.id.trim() || contextIds.has(context.id)) {
      throw new Error("Contextapp invalide ou dupliquée.");
    }
    contextIds.add(context.id);
    const application = installedById.get(context.application?.id);
    if (!application) throw new Error("Une application configurée n’est plus disponible.");
    return {
      id: context.id,
      application,
      commands: normalizeCommands(context.commands, "application")
    };
  });

  return {
    globalCommands: normalizeCommands(candidate.globalCommands, "global"),
    contextApps
  };
}

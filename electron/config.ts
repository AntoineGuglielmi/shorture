import type { GestureName, ShortureConfig, TargetApplication } from "./types";

export const applications: Array<{ id: TargetApplication; label: string }> = [
  { id: "vscode", label: "Visual Studio Code" },
  { id: "phpstorm", label: "PhpStorm" },
  { id: "chrome", label: "Chrome" },
  { id: "teams", label: "Microsoft Teams" }
];

export const gestures: Array<{ id: GestureName; label: string }> = [
  { id: "two-finger-tap", label: "Tap à deux doigts" },
  { id: "two-finger-swipe-left", label: "Glisser à gauche" },
  { id: "two-finger-swipe-right", label: "Glisser à droite" },
  { id: "two-finger-swipe-up", label: "Glisser vers le haut" },
  { id: "two-finger-swipe-down", label: "Glisser vers le bas" },
  { id: "pinch-in", label: "Pincer (rapprocher)" },
  { id: "pinch-out", label: "Pincer (écarter)" }
];

export function createDefaultConfig(): ShortureConfig {
  const bindings: ShortureConfig["bindings"] = [
    ["two-finger-swipe-left", "vscode"],
    ["two-finger-swipe-up", "phpstorm"],
    ["two-finger-swipe-right", "chrome"],
    ["two-finger-swipe-down", "teams"]
  ].map(([gesture, application]) => ({
    id: `global-${gesture}`,
    fingers: 2,
    gesture: gesture as GestureName,
    scope: { type: "global" as const },
    action: { type: "activate-application" as const, application: application as TargetApplication }
  }));

  for (const application of applications) {
    bindings.push(
      {
        id: `${application.id}-tap`,
        fingers: 2,
        gesture: "two-finger-tap",
        scope: { type: "application", application: application.id },
        action: { type: "keyboard-shortcut", shortcut: "Ctrl+S" }
      },
      {
        id: `${application.id}-undo`,
        fingers: 2,
        gesture: "pinch-in",
        scope: { type: "application", application: application.id },
        action: { type: "keyboard-shortcut", shortcut: "Ctrl+Z" }
      },
      {
        id: `${application.id}-palette`,
        fingers: 2,
        gesture: "pinch-out",
        scope: { type: "application", application: application.id },
        action: { type: "keyboard-shortcut", shortcut: "Ctrl+Shift+P" }
      }
    );
  }

  return { bindings };
}

const applicationIds = applications.map(({ id }) => id);
const gestureIds = gestures.map(({ id }) => id);

export function parseConfig(value: unknown): ShortureConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as ShortureConfig).bindings)) {
    throw new Error("Configuration invalide.");
  }

  const bindings = (value as ShortureConfig).bindings;
  if (bindings.length > 100) throw new Error("La configuration contient trop d’associations.");

  const ids = new Set<string>();
  const normalized: ShortureConfig["bindings"] = [];

  for (const binding of bindings) {
    if (!binding || typeof binding !== "object" || typeof binding.id !== "string" || !binding.id.trim()) {
      throw new Error("Une association ne possède pas d’identifiant valide.");
    }
    if (ids.has(binding.id)) throw new Error("Deux associations possèdent le même identifiant.");
    ids.add(binding.id);

    if (binding.fingers !== 2 || !gestureIds.includes(binding.gesture)) {
      throw new Error("Cette combinaison de doigts ou ce geste n’est pas encore pris en charge.");
    }

    if (binding.scope?.type !== "global" && (
      binding.scope?.type !== "application" || !applicationIds.includes(binding.scope.application)
    )) {
      throw new Error("Contexte d’application invalide.");
    }

    if (binding.action?.type === "activate-application") {
      if (!applicationIds.includes(binding.action.application) || binding.scope.type !== "global") {
        throw new Error("L’activation d’une fenêtre est réservée aux gestes globaux.");
      }
    } else if (binding.action?.type === "keyboard-shortcut") {
      if (binding.scope.type !== "application" || typeof binding.action.shortcut !== "string" ||
        !/^(Ctrl|Alt|Shift)(\\+(Ctrl|Alt|Shift))*\\+[A-Za-z0-9]+$/i.test(binding.action.shortcut) ||
        binding.action.shortcut.length > 40) {
        throw new Error("Raccourci clavier invalide.");
      }
    } else {
      throw new Error("Type d’action non pris en charge.");
    }

    normalized.push({
      id: binding.id,
      fingers: 2,
      gesture: binding.gesture,
      scope: binding.scope,
      action: binding.action
    });
  }

  const keys = new Set<string>();
  for (const binding of normalized) {
    const context = binding.scope.type === "global" ? "global" : binding.scope.application;
    const key = `${context}:${binding.gesture}`;
    if (keys.has(key)) throw new Error("Un même geste ne peut être associé qu’une fois dans un même contexte.");
    keys.add(key);
  }

  return { bindings: normalized };
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export type ShortcutAction = "command-palette" | "save" | "undo";

const keySequences: Record<ShortcutAction, string> = {
  "command-palette": "^+p",
  save: "^s",
  undo: "^z"
};

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Windows-only first prototype.
 * Uses WScript.Shell to focus the selected process and SendKeys to dispatch
 * a small, explicit allow-list of shortcuts. No arbitrary shell command is accepted.
 */
export async function executeShortcut(executablePath: string, action: ShortcutAction): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("L'exécution des raccourcis est actuellement disponible uniquement sous Windows.");
  }

  const processName = path.basename(executablePath, path.extname(executablePath));
  const safeName = escapePowerShell(processName);
  const safePath = escapePowerShell(executablePath);
  const keys = keySequences[action];

  if (!keys) {
    throw new Error("Raccourci non pris en charge.");
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$name = '" + safeName + "'",
    "$target = '" + safePath + "'",
    "$process = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "if (-not $process) { Start-Process -FilePath $target | Out-Null; Start-Sleep -Milliseconds 1400; $process = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }",
    "if (-not $process) { throw 'Impossible de trouver la fenêtre de l’application.' }",
    "$shell = New-Object -ComObject WScript.Shell",
    "if (-not $shell.AppActivate($process.Id)) { throw 'Impossible d’activer la fenêtre de l’application.' }",
    "Start-Sleep -Milliseconds 180",
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.SendKeys]::SendWait('" + keys + "')"
  ].join("; ");

  const encoded = Buffer.from(script, "utf16le").toString("base64");
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-EncodedCommand", encoded
  ], { windowsHide: true, timeout: 10000 });
}

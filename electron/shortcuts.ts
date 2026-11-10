import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { ShortcutAction } from "./types";

const execFileAsync = promisify(execFile);

const keySequences: Record<ShortcutAction, string[]> = {
  "command-palette": ["^+p"],
  "open-terminal": ["^+p", "Terminal: Create New Terminal", "{ENTER}"],
  save: ["^s"],
  undo: ["^z"]
};

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

/** Windows-only shortcut dispatch using an explicit allow-list of key sequences. */
export async function executeShortcut(executablePath: string, action: ShortcutAction): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Shortcut execution is currently available on Windows only.");
  }

  const processName = path.basename(executablePath, path.extname(executablePath));
  const safeName = escapePowerShell(processName);
  const safePath = escapePowerShell(executablePath);
  const keys = keySequences[action];
  if (!keys) throw new Error("Unsupported shortcut.");

  const sendKeys = keys.map((sequence, index) => {
    const wait = index === 0 && keys.length > 1 ? "Start-Sleep -Milliseconds 250\r\n" : "";
    return wait + "[System.Windows.Forms.SendKeys]::SendWait('" + escapePowerShell(sequence) + "')";
  }).join("\r\n");

  // Keep the script multiline: joining PowerShell block delimiters with semicolons
  // can produce parser errors around try/catch and localized strings.
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    "  $name = '" + safeName + "'",
    "  $target = '" + safePath + "'",
    "  $process = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "  if (-not $process) {",
    "    Start-Process -FilePath $target | Out-Null",
    "    Start-Sleep -Milliseconds 1400",
    "    $process = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "  }",
    "  if (-not $process) { throw 'Target application window was not found.' }",
    "  $shell = New-Object -ComObject WScript.Shell",
    "  if (-not $shell.AppActivate($process.Id)) { throw 'Could not activate the target application window.' }",
    "  Start-Sleep -Milliseconds 180",
    "  Add-Type -AssemblyName System.Windows.Forms",
    sendKeys,
    "} catch {",
    "  [Console]::Error.WriteLine($_.Exception.ToString())",
    "  exit 1",
    "}"
  ].join("\r\n");

  const encoded = Buffer.from(script, "utf16le").toString("base64");
  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded
    ], { windowsHide: true, timeout: 10000 });
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const details = processError.stderr?.trim() || processError.stdout?.trim() || processError.message || "Unknown PowerShell error.";
    throw new Error(`Shortcut "${action}" failed: ${details}`);
  }
}

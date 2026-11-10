import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TargetApplication } from "./types";

const execFileAsync = promisify(execFile);

const processNames: Record<TargetApplication, string[]> = {
  vscode: ["Code"],
  phpstorm: ["phpstorm64", "phpstorm"],
  chrome: ["chrome"],
  teams: ["ms-teams", "Teams"]
};

export async function activateApplication(application: TargetApplication, toggleIfFocused = true): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Application activation is currently available on Windows only.");
  }

  const candidates = processNames[application].map((name) => "'" + escapePowerShell(name) + "'").join(", ");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    "  Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class ShortureWindowApi {",
    "  [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
    "  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    "  [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern bool IsZoomed(IntPtr hWnd);",
    "}",
    "'@",
    "  $names = @(" + candidates + ")",
    "  $process = Get-Process -Name $names -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "  if (-not $process) { throw 'No open window was found for " + application + ".' }",
    "  $handle = [IntPtr]$process.MainWindowHandle",
    "  $wasMinimized = [ShortureWindowApi]::IsIconic($handle)",
    "  $wasAlreadyForeground = ([ShortureWindowApi]::GetForegroundWindow() -eq $handle)",
    "  if ($wasMinimized) {",
    "    [ShortureWindowApi]::ShowWindowAsync($handle, 9) | Out-Null",
    "  } elseif ($wasAlreadyForeground -and " + (toggleIfFocused ? "true" : "false") + ") {",
    "    if ([ShortureWindowApi]::IsZoomed($handle)) {",
    "      [ShortureWindowApi]::ShowWindowAsync($handle, 9) | Out-Null",
    "    } else {",
    "      [ShortureWindowApi]::ShowWindowAsync($handle, 3) | Out-Null",
    "    }",
    "  }",
    "  $isActive = $false",
    "  for ($attempt = 0; $attempt -lt 4; $attempt++) {",
    "    [ShortureWindowApi]::SetForegroundWindow($handle) | Out-Null",
    "    Start-Sleep -Milliseconds 100",
    "    if ([ShortureWindowApi]::GetForegroundWindow() -eq $handle) {",
    "      $isActive = $true",
    "      break",
    "    }",
    "  }",
    "  if (-not $isActive) { throw 'Windows did not allow Shorture to bring the application window to the foreground. Try selecting it manually once, then retry.' }",
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
    throw new Error("Could not activate " + application + ": " + details);
  }
}

export async function getForegroundApplication(): Promise<TargetApplication | null> {
  if (process.platform !== "win32") return null;

  const script = [
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class ShortureForegroundApi {",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);",
    "}",
    "'@",
    "$handle = [ShortureForegroundApi]::GetForegroundWindow()",
    "$targetProcessId = [uint32]0",
    "[ShortureForegroundApi]::GetWindowThreadProcessId($handle, [ref]$targetProcessId) | Out-Null",
    "if ($targetProcessId -ne 0) { (Get-Process -Id $targetProcessId -ErrorAction SilentlyContinue).ProcessName }"
  ].join("\r\n");

  const encoded = Buffer.from(script, "utf16le").toString("base64");
  try {
    const result = await execFileAsync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded
    ], { windowsHide: true, timeout: 5000 });
    const name = result.stdout.trim().toLowerCase();
    if (name === "code") return "vscode";
    if (name === "phpstorm64" || name === "phpstorm") return "phpstorm";
    if (name === "chrome") return "chrome";
    if (name === "ms-teams" || name === "teams") return "teams";
    return null;
  } catch {
    return null;
  }
}

export async function executeApplicationShortcut(application: TargetApplication, shortcut: string): Promise<void> {
  const parts = shortcut.split("+");
  const key = parts.pop()?.toLowerCase();
  if (!key) throw new Error("Raccourci clavier invalide.");

  const modifiers: Record<string, string> = { ctrl: "^", shift: "+", alt: "%" };
  const prefix = parts.map((part) => modifiers[part.toLowerCase()] ?? "").join("");
  if (prefix.length !== parts.length) throw new Error("Modificateur clavier non pris en charge.");
  const sequence = prefix + key;

  await activateApplication(application, false);
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Start-Sleep -Milliseconds 100",
    "[System.Windows.Forms.SendKeys]::SendWait('" + escapePowerShell(sequence) + "')"
  ].join("\r\n");
  const encoded = Buffer.from(script, "utf16le").toString("base64");

  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded
    ], { windowsHide: true, timeout: 5000 });
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const details = processError.stderr?.trim() || processError.stdout?.trim() || processError.message || "Unknown PowerShell error.";
    throw new Error("Could not send " + shortcut + " to " + application + ": " + details);
  }
}

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import type { InstalledApplication } from "./types";

const execFileAsync = promisify(execFile);

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

async function runPowerShell(script: string, timeout = 10000): Promise<string> {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const result = await execFileAsync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded
  ], { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 });
  return result.stdout.trim();
}

export async function getInstalledApplications(): Promise<InstalledApplication[]> {
  if (process.platform !== "win32") return [];
  const script = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject WScript.Shell
$roots = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
)
$items = foreach ($root in $roots) {
  if (Test-Path $root) {
    Get-ChildItem -Path $root -Filter '*.lnk' -File -Recurse | ForEach-Object {
      $shortcut = $shell.CreateShortcut($_.FullName)
      $target = [Environment]::ExpandEnvironmentVariables($shortcut.TargetPath)
      if ($target -and (Test-Path $target -PathType Leaf) -and [IO.Path]::GetExtension($target) -ieq '.exe') {
        [PSCustomObject]@{
          name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
          executablePath = $target
          arguments = $shortcut.Arguments
          processName = [IO.Path]::GetFileNameWithoutExtension($target)
        }
      }
    }
  }
}
$items | Sort-Object executablePath -Unique | ConvertTo-Json -Compress -Depth 3
`;
  try {
    const output = await runPowerShell(script, 20000);
    if (!output) return [];
    const parsed = JSON.parse(output) as Array<Omit<InstalledApplication, "id">> | Omit<InstalledApplication, "id">;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .filter((item) => item && typeof item.executablePath === "string")
      .map((item) => ({
        ...item,
        id: createHash("sha256").update(item.executablePath.toLowerCase()).digest("hex").slice(0, 16)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } catch {
    return [];
  }
}

function keySequence(shortcut: string): string {
  const parts = shortcut.split("+");
  const key = parts.pop()?.toLowerCase();
  if (!key) throw new Error("Raccourci clavier invalide.");
  const modifiers: Record<string, string> = { ctrl: "^", shift: "+", alt: "%" };
  const prefix = parts.map((part) => modifiers[part.toLowerCase()] ?? "").join("");
  if (prefix.length !== parts.length) throw new Error("Modificateur clavier non pris en charge.");
  return prefix + key;
}

async function sendKeys(shortcut: string): Promise<void> {
  const sequence = keySequence(shortcut);
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Start-Sleep -Milliseconds 120",
    "[System.Windows.Forms.SendKeys]::SendWait('" + escapePowerShell(sequence) + "')"
  ].join("\r\n");
  try {
    await runPowerShell(script, 5000);
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    throw new Error(processError.stderr?.trim() || processError.stdout?.trim() || processError.message || "Impossible d’envoyer le raccourci.");
  }
}

export async function activateApplication(application: InstalledApplication, toggleIfFocused = true): Promise<void> {
  if (process.platform !== "win32") throw new Error("L’activation des applications est disponible uniquement sous Windows.");
  const executablePath = application.executablePath;
  try { await access(executablePath); } catch { throw new Error("L’exécutable de " + application.name + " est introuvable."); }

  const name = escapePowerShell(application.processName);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class ShortureWindowApi {",
    " [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
    " [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);",
    " [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    " [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);",
    " [DllImport(\"user32.dll\")] public static extern bool IsZoomed(IntPtr hWnd);",
    "}",
    "'@",
    "$process = Get-Process -Name '" + name + "' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "if (-not $process) {",
    "  Start-Process -FilePath '" + escapePowerShell(executablePath) + "' -ArgumentList '" + escapePowerShell(application.arguments) + "'",
    "  Start-Sleep -Milliseconds 900",
    "  $process = Get-Process -Name '" + name + "' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "}",
    "if (-not $process) { throw 'Impossible de trouver la fenetre de cette application.' }",
    "$handle = [IntPtr]$process.MainWindowHandle",
    "$wasMinimized = [ShortureWindowApi]::IsIconic($handle)",
    "$wasAlreadyForeground = ([ShortureWindowApi]::GetForegroundWindow() -eq $handle)",
    "if ($wasMinimized) { [ShortureWindowApi]::ShowWindowAsync($handle, 9) | Out-Null }",
    "elseif ($wasAlreadyForeground -and " + (toggleIfFocused ? "$true" : "$false") + ") {",
    " if ([ShortureWindowApi]::IsZoomed($handle)) { [ShortureWindowApi]::ShowWindowAsync($handle, 9) | Out-Null }",
    " else { [ShortureWindowApi]::ShowWindowAsync($handle, 3) | Out-Null }",
    "}",
    "$active = $false",
    "for ($attempt = 0; $attempt -lt 5; $attempt++) {",
    " [ShortureWindowApi]::SetForegroundWindow($handle) | Out-Null",
    " Start-Sleep -Milliseconds 100",
    " if ([ShortureWindowApi]::GetForegroundWindow() -eq $handle) { $active = $true; break }",
    "}",
    "if (-not $active) { throw 'Windows ne peut pas activer cette fenetre.' }"
  ].join("\r\n");
  try { await runPowerShell(script, 12000); }
  catch (error) {
    const processError = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    throw new Error(processError.stderr?.trim() || processError.stdout?.trim() || processError.message || "Impossible d’activer " + application.name + ".");
  }
}

export async function executeApplicationShortcut(application: InstalledApplication, shortcut: string): Promise<void> {
  await activateApplication(application, false);
  await sendKeys(shortcut);
}

export async function executeWindowsShortcut(shortcut: string): Promise<void> {
  if (process.platform !== "win32") throw new Error("Les raccourcis Windows sont disponibles uniquement sous Windows.");
  await sendKeys(shortcut);
}

export async function getForegroundProcessName(): Promise<string | null> {
  if (process.platform !== "win32") return null;
  const script = [
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class ShortureForegroundApi {",
    " [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    " [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);",
    "}",
    "'@",
    "$handle = [ShortureForegroundApi]::GetForegroundWindow()",
    "$targetProcessId = [uint32]0",
    "[ShortureForegroundApi]::GetWindowThreadProcessId($handle, [ref]$targetProcessId) | Out-Null",
    "if ($targetProcessId -ne 0) { (Get-Process -Id $targetProcessId -ErrorAction SilentlyContinue).ProcessName }"
  ].join("\r\n");
  try { return (await runPowerShell(script, 5000)).toLowerCase() || null; }
  catch { return null; }
}

# Shorture

**Shorture turns a smartphone into a touch control surface for triggering keyboard shortcuts on a computer.**

The idea is to control common actions in a desktop application using gestures performed on a phone: save, undo, open a panel, or run a command.

This repository contains the **first working Shorture prototype**. Its main purpose is to validate communication between the phone and the computer, as well as Windows shortcut execution.

## Project status

The prototype currently allows you to:

- target an already running application window using a two-finger swipe;
- connect a phone to the computer through a browser on the same local network;
- detect a small set of multi-touch gestures;
- send the corresponding action to the selected application;
- display execution errors on the computer and copy their diagnostic details.

Gestures and shortcuts are predefined. There is no configuration editor or custom control-surface creation yet.

## How it works

Shorture consists of two interfaces:

- **Desktop application**: an Electron application built with React and TypeScript. It lets you select the application to control and displays connection details.
- **Mobile interface**: a touch-friendly web page opened in the phone's browser. No APK is required.

Both interfaces communicate over the local Wi-Fi network using WebSocket. On Windows, the desktop application uses PowerShell and the Windows `user32.dll` API to restore and bring application windows to the foreground, and `System.Windows.Forms.SendKeys` to send keyboard shortcuts.

```text
Phone (Chrome)
     |
     | Local Wi-Fi / WebSocket
     v
Shorture (Electron)
     |
     | PowerShell / SendKeys
     v
Target application (e.g. Visual Studio Code)
```

## Requirements

- Windows 10 or Windows 11.
- Node.js 22 LTS recommended (20 or later).
- npm.
- A phone and a computer connected to the same local network.
- A modern browser on the phone (Chrome on Android recommended).

> Keyboard shortcut execution is currently Windows-specific. The mobile server is intended for local network use and should not be exposed to the Internet.

## Installation

Clone the repository from GitHub:

```powershell
git clone --branch 001-first-prototype https://github.com/AntoineGuglielmi/shorture.git
cd shorture
```

Or download the branch archive directly:

[Download Shorture — 001-first-prototype branch](https://github.com/AntoineGuglielmi/shorture/archive/refs/heads/001-first-prototype.zip)

Install the dependencies:

```powershell
npm install
```

## Run Shorture

From the project root, run:

```powershell
npm run dev
```

This command starts Vite, the Electron process compilation, and the desktop application.

The Shorture application should open on your computer.

## Connect your phone

1. In Shorture, click **Choose an .exe** and select the executable of the application you want to control. For Visual Studio Code, this is usually `Code.exe`.
2. Find the local address and six-digit PIN displayed in the application.
3. On your phone, connected to the same Wi-Fi network, open that address in Chrome. It should look similar to `http://192.168.1.20:5173/mobile`.
4. Enter the PIN displayed on your computer.
5. If Windows asks for permission to access the private network, allow it.

Once connected, the phone's touch surface is ready to receive gestures.

## Available gestures

The following gestures are currently mapped to predefined actions:

| Gesture | Action |
| --- | --- |
| Two-finger swipe left | Activate the VS Code window |
| Two-finger swipe up | Activate the PhpStorm window |
| Two-finger swipe right | Activate the Chrome window |
| Two-finger swipe down | Activate the Microsoft Teams window |
| Two-finger tap | Send `Ctrl + S` to the selected application |
| Pinch in | Send `Ctrl + Z` to the selected application |
| Pinch out | Send `Ctrl + Shift + P` to the selected application |

Application activation targets an already running window. Minimized windows are restored before Shorture attempts to bring them to the foreground. Repeating the same gesture while the window is already focused toggles between maximized and restored size. Windows may still restrict foreground activation in some situations; if that happens, Shorture reports an error. If the application is not open, Shorture reports an error rather than launching an application whose installation path may vary. VS Code, PhpStorm, Chrome, and Microsoft Teams are matched using their Windows process names.

## Checks and useful commands

Run these commands from the project root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the application in development mode |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Type-check and build the project |

## Troubleshooting

### The phone cannot connect

- Make sure the phone and computer are connected to the same Wi-Fi network.
- Make sure the Windows network profile is set to Private.
- Allow Node.js / Electron through the Windows Firewall on private networks.
- Check that the address entered on the phone matches the one displayed in Shorture.

### The gesture is detected, but the shortcut is not executed

- Make sure a valid `.exe` file has been selected in Shorture.
- Check that the target application can be launched normally.
- Check the diagnostics panel in the desktop application.
- Use the copy-diagnostics button to retrieve the full error details.

### Multi-touch gestures are not detected correctly

- Use Chrome on Android.
- Perform gestures inside Shorture's touch surface.
- Some phone system gestures or Android customizations may intercept movements, especially near the edges of the screen.

### Electron does not start after installation

First, make sure dependency installation completed successfully. If the Electron binary for Windows was not downloaded, delete `node_modules`, run `npm install` again, and check once more.

## Current limitations

- Windows only for shortcut execution.
- Gesture and shortcut mappings are hard-coded.
- Application activation currently requires the target application to be running.
- No customizable control surfaces or actions yet.
- Gesture detection depends on the browser and touch hardware.
- Application selection and configuration are not persisted after closing the app.
- The phone and computer must remain on the same local network.

## Tech stack

- Electron
- React
- TypeScript
- Vite
- WebSocket (`ws`)
- PowerShell and Windows Script Host for shortcut execution

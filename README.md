# Shorture

**Shorture turns a smartphone into a touch control surface for triggering keyboard shortcuts on a computer.**

The idea is to control common actions in a desktop application using gestures performed on a phone: save, undo, open a panel, or run a command.

This repository contains the **first working Shorture prototype**. Its main purpose is to validate communication between the phone and the computer, as well as Windows shortcut execution.

## Project status

The prototype currently allows you to:

- configure global gestures that activate application windows;
- configure application-specific gestures that send keyboard shortcuts to the application currently in the foreground;
- add, edit, and remove gesture bindings in the desktop interface;
- persist the configuration on the computer between launches;
- connect a phone through a browser on the same local network;
- display execution errors and copy their diagnostic details.

The gesture recognizer currently supports two-finger tap, directional swipes, and pinch gestures. The configuration model is designed to support additional gesture and action types later.

## How it works

Shorture consists of two interfaces:

- **Desktop application**: an Electron application built with React and TypeScript. It manages global and application-specific gesture bindings, and displays connection details.
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

1. Find the local address and six-digit PIN displayed in Shorture.
2. On your phone, connected to the same Wi-Fi network, open that address in Chrome. It should look similar to `http://192.168.1.20:5173/mobile`.
3. Enter the PIN displayed on your computer.
4. If Windows asks for permission to access the private network, allow it.

Once connected, the phone's touch surface is ready to receive gestures.

## Gesture configuration

The desktop interface separates bindings into two contexts:

- **Global**: a gesture runs independently of the foreground application. The default directional swipes activate VS Code, PhpStorm, Chrome, and Teams.
- **Application-specific**: a gesture runs only when its configured application is currently in the foreground. The default two-finger tap sends `Ctrl + S`, pinch in sends `Ctrl + Z`, and pinch out sends `Ctrl + Shift + P`.

Bindings can be added, edited, and removed in the desktop interface. Changes are stored in `shorture.config.json` in Electron's user data directory and are kept between launches. Global bindings take precedence over application-specific bindings when the same gesture is configured in both contexts.

Application activation targets an already running window. Minimized windows are restored before Shorture attempts to bring them to the foreground. Repeating the same global activation gesture while the window is already focused toggles between maximized and restored size. Windows may still restrict foreground activation in some situations; if that happens, Shorture reports an error.

The current prototype recognizes two-finger gestures only. The configuration model leaves room for additional finger counts and action types in later iterations.

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
- The current gesture recognizer supports two fingers only.
- Application activation currently requires the target application to be running.
- Application-specific actions currently send keyboard shortcuts; other action types can be added later.
- Gesture detection depends on the browser and touch hardware.
- The phone and computer must remain on the same local network.

## Tech stack

- Electron
- React
- TypeScript
- Vite
- WebSocket (`ws`)
- PowerShell and Windows `user32.dll` API for window activation\n- `System.Windows.Forms.SendKeys` for keyboard shortcuts

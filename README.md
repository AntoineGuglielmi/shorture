# Shorture

**Shorture turns an Android phone into a configurable touch surface for controlling desktop applications.**

Perform a gesture on your phone to activate a desktop application or trigger an action inside the application currently in use. Shorture is designed to make frequent keyboard shortcuts and desktop actions accessible through simple touch gestures.

This repository contains the first working prototype. It focuses on validating phone-to-desktop communication, gesture recognition, configurable commands, and Windows integration.

## Project status

The prototype currently supports:

- connecting an Android phone to the desktop application over a local network;
- recognizing one-finger taps and two-finger gestures;
- configuring **global commands**, which work independently of the foreground application;
- configuring **application-specific commands**, which run only when their target application is active;
- activating or launching installed Windows applications;
- sending Windows keyboard shortcuts, including combinations such as `Ctrl + N`, `Ctrl + Alt + A`, and repeated modifier shortcuts such as a quick double press of `Shift`;
- recording shortcuts by pressing the desired keys instead of typing them;
- adding, editing, and deleting commands from the desktop interface;
- saving the configuration between launches;
- displaying action errors and copying diagnostic details.

The project is still a prototype. Gesture recognition and Windows automation may behave differently depending on the phone, browser, desktop environment, and target application.

## Concepts

Shorture uses a few distinct terms:

- **Gesture**: the physical action, such as a tap, swipe, or pinch.
- **Touch**: performing a gesture with one or more fingers.
- **Command**: the association between a touch and a desktop action.
- **Context application**: an application in which a command is allowed to run.

Commands are split into two scopes:

### Global commands

A global command can run regardless of which application is currently active. It can, for example, activate a desktop application or send a Windows keyboard shortcut.

### Application-specific commands

An application-specific command runs only when its configured application is in the foreground. The current prototype uses keyboard shortcuts for these commands.

## How it works

Shorture consists of two interfaces:

- **Desktop application**: an Electron application built with React and TypeScript. It manages commands, detects installed applications, and displays connection details.
- **Mobile interface**: a touch-friendly web page opened in the phone's browser. No Android APK is required.

The phone and desktop communicate over the local network using WebSocket. On Windows, the desktop application uses PowerShell, the Windows `user32.dll` API, and `.NET System.Windows.Forms.SendKeys` to activate windows and send keyboard input. Repeated modifier shortcuts use native Windows keyboard events.

```text
Android phone (browser)
        |
        | Local Wi-Fi / WebSocket
        v
Shorture (Electron)
        |
        | PowerShell / Windows APIs
        v
Desktop application
```

## Requirements

- Windows 10 or Windows 11.
- Node.js 22 or later.
- npm.
- An Android phone and a computer connected to the same local network.
- A modern mobile browser (Chrome on Android is recommended).

Keyboard automation and application activation are currently Windows-specific. Shorture is intended for use on a trusted local network; do not expose its mobile server directly to the Internet.

## Installation

Clone the prototype branch:

```powershell
git clone --branch 001-first-prototype https://github.com/AntoineGuglielmi/shorture.git
cd shorture
```

Or download the branch archive:

[Download Shorture — 001-first-prototype](https://github.com/AntoineGuglielmi/shorture/archive/refs/heads/001-first-prototype.zip)

Install dependencies:

```powershell
npm install
```

## Run Shorture

Start the application from the project root:

```powershell
npm run dev
```

This starts the Vite development server, compiles the Electron process, and launches the desktop application.

## Connect your phone

1. Make sure your phone and computer are connected to the same Wi-Fi network.
2. Find the local URL and six-digit PIN displayed in Shorture.
3. Open the displayed URL on your phone. It should look similar to `http://192.168.1.20:5173/mobile`.
4. Enter the PIN shown on the desktop application.
5. If Windows Firewall asks for permission, allow access on private networks.

Once connected, the phone's touch surface is ready to receive gestures.

## Gestures

The current recognizer supports:

| Fingers | Gesture |
| --- | --- |
| 1 | Tap |
| 2 | Tap |
| 2 | Swipe left, right, up, or down |
| 2 | Pinch in or out |

Three-finger gestures are not currently supported. Some Android manufacturers intercept system gestures before the browser can receive them. On the tested Redmi / MIUI environment, three-finger gestures can conflict with built-in system shortcuts, so Shorture avoids relying on them.

For reliable detection, perform gestures within the mobile touch surface and avoid starting swipes at the very edge of the screen.

## Configure commands

The desktop interface separates commands into two scopes:

- **Global**: commands that are available regardless of the foreground application.
- **Application-specific**: commands associated with an installed application and triggered only while that application is active.

You can add, edit, and delete commands in either scope. The application picker is populated from Windows Start Menu shortcuts.

When configuring a command, select the number of fingers, the gesture, and the action. Depending on the scope, actions can activate an application or send a keyboard shortcut.

### Record a keyboard shortcut

Click the shortcut recording area, then press the desired key combination. Shorture records the keys directly, so you do not have to type the shortcut manually.

Examples include:

- `Ctrl + N`
- `Shift + A`
- `Ctrl + Alt + A`
- a quick double press of `Shift` (as used by PhpStorm's Search Everywhere).

Press `Escape` to cancel shortcut recording.

### Default configuration

When Visual Studio Code is detected among the installed applications, the initial configuration includes:

- a global two-finger swipe left to activate Visual Studio Code;
- a Visual Studio Code command using a one-finger tap to send `Ctrl + N` (new file).

No other default commands are added. You can change or remove these commands in the desktop interface.

### Application activation

When a global command activates an application, Shorture first looks for an existing window. If the application is not running, Shorture attempts to launch it and waits for its main window.

If the target window is minimized, it is restored. If it is already focused, repeating the activation command toggles between maximized and restored size. Otherwise, Shorture attempts to bring it to the foreground.

Windows can restrict foreground activation in some situations. If activation or shortcut execution fails, the desktop interface displays an error with diagnostic details.

### Configuration storage

The configuration is stored locally in `shorture.config.json` inside Electron's user data directory and is kept between launches.

## Checks and useful commands

Run these commands from the project root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the application in development mode |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Type-check and build the project |
| `npm start` | Start the built Electron application |

## Troubleshooting

### The phone cannot connect

- Make sure the phone and computer are connected to the same Wi-Fi network.
- Make sure the Windows network profile is set to **Private**.
- Allow Node.js / Electron through Windows Firewall on private networks.
- Check that the URL entered on the phone matches the one displayed in Shorture.
- Make sure the six-digit PIN is entered correctly.

### The gesture is detected, but the action is not executed

- Check that the configured command matches the number of fingers and gesture performed.
- For an application-specific command, make sure its target application is currently in the foreground.
- Open the diagnostics details in the desktop interface and use the copy button to retrieve the full error.
- Some applications may handle particular keyboard shortcuts differently.

### Multi-touch gestures are not detected correctly

- Use Chrome on Android.
- Perform gestures inside Shorture's touch surface.
- Avoid the edges of the screen, where Android system gestures may take priority.
- Some manufacturer-specific Android features can intercept gestures before the browser receives them.

### Electron does not start after installation

Make sure dependency installation completed successfully. If the Electron binary was not downloaded, try:

```powershell
npm rebuild electron
```

If the issue persists, remove `node_modules` and reinstall dependencies:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

## Current limitations

- Windows only for desktop automation and keyboard shortcut execution.
- One- and two-finger gestures only.
- Gesture recognition depends on the phone, browser, and touch hardware.
- Three-finger gestures may be intercepted by Android system features.
- The installed application list is based on Windows Start Menu shortcuts.
- Application-specific commands currently support keyboard shortcuts; other action types may be added later.
- The phone and computer must remain on the same local network.

## Tech stack

- Electron
- React
- TypeScript
- Vite
- WebSocket (`ws`)
- PowerShell
- Windows `user32.dll` API for window activation and native modifier key events
- `.NET System.Windows.Forms.SendKeys` for standard keyboard shortcuts

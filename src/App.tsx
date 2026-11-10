import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PointerEvent } from "react";
import type { ContextApp, DesktopInfo, GestureCommand, GestureName, ShortureConfig, ShortcutFailure } from "../electron/types";
import { gestures } from "../electron/config";
import { QRCodeSVG } from "qrcode.react";

type ServerMessage = { type: "connected" | "executed" | "error"; message?: string; gesture?: GestureName };
const gestureLabels: Record<GestureName, string> = {
  "one-finger-tap": "Tap à un doigt",
  "two-finger-tap": "Tap à deux doigts",
  "two-finger-swipe-left": "Glisser à gauche",
  "two-finger-swipe-right": "Glisser à droite",
  "two-finger-swipe-up": "Glisser vers le haut",
  "two-finger-swipe-down": "Glisser vers le bas",
  "pinch-in": "Pincer (rapprocher)",
  "pinch-out": "Pincer (écarter)"
};


function ShortcutRecorder({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [listening, setListening] = useState(false);
  const pressed = useRef(new Set<string>());
  const lastModifierPress = useRef<{ modifier: string; at: number } | null>(null);

  useEffect(() => {
    if (!listening) return;

    const getModifier = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Control") return "Ctrl";
      if (event.key === "Alt") return "Alt";
      if (event.key === "Shift") return "Shift";
      return null;
    };

    const getPressedModifiers = () => [...pressed.current]
      .map((code) => code.startsWith("Shift") ? "Shift" : code.startsWith("Control") ? "Ctrl" : code.startsWith("Alt") ? "Alt" : "")
      .filter(Boolean);

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        pressed.current.clear();
        lastModifierPress.current = null;
        setListening(false);
        return;
      }

      const modifier = getModifier(event);
      if (modifier) {
        const alreadyPressed = [...pressed.current].some((code) => {
          const pressedModifier = code.startsWith("Shift") ? "Shift" : code.startsWith("Control") ? "Ctrl" : code.startsWith("Alt") ? "Alt" : "";
          return pressedModifier === modifier && code !== event.code;
        });

        const lastPress = lastModifierPress.current;
        const pressedTwice = lastPress?.modifier === modifier && Date.now() - lastPress.at <= 800;

        if (!event.repeat && (alreadyPressed || pressedTwice)) {
          onChange(`${modifier}+${modifier}`);
          pressed.current.clear();
          lastModifierPress.current = null;
          setListening(false);
          return;
        }

        if (!event.repeat) {
          pressed.current.add(event.code);
          lastModifierPress.current = { modifier, at: Date.now() };
        }

        const modifiers = getPressedModifiers();
        if (modifiers.length > 1) onChange([...new Set(modifiers)].join("+"));
        return;
      }

      const modifiers = getPressedModifiers();
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      onChange([...new Set(modifiers), key].join("+"));
      pressed.current.clear();
      lastModifierPress.current = null;
      setListening(false);
    };

    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      pressed.current.delete(event.code);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [listening, onChange]);

  return (
    <div
      className={listening ? "shortcut-recorder listening" : "shortcut-recorder"}
      role="button"
      tabIndex={0}
      aria-label="Enregistrer un raccourci clavier"
      onClick={() => {
        pressed.current.clear();
        lastModifierPress.current = null;
        setListening(true);
      }}
      onBlur={() => {
        setListening(false);
        pressed.current.clear();
        lastModifierPress.current = null;
      }}
    >
      <strong>{listening ? "Appuie sur ton raccourci…" : value || "Cliquer pour enregistrer"}</strong>
      <span>{listening ? "Échap pour annuler · double appui possible sur un modificateur" : "Cliquer pour modifier"}</span>
    </div>
  );
}
function DesktopApp() {
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [config, setConfig] = useState<ShortureConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortcutFailure, setShortcutFailure] = useState<ShortcutFailure | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [newContextApplicationId, setNewContextApplicationId] = useState("");
  const [scope, setScope] = useState<"global" | "application">("global");
  const [fingers, setFingers] = useState<1 | 2>(2);
  const [gesture, setGesture] = useState<GestureName>("two-finger-swipe-right");
  const [globalAction, setGlobalAction] = useState<"activate-application" | "windows-shortcut">("activate-application");
  const [actionApplicationId, setActionApplicationId] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl+N");
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await window.shorture.getDesktopInfo();
      setInfo(result);
      setConfig(result.config);
      setError(null);
      setNewContextApplicationId(result.installedApplications[0]?.id ?? "");
      setActionApplicationId(result.installedApplications[0]?.id ?? "");
    } catch {
      setError("Impossible de récupérer les informations de l’application.");
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => window.shorture.onShortcutError(setShortcutFailure), []);

  const persist = async (next: ShortureConfig): Promise<boolean> => {
    try {
      const saved = await window.shorture.saveConfig(next);
      setConfig(saved);
      setSaveMessage("Configuration enregistrée.");
      setError(null);
      return true;
    } catch (cause) {
      setSaveMessage("");
      setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la configuration.");
      return false;
    }
  };

  const resetEditor = (targetScope: "global" | "application" = scope) => {
    setEditingId(null);
    setFingers(targetScope === "global" ? 2 : 1);
    setGesture(targetScope === "global" ? "two-finger-swipe-right" : "one-finger-tap");
    setShortcut("Ctrl+N");
    setGlobalAction("activate-application");
  };

  const editCommand = (command: GestureCommand, commandScope: "global" | "application") => {
    setScope(commandScope);
    setEditingId(command.id);
    setFingers(command.fingers);
    setGesture(command.gesture);
    if (command.action.type === "activate-application") {
      setGlobalAction("activate-application");
      setActionApplicationId(command.action.applicationId);
    } else {
      setGlobalAction("windows-shortcut");
      setShortcut(command.action.shortcut);
    }
    document.getElementById("command-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const saveCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config) return;
    const command: GestureCommand = {
      id: editingId ?? crypto.randomUUID(),
      fingers,
      gesture,
      action: scope === "global"
        ? globalAction === "activate-application"
          ? { type: "activate-application", applicationId: actionApplicationId }
          : { type: "windows-shortcut", shortcut: shortcut.trim() }
        : { type: "keyboard-shortcut", shortcut: shortcut.trim() }
    };
    let next: ShortureConfig;
    if (scope === "global") {
      next = {
        ...config,
        globalCommands: [
          ...config.globalCommands.filter((item) => item.id !== editingId && item.gesture !== gesture),
          command
        ]
      };
    } else {
      next = {
        ...config,
        contextApps: config.contextApps.map((context) => context.id !== selectedContextId ? context : {
          ...context,
          commands: [...context.commands.filter((item) => item.id !== editingId && item.gesture !== gesture), command]
        })
      };
    }
    if (await persist(next)) resetEditor();
  };

  const deleteCommand = async (id: string, commandScope: "global" | "application") => {
    if (!config) return;
    const next = commandScope === "global"
      ? { ...config, globalCommands: config.globalCommands.filter((item) => item.id !== id) }
      : { ...config, contextApps: config.contextApps.map((context) => context.id !== selectedContextId ? context : {
          ...context, commands: context.commands.filter((item) => item.id !== id)
        }) };
    if (await persist(next) && editingId === id) resetEditor();
  };

  const addContextApp = async () => {
    if (!config || !info || !newContextApplicationId) return;
    const application = info.installedApplications.find((item) => item.id === newContextApplicationId);
    if (!application || config.contextApps.some((item) => item.application.id === application.id)) return;
    const context: ContextApp = { id: crypto.randomUUID(), application, commands: [] };
    if (await persist({ ...config, contextApps: [...config.contextApps, context] })) setSelectedContextId(context.id);
  };

  const selectedContext = config?.contextApps.find((item) => item.id === selectedContextId) ?? null;
  const availableApps = info?.installedApplications.filter((application) =>
    !config?.contextApps.some((context) => context.application.id === application.id)
  ) ?? [];
  const eligibleGestures = gestures.filter((item) => item.fingers === fingers);
  const mobileUrls = info?.addresses.map((address) => `http://${address}:5173/mobile`) ?? [];
  const pairingUrl = mobileUrls[0] && info?.pin ? `${mobileUrls[0]}?pin=${encodeURIComponent(info.pin)}` : null;
  const applicationName = (id: string) => info?.installedApplications.find((item) => item.id === id)?.name ?? id;

  return (
    <main className="desktop-shell">
      <header className="topbar">
        <a className="wordmark" href="/">shorture<span>.</span></a>
        <span className="version">PROTOTYPE 001</span>
      </header>
      <section className="intro">
        <p className="eyebrow">TOUCH INPUT / DESKTOP ACTIONS</p>
        <h1>Un geste.<br /><span>Une action.</span></h1>
        <p className="lead">Ton téléphone devient une surface de commandes configurable pour ton ordinateur.</p>
      </section>
      {error && <p className="notice error">{error}</p>}
      {shortcutFailure && (
        <section className="panel" style={{ marginTop: 24, padding: 20, border: "1px solid #b85c5c" }}>
          <p className="eyebrow">ERREUR D’ACTION · {shortcutFailure.action}</p>
          <h2>Impossible d’exécuter le geste</h2>
          <p className="muted">{shortcutFailure.message}</p>
          <p className="muted">{new Date(shortcutFailure.occurredAt).toLocaleString()}</p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 220, overflow: "auto", padding: 12, background: "#090a0c", color: "#f0f0f0" }}>{shortcutFailure.details}</pre>
          <button className="text-button" onClick={() => setShortcutFailure(null)}>Effacer</button>
        </section>
      )}
      <section className="connection-grid">
        <article className="panel connection-panel">
          <p className="eyebrow">01 / CONNEXION LOCALE</p>
          <h2>Connecte ton téléphone</h2>
          <p className="muted">Scanne ce QR code. Le PC et le mobile doivent être sur le même réseau Wi-Fi.</p>
          {pairingUrl && <div className="pairing-qr"><QRCodeSVG value={pairingUrl} size={184} level="M" includeMargin /><span>SCANNE POUR TE CONNECTER</span></div>}
          <p className="muted">Ou ouvre l’adresse manuellement :</p>
          {mobileUrls.map((url) => <p className="address" key={url}>{url}</p>)}
          <div className="pin-block"><span className="muted">CODE D’APPAIRAGE</span><strong>{info?.pin ?? "------"}</strong></div>
        </article>
        <article className="panel mapping-panel">
          <p className="eyebrow">02 / ORGANISATION</p>
          <h2>Deux niveaux de commandes</h2>
          <div className="logic-explainer">
            <div><strong>Globales</strong><span>Déclenchées quelle que soit la fenêtre active.</span></div>
            <div><strong>Associées à une application</strong><span>Déclenchées uniquement lorsque cette application est au premier plan.</span></div>
          </div>
          <p className="hint">Les commandes globales sont prioritaires. La détection automatique repose sur les raccourcis du menu Démarrer Windows.</p>
        </article>
      </section>

      <section className="configuration-section">
        <div className="section-heading">
          <div><p className="eyebrow">03 / COMMANDES GLOBALES</p><h2>Indépendantes de l’application</h2></div>
          <span className="count">{config?.globalCommands.length ?? 0} commande(s)</span>
        </div>
        <div className="binding-list">
          {!config?.globalCommands.length && <p className="empty-state">Aucune commande globale configurée.</p>}
          {config?.globalCommands.map((command) => (
            <article className="binding-row" key={command.id}>
              <div className="binding-gesture"><span>{command.fingers} DOIGT{command.fingers > 1 ? "S" : ""}</span><strong>{gestureLabels[command.gesture]}</strong></div>
              <div className="binding-action"><span>FONCTIONNALITÉ</span><strong>{command.action.type === "activate-application" ? `Ouvrir / activer ${applicationName(command.action.applicationId)}` : command.action.shortcut}</strong></div>
              <div className="binding-controls">
                <button className="text-button" onClick={() => editCommand(command, "global")}>Modifier</button>
                <button className="text-button danger-text" onClick={() => void deleteCommand(command.id, "global")}>Supprimer</button>
              </div>
            </article>
          ))}
        </div>
        <button className="button secondary" style={{ marginTop: 18 }} onClick={() => { setScope("global"); resetEditor("global"); document.getElementById("command-editor")?.scrollIntoView({ behavior: "smooth" }); }}>Ajouter une commande globale</button>
      </section>

      <section className="configuration-section">
        <div className="section-heading">
          <div><p className="eyebrow">04 / CONTEXTAPPS</p><h2>Associées à une application</h2></div>
        </div>
        <div className="application-picker">
          <select aria-label="Application installée" value={newContextApplicationId} onChange={(event) => setNewContextApplicationId(event.target.value)}>
            <option value="">Choisir une application installée…</option>
            {availableApps.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
          </select>
          <button className="button secondary" disabled={!newContextApplicationId} onClick={() => void addContextApp()}>Ajouter l’application</button>
        </div>
        {!config?.contextApps.length && <p className="empty-state">Aucune application configurée. Ajoute une application détectée sur cet ordinateur.</p>}
        <div className="context-app-list">
          {config?.contextApps.map((context) => (
            <button key={context.id} className={selectedContextId === context.id ? "context-app-card selected" : "context-app-card"} onClick={() => { setSelectedContextId(context.id); setScope("application"); resetEditor(); }}>
              <span><strong>{context.application.name}</strong><small>{context.commands.length} commande(s)</small></span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      {selectedContext && (
        <section className="configuration-section context-detail">
          <div className="section-heading">
            <div><p className="eyebrow">05 / CONTEXTAPP</p><h2>{selectedContext.application.name}</h2></div>
            <button className="text-button danger-text" onClick={() => {
              if (!config) return;
              void persist({ ...config, contextApps: config.contextApps.filter((item) => item.id !== selectedContext.id) }).then((ok) => { if (ok) setSelectedContextId(null); });
            }}>Retirer l’application</button>
          </div>
          {!selectedContext.commands.length && <p className="empty-state">Aucune commande dans cette application.</p>}
          {selectedContext.commands.map((command) => (
            <article className="binding-row" key={command.id}>
              <div className="binding-gesture"><span>{command.fingers} DOIGT{command.fingers > 1 ? "S" : ""}</span><strong>{gestureLabels[command.gesture]}</strong></div>
              <div className="binding-action"><span>FONCTIONNALITÉ</span><strong><kbd>{command.action.type === "keyboard-shortcut" ? command.action.shortcut : "—"}</kbd></strong></div>
              <div className="binding-controls">
                <button className="text-button" onClick={() => editCommand(command, "application")}>Modifier</button>
                <button className="text-button danger-text" onClick={() => void deleteCommand(command.id, "application")}>Supprimer</button>
              </div>
            </article>
          ))}
          <button className="button secondary" style={{ marginTop: 18 }} onClick={() => { setScope("application"); resetEditor("application"); document.getElementById("command-editor")?.scrollIntoView({ behavior: "smooth" }); }}>Ajouter une commande</button>
        </section>
      )}

      <section className="panel editor-panel" id="command-editor">
        <div className="section-heading">
          <div><p className="eyebrow">06 / ÉDITEUR DE COMMANDE</p><h2>{editingId ? "Modifier la commande" : "Nouvelle commande"}</h2></div>
          {editingId && <button className="text-button" onClick={resetEditor}>Annuler</button>}
        </div>
        <form className="binding-form" onSubmit={(event) => void saveCommand(event)}>
          <label><span>Contexte</span>
            <select value={scope} onChange={(event) => { setScope(event.target.value as "global" | "application"); setEditingId(null); setFingers(event.target.value === "global" ? 2 : 1); setGesture(event.target.value === "global" ? "two-finger-swipe-right" : "one-finger-tap"); }}>
              <option value="global">Global</option><option value="application" disabled={!selectedContext}>Application sélectionnée</option>
            </select>
          </label>
          <label><span>Nombre de doigts</span>
            <select value={fingers} onChange={(event) => { const count = Number(event.target.value) as 1 | 2; setFingers(count); setGesture(count === 1 ? "one-finger-tap" : "two-finger-tap"); }}>
              <option value={1}>1 doigt</option><option value={2}>2 doigts</option>
            </select>
          </label>
          <label><span>Geste</span>
            <select value={gesture} onChange={(event) => setGesture(event.target.value as GestureName)}>
              {eligibleGestures.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          {scope === "global" ? <>
            <label><span>Fonctionnalité</span>
              <select value={globalAction} onChange={(event) => setGlobalAction(event.target.value as "activate-application" | "windows-shortcut")}>
                <option value="activate-application">Ouvrir / activer une application</option><option value="windows-shortcut">Raccourci clavier global</option>
              </select>
            </label>
            {globalAction === "activate-application" ? <label><span>Application à activer</span>
              <select value={actionApplicationId} onChange={(event) => setActionApplicationId(event.target.value)} required>
                <option value="">Choisir une application…</option>
                {info?.installedApplications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
              </select>
            </label> : <label><span>Raccourci Windows</span><ShortcutRecorder value={shortcut} onChange={setShortcut} /></label>}
          </> : <label><span>Raccourci clavier dans l’application</span><ShortcutRecorder value={shortcut} onChange={setShortcut} /></label>}
          <div className="form-actions">
            <button className="button primary" type="submit" disabled={scope === "application" && !selectedContext}>{editingId ? "Enregistrer" : "Ajouter la commande"}</button>
            {saveMessage && <span className="save-message">{saveMessage}</span>}
          </div>
        </form>
      </section>
      <footer className="footer"><span>SHORTURE / PREMIER PROTOTYPE</span><button className="text-button" onClick={() => void refresh()}>Recharger la configuration</button></footer>
    </main>
  );
}

function MobileApp() {
  const [pin, setPin] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Entre le code affiché sur ton ordinateur.");
  const [lastAction, setLastAction] = useState("");
  const [touchDebug, setTouchDebug] = useState("Aucun événement tactile.");
  const socketRef = useRef<WebSocket | null>(null);
  const pinRef = useRef("");

  useEffect(() => () => socketRef.current?.close(), []);

  const connect = (providedPin?: string) => {
    const cleanPin = (providedPin ?? pin).trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      setStatus("Le code doit contenir 6 chiffres.");
      return;
    }

    socketRef.current?.close();
    const socket = new WebSocket(`ws://${window.location.hostname}:8787/ws?pin=${encodeURIComponent(cleanPin)}`);
    socketRef.current = socket;
    pinRef.current = cleanPin;

    socket.onopen = () => setStatus("Connexion établie. Tu peux utiliser les gestes.");
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "connected") setConnected(true);
      if (message.type === "executed" && message.gesture) {
        setLastAction(gestureLabels[message.gesture]);
        setStatus("Geste reçu par l’ordinateur.");
      }
      if (message.type === "error") setStatus(message.message ?? "Une erreur est survenue.");
    };
    socket.onerror = () => setStatus("Connexion impossible. Vérifie le Wi-Fi et le pare-feu Windows.");
    socket.onclose = () => setConnected(false);
  };

  useEffect(() => {
    const urlPin = new URLSearchParams(window.location.search).get("pin");
    if (urlPin && /^\d{6}$/.test(urlPin)) {
      setPin(urlPin);
      connect(urlPin);
    }
  }, []);

  const sendGesture = useCallback((gesture: GestureName) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatus("Le téléphone n’est pas connecté.");
      return;
    }
    socket.send(JSON.stringify({ type: "gesture", gesture, pin: pinRef.current }));
    setStatus(`Geste envoyé : ${gestureLabels[gesture]}`);
  }, []);

  const pointerMap = useRef(new Map<number, { x: number; y: number; startX: number; startY: number }>());
  const gestureStart = useRef<{ count: number; points: Array<{ x: number; y: number }>; time: number } | null>(null);
  const moved = useRef(false);
  const touchPadRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pointerMap.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY
    });
    setTouchDebug(`DOWN · ${event.pointerType} · ${pointerMap.current.size} contact(s)`);
    if (pointerMap.current.size === 1) {
      gestureStart.current = { count: 1, points: [...pointerMap.current.values()].map((point) => ({ ...point })), time: Date.now() };
      moved.current = false;
    }
    if (pointerMap.current.size >= 2) {
      gestureStart.current = {
        count: pointerMap.current.size,
        points: [...pointerMap.current.values()].map((point) => ({ ...point })),
        time: Date.now()
      };
      moved.current = false;
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointerMap.current.get(event.pointerId);
    if (!previous) return;

    // Keep the full gesture displacement, not only the latest event delta.
    if (Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 18) {
      moved.current = true;
    }
    pointerMap.current.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
    setTouchDebug(`MOVE · ${event.pointerType} · ${pointerMap.current.size} contact(s) · ΔY ${Math.round(event.clientY - previous.startY)} px`);

  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    setTouchDebug(`${event.type.toUpperCase()} · ${event.pointerType} · ${pointerMap.current.size} contact(s)`);
    const start = gestureStart.current;
    const startCount = start?.count ?? pointerMap.current.size;

    // Include the final pointer position: some devices do not emit a last pointermove.
    const previous = pointerMap.current.get(event.pointerId);
    pointerMap.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: previous?.startX ?? event.clientX,
      startY: previous?.startY ?? event.clientY
    });
    const currentPoints = [...pointerMap.current.values()];

    if (start && startCount === 1 && currentPoints.length === 1 && !moved.current && Date.now() - start.time < 450) {
      sendGesture("one-finger-tap");
    }

    if (start && startCount === 2 && currentPoints.length === 2) {
      const startCenter = {
        x: (start.points[0].x + start.points[1].x) / 2,
        y: (start.points[0].y + start.points[1].y) / 2
      };
      const endCenter = {
        x: (currentPoints[0].x + currentPoints[1].x) / 2,
        y: (currentPoints[0].y + currentPoints[1].y) / 2
      };
      const deltaX = endCenter.x - startCenter.x;
      const deltaY = endCenter.y - startCenter.y;
      const startDistance = Math.hypot(start.points[0].x - start.points[1].x, start.points[0].y - start.points[1].y);
      const endDistance = Math.hypot(currentPoints[0].x - currentPoints[1].x, currentPoints[0].y - currentPoints[1].y);
      const pinchDelta = endDistance - startDistance;
      const swipeDistance = Math.hypot(deltaX, deltaY);

      if (swipeDistance > 65 && swipeDistance > Math.abs(pinchDelta) * 1.2) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          sendGesture(deltaX < 0 ? "two-finger-swipe-left" : "two-finger-swipe-right");
        } else {
          sendGesture(deltaY < 0 ? "two-finger-swipe-up" : "two-finger-swipe-down");
        }
      } else if (Math.abs(pinchDelta) > 45) {
        sendGesture(pinchDelta < 0 ? "pinch-in" : "pinch-out");
      } else if (!moved.current && Date.now() - start.time < 450) {
        sendGesture("two-finger-tap");
      }
    }

    pointerMap.current.delete(event.pointerId);
    if (pointerMap.current.size < 2) {
      gestureStart.current = null;
    }
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    pointerMap.current.delete(event.pointerId);
    gestureStart.current = null;
    moved.current = false;
    setTouchDebug(`POINTERCANCEL · ${event.pointerType} · ${pointerMap.current.size} contact(s) · geste annulé`);
  };



  return (
    <main className="mobile-shell">
      <header className="mobile-header">
        <a className="wordmark" href="/">shorture<span>.</span></a>
        <span className={connected ? "connection-state online" : "connection-state"}>{connected ? "CONNECTÉ" : "HORS LIGNE"}</span>
      </header>

      {!connected ? (
        <section className="mobile-connect">
          <p className="eyebrow">CONNEXION AU PC</p>
          <h1>On se<br /><span>connecte.</span></h1>
          <label htmlFor="pairing-pin">Code à 6 chiffres</label>
          <input id="pairing-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="000000" />
          <button className="button primary full-width" onClick={connect}>Connecter le téléphone</button>
          <p className="mobile-status">{status}</p>
        </section>
      ) : (
        <section className="touch-screen">
          <div className="touch-heading">
            <p className="eyebrow">SURFACE TACTILE</p>
            <h1>Fais un<br /><span>geste.</span></h1>
          </div>
          <div
            ref={touchPadRef}
            className="touch-pad"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div className="touch-orbit orbit-one" />
            <div className="touch-orbit orbit-two" />
            <div className="touch-center">
              <span className="touch-cross">＋</span>
              <strong>TOUCHE ICI</strong>
              <small>1 doigt · 2 doigts · glisse · pince</small>
            </div>
          </div>
          <div className="mobile-feedback">
            <span>{lastAction || "En attente d’un geste"}</span>
            <p>{status}</p>
            <p className="touch-debug">{touchDebug}</p>
          </div>
          <button className="text-button disconnect" onClick={() => { socketRef.current?.close(); setConnected(false); setStatus("Déconnecté."); }}>Déconnecter</button>
        </section>
      )}
    </main>
  );
}

export default function App() {
  return window.location.pathname === "/mobile" ? <MobileApp /> : <DesktopApp />;
}

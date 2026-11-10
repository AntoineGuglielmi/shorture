import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { DesktopInfo, GestureName, ShortcutFailure } from "../electron/types";
import { QRCodeSVG } from "qrcode.react";

type ServerMessage = {
  type: "connected" | "executed" | "error";
  message?: string;
  gesture?: GestureName;
};

const gestureLabels: Record<GestureName, string> = {
  "two-finger-tap": "Double appui à deux doigts",
  "three-finger-swipe-up": "Glissement de trois doigts vers le haut",
  "pinch-in": "Pincement (rapprocher)",
  "pinch-out": "Pincement (écarter)"
};

function DesktopApp() {
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortcutFailure, setShortcutFailure] = useState<ShortcutFailure | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await window.shorture.getDesktopInfo());
      setError(null);
    } catch {
      setError("Impossible de récupérer les informations de l’application.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => window.shorture.onShortcutError(setShortcutFailure), []);

  const chooseApplication = async () => {
    const selected = await window.shorture.chooseApplication();
    if (selected) {
      await window.shorture.setTargetPath(selected);
      await refresh();
    }
  };

  const mobileUrls = info?.addresses.map((address) => `http://${address}:5173/mobile`) ?? [];
  const pairingUrl = mobileUrls[0] && info?.pin
    ? `${mobileUrls[0]}?pin=${encodeURIComponent(info.pin)}`
    : null;

  return (
    <main className="desktop-shell">
      <header className="topbar">
        <a className="wordmark" href="/">shorture<span>.</span></a>
        <span className="version">PROTOYPE 001</span>
      </header>

      <section className="intro">
        <p className="eyebrow">TOUCH INPUT / DESKTOP ACTIONS</p>
        <h1>Un geste.<br /><span>Une action.</span></h1>
        <p className="lead">Ton téléphone devient une surface de raccourcis pour ton ordinateur.</p>
      </section>

      {error && <p className="notice error">{error}</p>}

      {shortcutFailure && (
        <section className="panel" style={{ marginTop: 24, padding: 20, border: "1px solid #b85c5c" }}>
          <p className="eyebrow">ERREUR DE RACCOURCI · {shortcutFailure.action}</p>
          <h2>Impossible d’exécuter le geste</h2>
          <p className="muted">{shortcutFailure.message}</p>
          <p className="muted">{new Date(shortcutFailure.occurredAt).toLocaleString()}</p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 220, overflow: "auto", padding: 12, background: "#090a0c", color: "#f0f0f0" }}>{shortcutFailure.details}</pre>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="button secondary" onClick={() => void navigator.clipboard.writeText(JSON.stringify(shortcutFailure, null, 2))}>Copier le diagnostic complet</button>
            <button className="text-button" onClick={() => setShortcutFailure(null)}>Effacer</button>
          </div>
        </section>
      )}

      <section className="panel application-panel">
        <div>
          <p className="eyebrow">01 / APPLICATION CIBLE</p>
          <h2>{info?.targetPath ? info.targetPath.split(/[\\/]/).pop() : "Aucune application sélectionnée"}</h2>
          <p className="muted">{info?.targetPath ?? "Choisis le fichier .exe de l’application à piloter."}</p>
        </div>
        <button className="button secondary" onClick={() => void chooseApplication()}>
          {info?.targetPath ? "Changer" : "Choisir un .exe"}
        </button>
      </section>

      <section className="connection-grid">
        <article className="panel connection-panel">
          <p className="eyebrow">02 / CONNEXION LOCALE</p>
          <h2>Connecte ton téléphone</h2>
          <p className="muted">Scanne ce QR code avec l’appareil photo de ton téléphone. Le PC et le mobile doivent être sur le même réseau Wi-Fi.</p>
          {pairingUrl && (
            <div className="pairing-qr">
              <QRCodeSVG value={pairingUrl} size={184} level="M" includeMargin />
              <span>SCANNE POUR TE CONNECTER</span>
            </div>
          )}
          <p className="muted">Ou ouvre l’adresse manuellement :</p>
          {mobileUrls.length > 0
            ? mobileUrls.map((url) => <p className="address" key={url}>{url}</p>)
            : <p className="notice">Aucune adresse réseau détectée. Vérifie que le Wi-Fi est activé.</p>}
          <div className="pin-block">
            <span className="muted">CODE D’APPAIRAGE</span>
            <strong>{info?.pin ?? "------"}</strong>
          </div>
          <p className="hint">Si Windows affiche une demande de pare-feu, autorise l’accès sur les réseaux privés.</p>
        </article>

        <article className="panel mapping-panel">
          <p className="eyebrow">03 / GESTES CONFIGURÉS</p>
          <h2>Raccourcis de test</h2>
          <ul className="mapping-list">
            <li><span>3 doigts ↑</span><kbd>Ctrl + Shift + P</kbd><small>Ouvrir le terminal intégré (commande)</small></li>
            <li><span>2 doigts · tap</span><kbd>Ctrl + S</kbd><small>Enregistrer</small></li>
            <li><span>Pincement entrant</span><kbd>Ctrl + Z</kbd><small>Annuler</small></li>
            <li><span>Pincement sortant</span><kbd>Ctrl + Shift + P</kbd><small>Palette de commandes</small></li>
          </ul>
        </article>
      </section>

      <footer className="footer">
        <span>SHORTURE / PREMIER PROTOTYPE</span>
        <button className="text-button" onClick={() => void refresh()}>Actualiser les informations</button>
      </footer>
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
  const touchSwipe = useRef<{ identifiers: number[]; startY: number; triggered: boolean } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pointerMap.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY
    });
    setTouchDebug(`DOWN · ${event.pointerType} · ${pointerMap.current.size} contact(s)`);
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

    if (start && startCount >= 2 && currentPoints.length >= 2) {
      if (startCount === 2) {
        const startDistance = Math.hypot(start.points[0].x - start.points[1].x, start.points[0].y - start.points[1].y);
        const endDistance = Math.hypot(currentPoints[0].x - currentPoints[1].x, currentPoints[0].y - currentPoints[1].y);
        const delta = endDistance - startDistance;

        if (Math.abs(delta) > 45) sendGesture(delta < 0 ? "pinch-in" : "pinch-out");
        else if (!moved.current && Date.now() - start.time < 450) sendGesture("two-finger-tap");
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

  useEffect(() => {
    const pad = touchPadRef.current;
    if (!pad) return;

    const onTouchStart = (event: TouchEvent) => {
      setTouchDebug(`TOUCHSTART · ${event.touches.length} contact(s)`);
      if (event.touches.length < 3) return;

      if (event.cancelable) event.preventDefault();
      const contacts = Array.from(event.touches).slice(0, 3);
      touchSwipe.current = {
        identifiers: contacts.map((touch) => touch.identifier),
        startY: contacts.reduce((sum, touch) => sum + touch.clientY, 0) / contacts.length,
        triggered: false
      };
      setTouchDebug(`TOUCHSTART · ${event.touches.length} contacts · suivi natif`);
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = touchSwipe.current;
      if (!gesture || gesture.triggered) return;

      if (event.cancelable) event.preventDefault();
      const activeContacts = Array.from(event.touches).filter((touch) =>
        gesture.identifiers.includes(touch.identifier)
      );
      if (activeContacts.length !== gesture.identifiers.length) return;

      const currentY = activeContacts.reduce((sum, touch) => sum + touch.clientY, 0) / activeContacts.length;
      const deltaY = gesture.startY - currentY;
      setTouchDebug(`TOUCHMOVE · ${activeContacts.length} contacts · ΔY ${Math.round(deltaY)} px`);

      if (deltaY > 45) {
        gesture.triggered = true;
        sendGesture("three-finger-swipe-up");
        setTouchDebug(`SWIPE NATIF RECONNU · ΔY ${Math.round(deltaY)} px`);
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchSwipe.current) return;
      if (event.touches.length < 3) {
        setTouchDebug(`TOUCHEND · ${event.touches.length} contact(s) restant(s)`);
        touchSwipe.current = null;
      }
    };

    const onTouchCancel = (event: TouchEvent) => {
      if (!touchSwipe.current) return;
      setTouchDebug(`TOUCHCANCEL · ${event.touches.length} contact(s) · système/navigateur a interrompu le geste`);
      touchSwipe.current = null;
    };

    pad.addEventListener("touchstart", onTouchStart, { passive: false });
    pad.addEventListener("touchmove", onTouchMove, { passive: false });
    pad.addEventListener("touchend", onTouchEnd, { passive: false });
    pad.addEventListener("touchcancel", onTouchCancel, { passive: false });

    return () => {
      pad.removeEventListener("touchstart", onTouchStart);
      pad.removeEventListener("touchmove", onTouchMove);
      pad.removeEventListener("touchend", onTouchEnd);
      pad.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [sendGesture]);

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
              <small>2 ou 3 doigts · glisse · pince</small>
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

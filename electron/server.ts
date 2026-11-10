import { createServer, type IncomingMessage } from "node:http";
import { networkInterfaces } from "node:os";
import { WebSocketServer } from "ws";
import type { GestureName } from "./types";

type GestureMessage = { type: "gesture"; gesture: GestureName; pin: string };
type ServerOptions = {
  onGesture: (gesture: GestureName) => Promise<void>;
  onError: (gesture: GestureName, error: unknown) => void;
};
const PORT = 8787;

export function getLocalAddresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

export function createLocalServer(pin: string, options: ServerOptions) {
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.method === "GET" && request.url === "/api/status") {
      response.writeHead(200).end(JSON.stringify({ status: "ready", port: PORT }));
      return;
    }
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
  });

  const webSockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== "/ws" || url.searchParams.get("pin") !== pin) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (client) => webSockets.emit("connection", client, request));
  });

  webSockets.on("connection", (client) => {
    client.send(JSON.stringify({ type: "connected" }));
    client.on("message", async (raw) => {
      let message: GestureMessage;
      try { message = JSON.parse(raw.toString()) as GestureMessage; }
      catch { client.send(JSON.stringify({ type: "error", message: "Message invalide." })); return; }

      if (
        message.type !== "gesture" || message.pin !== pin ||
        !["one-finger-tap", "two-finger-tap", "two-finger-swipe-left", "two-finger-swipe-right", "two-finger-swipe-up", "two-finger-swipe-down", "pinch-in", "pinch-out"].includes(message.gesture)
      ) {
        client.send(JSON.stringify({ type: "error", message: "Geste non autorisé." }));
        return;
      }

      try {
        await options.onGesture(message.gesture);
        client.send(JSON.stringify({ type: "executed", gesture: message.gesture }));
      } catch (error) {
        options.onError(message.gesture, error);
        client.send(JSON.stringify({ type: "error", message: "Action impossible. Consulte le journal sur l’ordinateur." }));
      }
    });
  });

  return {
    start: () => new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(PORT, "0.0.0.0", () => { server.off("error", reject); resolve(); });
    }),
    stop: () => new Promise<void>((resolve) => { webSockets.close(); server.close(() => resolve()); }),
    port: PORT
  };
}
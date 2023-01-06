import cors from "cors";
import { Client } from "discord.js";
import express from "express";
import { createServer } from "http";
import ws from "ws";
import { getAuthenticated } from "./auth";
import config from "./config";
import { Logger } from "./logger";
import initRoutes from "./routes";
import { Count, GetRoutes, PostRoutes, Req } from "./types";
import handleConnection from "./ws";

const app = express();
app.use(cors());
app.use(express.json());

export function GET<
  Path extends GetRoutes["path"],
  Route extends GetRoutes & {
    path: Path;
    parts: Count<Path, "/">;
  }
>(
  path: Path,
  callback: (
    //@ts-expect-error - not sure why, but it works so whatever
    params: Route["params"] & { authenticated: Client },
    req: Req
    //@ts-expect-error
  ) => Promise<Route["response"]>
) {
  app.get(path, async (req, res) => {
    const authenticated = getAuthenticated(req);
    if (!authenticated && path !== "/") return res.status(401).json({ err: "Unauthorized" });
    res.status(200).json(await callback({ ...(<any>req.query), authenticated }, req));
  });
}
export function POST<
  Path extends PostRoutes["path"],
  Route extends PostRoutes & {
    path: Path;
    parts: Count<Path, "/">;
  }
>(
  path: Path,
  callback: (
    //@ts-expect-error - not sure why, but it works so whatever
    params: Route["params"] & { authenticated: Client },
    req: Req
    //@ts-expect-error
  ) => Promise<Route["response"]>
) {
  app.post(path, async (req, res) => {
    const authenticated = getAuthenticated(req);
    if (!authenticated) return res.status(401).json({ err: "Unauthorized" });
    res.status(200).json(await callback({ ...(<any>req.body), authenticated }, req));
  });
}

initRoutes();

const server = createServer(app);

const sockets = new ws.Server({
  server,
});
sockets.on("connection", (ws) => {
  Logger.debug(`Received connection.`);
  ws.once("message", (d) => {
    try {
      const packet: { type: "Authenticate"; token: string } = JSON.parse(d.toString());
      if (packet.type == "Authenticate" && typeof packet.token == "string")
        handleConnection(ws, packet.token);
      else ws.close();
    } catch {
      ws.close();
    }
  });
});

server.listen(config.port, () => {
  Logger.log(`Listening on port ${config.port}.`);
});

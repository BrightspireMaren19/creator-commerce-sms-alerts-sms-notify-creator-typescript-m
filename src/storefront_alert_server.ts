import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";

import { alertEventSchema, processCreatorEvent } from "./creator_alert.js";
import { InfraiError } from "./infrai_sms.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST" || request.url !== "/creator-events") {
    json(response, 404, { error: "route not found" });
    return;
  }

  try {
    const event = alertEventSchema.parse(await readJson(request));
    const result = await processCreatorEvent(event);
    json(response, result.outcome === "sent" ? 201 : 200, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "internal error" });
  }
}

if (process.env.NODE_ENV !== "test") {
  createServer((request, response) => {
    void handleRequest(request, response);
  }).listen(port, () => console.log(`Creator alert service listening on http://localhost:${port}`));
}

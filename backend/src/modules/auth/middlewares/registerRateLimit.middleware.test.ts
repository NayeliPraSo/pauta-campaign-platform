
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { registerRateLimit } from "./registerRateLimit.middleware.js";

const app = express();

app.post("/register", registerRateLimit, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Solicitud permitida.",
  });
});

let server: Server;
let baseUrl: string;

before(async () => {
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });
  });

  const address = server.address() as AddressInfo;

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("Permite las primeras cinco solicitudes de registro", async () => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
    });

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.deepEqual(body, {
      success: true,
      message: "Solicitud permitida.",
    });
  }
});

test("Bloquea la sexta solicitud con HTTP 429", async () => {
  const response = await fetch(`${baseUrl}/register`, {
    method: "POST",
  });

  assert.equal(response.status, 429);

  const body = await response.json();

  assert.deepEqual(body, {
    success: false,
    message:
      "Demasiados intentos de registro. Inténtalo nuevamente más tarde.",
  });

  assert.ok(response.headers.get("ratelimit"));
});

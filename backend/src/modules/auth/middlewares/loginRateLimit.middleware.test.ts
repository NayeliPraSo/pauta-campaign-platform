
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { loginRateLimit } from "./loginRateLimit.middleware.js";

const app = express();

app.post("/login", loginRateLimit, (_req, res) => {
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

test("Permite las primeras cinco solicitudes de login", async () => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(`${baseUrl}/login`, {
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

test("Bloquea la sexta solicitud de login con HTTP 429", async () => {
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
  });

  assert.equal(response.status, 429);

  const body = await response.json();

  assert.deepEqual(body, {
    success: false,
    message:
      "Demasiados intentos de inicio de sesión. Inténtalo nuevamente más tarde.",
  });

  assert.ok(response.headers.get("ratelimit"));
});

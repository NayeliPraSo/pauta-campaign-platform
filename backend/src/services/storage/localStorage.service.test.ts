
import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";

import { LocalStorageService } from "./localStorage.service.js";

test("Guarda un archivo con un nombre generado y permite eliminarlo", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pauta-tickets-"),
  );

  try {
    const storage = new LocalStorageService(directory);
    const content = Buffer.from("Archivo de prueba");

    const stored = await storage.save(content, "ticket.png");

    assert.match(
      stored.key,
      /^[0-9a-f-]{36}\.png$/,
    );

    const savedContent = await readFile(
      path.join(directory, stored.key),
    );

    assert.deepEqual(savedContent, content);

    await storage.delete(stored.key);

    await assert.rejects(
      stat(path.join(directory, stored.key)),
      { code: "ENOENT" },
    );
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});

test("Rechaza archivos vacíos", async () => {
  const storage = new LocalStorageService();

  await assert.rejects(
    storage.save(Buffer.alloc(0), "ticket.png"),
    /tamaño del archivo es inválido/,
  );
});

test("Rechaza archivos mayores a 10 MB", async () => {
  const storage = new LocalStorageService();

  await assert.rejects(
    storage.save(
      Buffer.alloc(10 * 1024 * 1024 + 1),
      "ticket.png",
    ),
    /tamaño del archivo es inválido/,
  );
});

test("Rechaza extensiones no permitidas", async () => {
  const storage = new LocalStorageService();

  await assert.rejects(
    storage.save(Buffer.from("prueba"), "ticket.exe"),
    /extensión del archivo no está permitida/,
  );
});

test("Rechaza referencias de archivo inválidas", async () => {
  const storage = new LocalStorageService();

  await assert.rejects(
    storage.delete("../archivo.png"),
    /referencia del archivo es inválida/,
  );
});

test("Genera nombres diferentes para archivos distintos", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pauta-tickets-"),
  );

  try {
    const storage = new LocalStorageService(directory);

    const first = await storage.save(
      Buffer.from("Archivo 1"),
      "ticket.png",
    );

    const second = await storage.save(
      Buffer.from("Archivo 2"),
      "ticket.png",
    );

    assert.notEqual(first.key, second.key);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});

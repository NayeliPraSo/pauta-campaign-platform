
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

/**
 * Crea un buffer con la firma de un PNG.
 *
 * Es suficiente para probar la detección
 * de formato implementada actualmente.
 * No representa una imagen completa.
 */
function createPngBuffer(content = "Archivo de prueba"): Buffer {
  const signature = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  return Buffer.concat([
    signature,
    Buffer.from(content),
  ]);
}

/**
 * Crea un buffer con la firma de un JPEG.
 *
 * No representa una imagen completa.
 */
function createJpegBuffer(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0,
    0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01,
  ]);
}

test(
  "Guarda un archivo con un nombre generado y permite eliminarlo",
  async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "pauta-tickets-"),
    );

    try {
      const storage = new LocalStorageService(directory);
      const content = createPngBuffer();

      const stored = await storage.save(
        content,
        "ticket.png",
      );

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
  },
);

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
    storage.save(
      createPngBuffer(),
      "ticket.exe",
    ),
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

test(
  "Genera nombres diferentes para archivos distintos",
  async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "pauta-tickets-"),
    );

    try {
      const storage = new LocalStorageService(directory);

      const first = await storage.save(
        createPngBuffer("Archivo 1"),
        "ticket.png",
      );

      const second = await storage.save(
        createPngBuffer("Archivo 2"),
        "ticket.png",
      );

      assert.notEqual(first.key, second.key);

      assert.match(
        first.key,
        /^[0-9a-f-]{36}\.png$/,
      );

      assert.match(
        second.key,
        /^[0-9a-f-]{36}\.png$/,
      );
    } finally {
      await rm(directory, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "Rechaza archivos cuya extensión no coincide con el contenido",
  async () => {
    const storage = new LocalStorageService();

    await assert.rejects(
      storage.save(
        createPngBuffer(),
        "ticket.jpg",
      ),
      /tipo de archivo declarado no coincide con su contenido/,
    );
  },
);

test(
  "Normaliza los archivos JPEG a extensión .jpg",
  async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "pauta-tickets-"),
    );

    try {
      const storage = new LocalStorageService(directory);

      const stored = await storage.save(
        createJpegBuffer(),
        "ticket.jpeg",
      );

      assert.match(
        stored.key,
        /^[0-9a-f-]{36}\.jpg$/,
      );

      const savedContent = await readFile(
        path.join(directory, stored.key),
      );

      assert.deepEqual(
        savedContent,
        createJpegBuffer(),
      );
    } finally {
      await rm(directory, {
        recursive: true,
        force: true,
      });
    }
  },
);

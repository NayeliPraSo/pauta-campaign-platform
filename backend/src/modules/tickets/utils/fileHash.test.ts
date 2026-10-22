
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  calculateBufferHash,
  calculateFileHash,
} from "./fileHash";

test("Genera un SHA-256 de 64 caracteres", () => {
  const hash = calculateBufferHash(
    Buffer.from("Ticket de prueba"),
  );

  assert.match(hash, /^[a-f0-9]{64}$/);
});

test("El mismo contenido produce el mismo hash", () => {
  const content = Buffer.from("Ticket de prueba");

  const firstHash = calculateBufferHash(content);
  const secondHash = calculateBufferHash(content);

  assert.equal(firstHash, secondHash);
});

test("Contenido diferente produce hashes diferentes", () => {
  const firstHash = calculateBufferHash(
    Buffer.from("Ticket A"),
  );

  const secondHash = calculateBufferHash(
    Buffer.from("Ticket B"),
  );

  assert.notEqual(firstHash, secondHash);
});

test("Archivo y buffer producen el mismo hash", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pauta-ticket-"),
  );

  const filePath = path.join(directory, "ticket.txt");
  const content = Buffer.from("Contenido del ticket");

  try {
    await writeFile(filePath, content);

    const fileHash = await calculateFileHash(filePath);
    const bufferHash = calculateBufferHash(content);

    assert.equal(fileHash, bufferHash);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});

test("Propaga el error si el archivo no existe", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pauta-ticket-"),
  );

  try {
    await assert.rejects(
      calculateFileHash(
        path.join(directory, "inexistente.pdf"),
      ),
    );
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});

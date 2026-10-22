
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function calculateBufferHash(
  buffer: Buffer,
): string {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

export async function calculateFileHash(
  filePath: string,
): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

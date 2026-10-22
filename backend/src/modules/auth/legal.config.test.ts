
import assert from "node:assert/strict";
import { after, test } from "node:test";

import { getLegalDocumentVersions } from "./legal.config.js";

const originalTermsVersion = process.env.TERMS_VERSION;
const originalPrivacyVersion = process.env.PRIVACY_VERSION;

after(() => {
  if (originalTermsVersion === undefined) {
    delete process.env.TERMS_VERSION;
  } else {
    process.env.TERMS_VERSION = originalTermsVersion;
  }

  if (originalPrivacyVersion === undefined) {
    delete process.env.PRIVACY_VERSION;
  } else {
    process.env.PRIVACY_VERSION = originalPrivacyVersion;
  }
});

test("Obtiene las versiones legales configuradas", () => {
  process.env.TERMS_VERSION = "test-1.0";
  process.env.PRIVACY_VERSION = "test-2.0";

  const versions = getLegalDocumentVersions();

  assert.deepEqual(versions, {
    termsVersion: "test-1.0",
    privacyVersion: "test-2.0",
  });
});

test("Elimina espacios al principio y al final", () => {
  process.env.TERMS_VERSION = "  test-1.0  ";
  process.env.PRIVACY_VERSION = "  test-2.0  ";

  const versions = getLegalDocumentVersions();

  assert.equal(versions.termsVersion, "test-1.0");
  assert.equal(versions.privacyVersion, "test-2.0");
});

test("Rechaza versiones no configuradas", () => {
  delete process.env.TERMS_VERSION;
  delete process.env.PRIVACY_VERSION;

  assert.throws(
    () => getLegalDocumentVersions(),
    /no están configuradas correctamente/,
  );
});

test("Rechaza una versión de términos demasiado larga", () => {
  process.env.TERMS_VERSION = "A".repeat(51);
  process.env.PRIVACY_VERSION = "test-1.0";

  assert.throws(
    () => getLegalDocumentVersions(),
    /no están configuradas correctamente/,
  );
});

test("Rechaza una versión de privacidad demasiado larga", () => {
  process.env.TERMS_VERSION = "test-1.0";
  process.env.PRIVACY_VERSION = "A".repeat(51);

  assert.throws(
    () => getLegalDocumentVersions(),
    /no están configuradas correctamente/,
  );
});

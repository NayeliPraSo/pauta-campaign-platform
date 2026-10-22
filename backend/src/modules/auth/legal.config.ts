
export interface LegalDocumentVersions {
  termsVersion: string;
  privacyVersion: string;
}

export function getLegalDocumentVersions(): LegalDocumentVersions {
  const termsVersion = process.env.TERMS_VERSION?.trim();
  const privacyVersion = process.env.PRIVACY_VERSION?.trim();

  if (
    !termsVersion ||
    termsVersion.length > 50 ||
    !privacyVersion ||
    privacyVersion.length > 50
  ) {
    throw new Error(
      "Las versiones de los documentos legales no están configuradas correctamente.",
    );
  }

  return {
    termsVersion,
    privacyVersion,
  };
}

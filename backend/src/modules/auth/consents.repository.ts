
import type { PoolClient } from "pg";

export interface CreateParticipantConsentData {
  participant_id: string;
  terms_version: string;
  privacy_version: string;
}

export async function createParticipantConsent(
  client: PoolClient,
  data: CreateParticipantConsentData,
): Promise<void> {
  await client.query(
    `
      INSERT INTO participant_consents (
        participant_id,
        terms_version,
        privacy_version
      )
      VALUES ($1, $2, $3)
    `,
    [
      data.participant_id,
      data.terms_version,
      data.privacy_version,
    ],
  );
}


import "dotenv/config";
import VeryfiClient from "@veryfi/veryfi-sdk";

const {
  VERYFI_CLIENT_ID,
  VERYFI_CLIENT_SECRET,
  VERYFI_USERNAME,
  VERYFI_API_KEY,
} = process.env;

const requiredCredentials = {
  VERYFI_CLIENT_ID,
  VERYFI_CLIENT_SECRET,
  VERYFI_USERNAME,
  VERYFI_API_KEY,
};

const missingCredentials = Object.entries(requiredCredentials)
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name);

if (missingCredentials.length > 0) {
  throw new Error(
    `Faltan credenciales de Veryfi: ${missingCredentials.join(", ")}`,
  );
}

export const veryfiClient = new VeryfiClient(
  VERYFI_CLIENT_ID!,
  VERYFI_CLIENT_SECRET!,
  VERYFI_USERNAME!,
  VERYFI_API_KEY!,
);

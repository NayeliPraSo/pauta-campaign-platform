import { findTicketByFileHash } from "../duplicateRepository";
import { validateTicket } from "./engine";

import type {
  TicketData,
  TicketValidationResult,
  ValidationRule,
} from "./types";

type DuplicateLookup = (
  fileHash: string,
  excludeTicketId?: string,
) => Promise<{ id: string; status: string } | null>;

export async function validateTicketWithDatabase(
  ticket: TicketData,
  rules: ValidationRule[],
  findDuplicate: DuplicateLookup = findTicketByFileHash,
  currentTicketId?: string,
): Promise<TicketValidationResult> {
  const duplicateRuleEnabled = rules.some(
    (rule) =>
      rule.rule_type === "duplicate_ticket" &&
      rule.is_enabled,
  );

  if (!duplicateRuleEnabled) {
    return validateTicket(
      { ...ticket, duplicate_ticket_id: undefined },
      rules,
    );
  }

  const preparedTicket: TicketData = {
    ...ticket,
    duplicate_ticket_id: undefined,
  };

  if (
    typeof ticket.file_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(ticket.file_hash)
  ) {
    return validateTicket(preparedTicket, rules);
  }

  const existingTicket = await findDuplicate(
    ticket.file_hash,
    currentTicketId,
  );

  preparedTicket.duplicate_ticket_id =
    existingTicket?.id ?? null;

  return validateTicket(preparedTicket, rules);
}
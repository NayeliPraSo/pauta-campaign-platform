
import type {
  TicketData,
  TicketValidationResult,
  ValidationRule,
  RuleValidationResult,
} from "./types";

import { validateMinimumAmount } from "./minimumAmount";
import { validatePurchaseDateRange } from "./purchaseDateRange";

export function validateTicket(
  ticket: TicketData,
  rules: ValidationRule[],
): TicketValidationResult {
  const results: RuleValidationResult[] = [];

  const activeRules = rules.filter((rule) => rule.is_enabled);

  if (activeRules.length === 0) {
    return {
        status: "requires_review",
        results: [],
    };
   }

  let shouldReject = false;
  let requiresReview = false;

  for (const rule of activeRules) {

    let result: RuleValidationResult;

    switch (rule.rule_type) {
      case "minimum_amount":
        result = validateMinimumAmount(rule, ticket);
        break;

      case "purchase_date_range":
        result = validatePurchaseDateRange(rule, ticket);
        break;

      default:
        result = {
          rule_id: rule.id,
          rule_type: rule.rule_type,
          passed: null,
          reason: `La regla ${rule.rule_type} todavía no está implementada.`,
        };
    }

    results.push(result);

    if (result.passed === null) {
      requiresReview = true;
      continue;
    }

    if (result.passed === false) {
        if (rule.failure_action === "rejected") {
            shouldReject = true;
        } else {
            requiresReview = true;
        }
        }

        if (
            rule.failure_action !== "rejected" &&
            rule.failure_action !== "requires_review"
        ) {
            requiresReview = true;
    }
  }

  if (shouldReject) {
    return {
      status: "rejected",
      results,
    };
  }

  if (requiresReview) {
    return {
      status: "requires_review",
      results,
    };
  }

  return {
    status: "approved",
    results,
  };
}

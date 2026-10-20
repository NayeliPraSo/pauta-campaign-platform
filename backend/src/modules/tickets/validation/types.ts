
export type ValidationRuleType =
  | "purchase_date_range"
  | "minimum_amount"
  | "allowed_merchants"
  | "required_products"
  | "duplicate_ticket";

export type ValidationFailureAction =
  | "rejected"
  | "requires_review";

export type TicketValidationStatus =
  | "approved"
  | "rejected"
  | "requires_review";

export interface ValidationRule {
  id: string;
  rule_type: ValidationRuleType;
  configuration: Record<string, unknown>;
  failure_action: ValidationFailureAction;
  is_enabled: boolean;
}

export interface TicketProduct {
  description: string;
  quantity?: number;
  total?: number;
}

export interface TicketData {
  merchant_name?: string | null;
  purchase_date?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  products?: TicketProduct[];
}

export interface RuleValidationResult {
  rule_id: string;
  rule_type: ValidationRuleType;
  passed: boolean | null;
  reason?: string;
}

export interface TicketValidationResult {
  status: TicketValidationStatus;
  results: RuleValidationResult[];
}

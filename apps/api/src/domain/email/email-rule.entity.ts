export interface EmailRule {
  id: string;
  name: string;
  conditionField: "from" | "subject" | "domain";
  conditionOperator: "contains" | "equals" | "startsWith" | "endsWith";
  conditionValue: string;
  actionType: "classify" | "star" | "archive";
  actionValue: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailRuleInput {
  name: string;
  conditionField: "from" | "subject" | "domain";
  conditionOperator: "contains" | "equals" | "startsWith" | "endsWith";
  conditionValue: string;
  actionType: "classify" | "star" | "archive";
  actionValue: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface UpdateEmailRuleInput {
  name?: string;
  conditionField?: "from" | "subject" | "domain";
  conditionOperator?: "contains" | "equals" | "startsWith" | "endsWith";
  conditionValue?: string;
  actionType?: "classify" | "star" | "archive";
  actionValue?: string;
  enabled?: boolean;
  sortOrder?: number;
}

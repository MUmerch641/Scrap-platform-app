export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_OPERATIONS: 'admin_operations',
  HEAD_OPERATIONS: 'head_operations',
  ASSISTANT: 'assistant',
  SALES_REP: 'sales_rep',
  DRIVER: 'driver',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = Object.values(ROLES) as readonly Role[];

export const MOBILE_ROLES = [ROLES.DRIVER, ROLES.SALES_REP] as const;

export const OPERATIONS_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN_OPERATIONS,
  ROLES.HEAD_OPERATIONS,
  ROLES.ASSISTANT,
] as const;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role);
}

export function isMobileRole(value: Role): value is (typeof MOBILE_ROLES)[number] {
  return MOBILE_ROLES.includes(value as (typeof MOBILE_ROLES)[number]);
}

export function isOperationsRole(value: Role): value is (typeof OPERATIONS_ROLES)[number] {
  return OPERATIONS_ROLES.includes(value as (typeof OPERATIONS_ROLES)[number]);
}

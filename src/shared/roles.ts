export const ROLES = {
  ADMIN: 'admin',
  SALES_REP: 'sales_rep',
  DRIVER: 'driver',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = Object.values(ROLES) as readonly Role[];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role);
}

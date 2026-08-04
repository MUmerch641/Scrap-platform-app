import type { Role } from './roles';

export type Identifier = string;
export type IsoDateTime = string;

export interface AuthenticatedActor {
  id: Identifier;
  role: Role;
}

export interface PageRequest {
  cursor?: string;
  limit?: number;
}

export interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

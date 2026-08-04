export type FieldErrors<T> = Partial<Record<keyof T, readonly string[]>>;

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure<T> {
  success: false;
  fieldErrors: FieldErrors<T>;
  formErrors: readonly string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure<T>;

export interface Validator<T> {
  parse(input: unknown): T;
  safeParse(input: unknown): ValidationResult<T>;
}

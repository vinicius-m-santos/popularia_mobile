/** Validações de formulário feitas no aparelho. O servidor deve repetir todas elas. */

export const PASSWORD_MIN_LENGTH = 8;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

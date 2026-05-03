export type PasswordPolicyResult = { ok: true } | { ok: false; reason: string };

// Password policy (server-side, enforced at registration & password change)
// - Min length: 6
// - Max length: 128
// No complexity requirements — users are nudged toward stronger passwords in the UI instead.
export function checkPasswordPolicy(password: string, email?: string | null): PasswordPolicyResult {
  if (typeof password !== 'string') return { ok: false, reason: 'Password is required' };

  const trimmed = password;
  if (trimmed.length < 6) return { ok: false, reason: 'Password must be at least 6 characters' };
  if (trimmed.length > 128) return { ok: false, reason: 'Password must be at most 128 characters' };

  return { ok: true };
}

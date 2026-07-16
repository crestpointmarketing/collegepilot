import type { User } from '@supabase/supabase-js';

type DisplayableUser = Pick<User, 'id' | 'email' | 'user_metadata' | 'identities'>;

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getUserDisplay(user: DisplayableUser) {
  const identityEmail = user.identities
    ?.map(identity => nonEmptyString(identity.identity_data?.email))
    .find((email): email is string => Boolean(email));
  const email = nonEmptyString(user.email)
    ?? nonEmptyString(user.user_metadata?.email)
    ?? identityEmail;
  const label = email ?? `Account ${user.id.slice(0, 8)}`;
  const initialsSource = email?.split('@')[0] ?? user.id;

  return {
    label,
    initials: initialsSource.slice(0, 2).toUpperCase(),
  };
}

import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { getUserDisplay } from './userDisplay';

function user(overrides: Partial<User>): User {
  return {
    id: '12345678-abcd-4321-abcd-1234567890ab',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('getUserDisplay', () => {
  it('shows the authenticated email instead of a generic role label', () => {
    expect(getUserDisplay(user({ email: 'vivianxie30@gmail.com' }))).toEqual({
      label: 'vivianxie30@gmail.com',
      initials: 'VI',
    });
    expect(getUserDisplay(user({ email: 'demo@gmail.com' }))).toEqual({
      label: 'demo@gmail.com',
      initials: 'DE',
    });
  });

  it('falls back to provider identity data when the top-level email is absent', () => {
    const display = getUserDisplay(user({
      identities: [{
        id: 'identity-id',
        user_id: '12345678-abcd-4321-abcd-1234567890ab',
        identity_id: 'provider-identity-id',
        provider: 'google',
        identity_data: { email: 'provider@example.com' },
      }],
    }));

    expect(display.label).toBe('provider@example.com');
    expect(display.initials).toBe('PR');
  });

  it('uses a unique account id instead of calling every unknown user Counselor', () => {
    expect(getUserDisplay(user({}))).toEqual({
      label: 'Account 12345678',
      initials: '12',
    });
  });
});

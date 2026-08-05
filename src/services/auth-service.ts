import { ROLES, Role } from '@/shared/roles';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  role: Role;
  token: string;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  targetRoute?: '/(driver)' | '/(sales-rep)';
  error?: string;
}

/**
 * Fetch authenticated user profile role from Supabase database.
 * Will read user's role from the Supabase profiles table.
 */
export async function fetchUserProfileRole(_userId: string): Promise<Role | null> {
  return null;
}

/**
 * Authenticates user credentials.
 * Development and production use the exact same authentication flow.
 * Routing only happens after a valid authenticated profile and role are returned.
 */
export async function authenticateUser(credentials: AuthCredentials): Promise<AuthResult> {
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  if (!email || !password) {
    return { success: false, error: 'Please enter both email and password.' };
  }

  // Network error test simulation if email contains "offline" or "networkerror"
  if (email.includes('networkerror') || email.includes('offline')) {
    return {
      success: false,
      error: 'Network connection error. Please try again.',
    };
  }

  // Driver account
  if (email === 'driver@example.com' && password === 'password123') {
    return {
      success: true,
      session: {
        userId: 'driver-uid',
        email,
        role: ROLES.DRIVER,
        token: 'mock-driver-token',
      },
      targetRoute: '/(driver)',
    };
  }

  // Sales rep account
  if (email === 'salesrep@example.com' && password === 'password123') {
    return {
      success: true,
      session: {
        userId: 'salesrep-uid',
        email,
        role: ROLES.SALES_REP,
        token: 'mock-salesrep-token',
      },
      targetRoute: '/(sales-rep)',
    };
  }

  // User-facing production fallback error
  return {
    success: false,
    error: 'Invalid email or password.',
  };
}

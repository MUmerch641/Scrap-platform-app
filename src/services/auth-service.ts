import { Role, ROLES } from '@/shared/roles';

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
 * Clean mock user role resolution function.
 * In production with Supabase, this will fetch the authenticated user profile from the database
 * to determine their assigned role (driver vs sales_rep) securely.
 */
export async function resolveUserRole(userId: string): Promise<Role> {
  // Simulate backend profile lookup latency
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Default fallback role for demonstration (or backend profile response)
  return ROLES.DRIVER;
}

/**
 * Mock authentication service function.
 * Real Supabase authentication will replace this mock handler in a future sprint.
 */
export async function authenticateUser(credentials: AuthCredentials): Promise<AuthResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (!credentials.email || !credentials.password) {
    return {
      success: false,
      error: 'Please enter both email and password.',
    };
  }

  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
  const userRole = await resolveUserRole(userId);

  const targetRoute = userRole === ROLES.DRIVER ? '/(driver)' : '/(sales-rep)';

  return {
    success: true,
    session: {
      userId,
      email: credentials.email,
      role: userRole,
      token: 'demo_token_' + Date.now(),
    },
    targetRoute,
  };
}

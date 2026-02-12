export function sanitizeError(error: any): string {
  const errorMap: Record<string, string> = {
    '23505': 'This record already exists.',
    '23503': 'Cannot complete this action due to dependencies.',
    '42501': 'You do not have permission to perform this action.',
    'PGRST116': 'You do not have permission to access this resource.',
  };

  if (error?.code && errorMap[error.code]) {
    return errorMap[error.code];
  }

  if (error?.message?.includes('row-level security')) {
    return 'You do not have permission to perform this action.';
  }

  // Auth errors that are safe to show
  if (error?.message?.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (error?.message?.includes('Email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (error?.message?.includes('User already registered')) {
    return 'An account with this email already exists.';
  }

  console.error('Application error:', error);
  return 'An unexpected error occurred. Please try again.';
}

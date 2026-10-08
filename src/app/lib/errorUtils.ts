/**
 * Centralized error formatting utility.
 * Sanitizes low-level network errors and technical jargon (such as 'Failed to fetch')
 * into user-friendly messages for UI toasts, modals, and error boundaries.
 */

export function formatUserErrorMessage(error: unknown, fallback = 'Unable to complete request.'): string {
  if (!error) return fallback;

  const raw = typeof error === 'string' 
    ? error 
    : (error as { message?: string })?.message || String(error);

  const lower = raw.toLowerCase();

  // Low-level fetch and browser network exceptions
  if (
    lower.includes('failed to fetch') || 
    lower.includes('fetch failed') || 
    lower.includes('networkerror') || 
    lower.includes('load failed') ||
    lower.includes('err_connection_refused') ||
    lower.includes('err_name_not_resolved')
  ) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Abort and timeout exceptions
  if (lower.includes('signal is aborted') || lower.includes('aborterror') || lower.includes('timed out')) {
    return 'Connection timed out. Please try again.';
  }

  // Supabase postgrest / network errors
  if (lower.includes('jwt expired') || lower.includes('token expired')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  return raw;
}


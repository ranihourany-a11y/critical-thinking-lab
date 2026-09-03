/**
 * Client-safe teacher redirect validation.
 * Sanitizes open redirects and preserves safe internal teacher relative paths.
 */
export function getSafeTeacherRedirect(nextParam?: string | null): string {
  if (!nextParam || typeof nextParam !== 'string') {
    return '/teacher';
  }

  const trimmed = nextParam.trim();

  // Deny absolute URLs, protocol-relative URLs, and path traversal tricks
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.includes('://') ||
    trimmed.includes('\\')
  ) {
    return '/teacher';
  }

  // Must strictly be an internal relative path starting with /teacher
  if (trimmed === '/teacher' || trimmed.startsWith('/teacher/')) {
    return trimmed;
  }

  return '/teacher';
}

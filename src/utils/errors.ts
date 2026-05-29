/**
 * Sanitizes and friendly-formats raw system, database, and network errors for the end-user.
 * Prevents exposing internal database schemas, syntax errors, and stack traces in production.
 */
export function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/u, "")
    .replace(/^Error:\s*/u, "");

  const normalizedMessage = message.toLowerCase();

  // Log all raw errors to console for developer diagnosis (inspectable in logs or DevTools)
  console.error("Original Application Error:", error);

  // List of recognized safe user-facing/validation errors
  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("pwned") ||
      normalizedMessage.includes("haveibeenpwned") ||
      normalizedMessage.includes("compromised") ||
      normalizedMessage.includes("leaked"))
  ) {
    return "Choose a stronger password that has not appeared in known data breaches.";
  }

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return "Too many email requests were sent. Wait a few minutes and try again.";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "An account already exists for this email address.";
  }

  if (normalizedMessage.includes("your employee account is inactive")) {
    return "Your employee account is inactive. Contact an administrator.";
  }

  if (normalizedMessage.includes("please log in first")) {
    return "Please log in first.";
  }

  // In production, check if the error is likely a system/database/connection error
  const isSystemError =
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("no handler registered") ||
    normalizedMessage.includes("relation") ||
    normalizedMessage.includes("column") ||
    normalizedMessage.includes("postgres") ||
    normalizedMessage.includes("supabase") ||
    normalizedMessage.includes("sql") ||
    normalizedMessage.includes("database") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("internal server error") ||
    normalizedMessage.includes("500") ||
    normalizedMessage.includes("502") ||
    normalizedMessage.includes("503") ||
    normalizedMessage.includes("504") ||
    normalizedMessage.includes("permission denied") ||
    normalizedMessage.includes("syntax error") ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("tours root folder does not exist");

  if (isSystemError) {
    return fallback;
  }

  // Return fallback for any unrecognized error in production to guarantee clean UI
  return fallback;
}

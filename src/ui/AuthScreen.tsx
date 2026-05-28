import { useState, type FormEvent } from "react";
import logo from "../assets/logo.png";
import type { AuthState } from "../../electron/shared/types";
import { friendlyErrorMessage } from "../utils/errors";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthScreenProps {
  onAuthenticated: (state: AuthState) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [employeeName, setEmployeeName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [status, setStatus] = useState("Sign in with your company account");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (
      !window.meridian ||
      !window.meridian.signIn ||
      !window.meridian.signUp
    ) {
      setStatus(
        "Auth bridge unavailable. Run npm run build, then fully restart Electron.",
      );
      return;
    }

    if (!emailPattern.test(email)) {
      setStatus("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const state =
        mode === "login"
          ? await window.meridian.signIn({ email, password, rememberMe })
          : await window.meridian.signUp({
              email,
              password,
              employeeName,
              rememberMe,
            });

      if (state.isAuthenticated) {
        setPassword("");
        onAuthenticated(state);
        return;
      }

      setPassword("");
      if (mode === "signup") {
        setMode("login");
      }
      setStatus(
        state.message ||
          "Check your email to confirm the account, then sign in.",
      );
    } catch (error) {
      setStatus(friendlyErrorMessage(error, "Authentication failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!window.meridian?.resetPassword) {
      setStatus("Password reset is unavailable. Restart the application.");
      return;
    }

    if (!email) {
      setStatus("Enter your email first, then use forgot password.");
      return;
    }

    if (!emailPattern.test(email)) {
      setStatus("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await window.meridian.resetPassword(email);
      setPassword("");
      setStatus(result.message);
    } catch (error) {
      setStatus(
        friendlyErrorMessage(error, "Unable to send password reset email"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cloud px-6 text-ink">
      <form className="app-panel w-full max-w-md p-8" onSubmit={handleSubmit}>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-app overflow-hidden bg-cloud">
            <img
              src={logo}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-navy">
              Meridian Voucher Studio
            </h1>
            <p className="text-sm text-steel">
              {mode === "login" ? "Employee Login" : "Create Employee Account"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <label className="block space-y-2">
              <span className="app-label">Employee Name</span>
              <input
                className="app-input"
                value={employeeName}
                onChange={(event) => setEmployeeName(event.target.value)}
                required
              />
            </label>
          )}
          <label className="block space-y-2">
            <span className="app-label">Email</span>
            <input
              className="app-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="app-label">Password</span>
            <input
              className="app-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-steel">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-navy"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me
          </label>
        </div>

        <p className="mt-5 min-h-5 text-sm font-medium text-steel">{status}</p>

        <button
          className="app-button-primary mt-5 w-full"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Please wait"
            : mode === "login"
              ? "Login"
              : "Sign Up"}
        </button>

        <button
          type="button"
          className="app-button-ghost mt-4 w-full"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setPassword("");
            setStatus(
              mode === "login"
                ? "Create an account with your company email"
                : "Sign in with your company account",
            );
          }}
        >
          {mode === "login" ? "Create account" : "Back to login"}
        </button>
        {mode === "login" && (
          <button
            type="button"
            className="app-button-ghost mt-3 w-full text-steel"
            disabled={isSubmitting}
            onClick={handleForgotPassword}
          >
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}

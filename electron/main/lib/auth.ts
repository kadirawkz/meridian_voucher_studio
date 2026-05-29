import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";

// Safe import of Electron to support standalone server mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
try {
  const electron = await import("electron");
  app = electron.app;
} catch {
  app = {
    getPath: (name: string) => {
      if (name === "userData") {
        return path.join(process.cwd(), "data");
      }
      return os.tmpdir();
    },
  };
}
import type {
  AccountProfile,
  AuthCredentials,
  AuthState,
} from "../../shared/types.js";

let supabase: SupabaseClient | null = null;
const sessionFileName = "auth-session.json";
let sessionRestorePromise: Promise<void> | null = null;
let isSessionRestored = false;

function getSessionPath(): string {
  return path.join(app.getPath("userData"), sessionFileName);
}

async function saveRememberedSession(session: unknown): Promise<void> {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getSessionPath(), JSON.stringify(session), {
    encoding: "utf8",
  });
}

async function clearRememberedSession(): Promise<void> {
  await fs.rm(getSessionPath(), { force: true });
}

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabase) {
    supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
      realtime: {
        transport: WebSocket as unknown as WebSocketLikeConstructor,
      },
    });
  }

  return supabase;
}

async function restoreRememberedSession(client: SupabaseClient): Promise<void> {
  try {
    const rawSession = await fs.readFile(getSessionPath(), "utf8");
    const session = JSON.parse(rawSession) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (session.access_token && session.refresh_token) {
      const { error } = await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (error) {
        await clearRememberedSession();
      }
    }
  } catch {
    // No remembered session yet.
  }
}

async function ensureRememberedSessionRestored(
  client: SupabaseClient,
): Promise<void> {
  if (isSessionRestored) {
    return;
  }

  if (!sessionRestorePromise) {
    sessionRestorePromise = restoreRememberedSession(client)
      .catch(() => {
        // Ignore restore failures and continue with auth fallback flow.
      })
      .finally(() => {
        isSessionRestored = true;
        sessionRestorePromise = null;
      });
  }

  await sessionRestorePromise;
}

type EmployeeProfileRow = {
  id: string;
  employee_name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  is_active: boolean;
};

function fallbackProfileFromUser(user: User | null): AccountProfile {
  if (!user) {
    return {
      employeeName: "",
      employeeEmail: "",
      role: "employee",
      isActive: false,
    };
  }

  const displayName =
    typeof user.user_metadata?.employeeName === "string"
      ? user.user_metadata.employeeName
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  return {
    id: user.id,
    employeeName: displayName || user.email?.split("@")[0] || "",
    employeeEmail: user.email || "",
    role: "employee",
    isActive: true,
  };
}

async function upsertEmployeeProfile(
  client: SupabaseClient,
  user: User,
  employeeName?: string,
): Promise<AccountProfile> {
  const fallback = fallbackProfileFromUser(user);
  const row = {
    id: user.id,
    employee_name: employeeName || fallback.employeeName,
    email: user.email || fallback.employeeEmail,
    role: "employee" as const,
    is_active: true,
  };

  const { data, error } = await client
    .from("employee_profiles")
    .upsert(row, { onConflict: "id" })
    .select("id, employee_name, email, role, is_active")
    .single();

  if (error) {
    return fallback;
  }

  return profileFromRow(data);
}

function profileFromRow(row: EmployeeProfileRow): AccountProfile {
  return {
    id: row.id,
    employeeName: row.employee_name,
    employeeEmail: row.email,
    role: row.role,
    isActive: row.is_active,
  };
}

async function getEmployeeProfile(
  client: SupabaseClient,
  user: User,
): Promise<AccountProfile> {
  const { data, error } = await client
    .from("employee_profiles")
    .select("id, employee_name, email, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return upsertEmployeeProfile(client, user);
  }

  return profileFromRow(data);
}

export async function signIn(credentials: AuthCredentials): Promise<AuthState> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.",
    );
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (credentials.rememberMe && data.session) {
    await saveRememberedSession(data.session);
  } else {
    await clearRememberedSession();
  }
  isSessionRestored = true;

  return {
    isAuthenticated: Boolean(data.session),
    profile: data.user ? await getEmployeeProfile(client, data.user) : null,
  };
}

export async function signUp(credentials: AuthCredentials): Promise<AuthState> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.",
    );
  }

  const { data, error } = await client.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        employeeName: credentials.employeeName,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (credentials.rememberMe && data.session) {
    await saveRememberedSession(data.session);
  }
  isSessionRestored = true;

  return {
    isAuthenticated: Boolean(data.session),
    profile: data.user
      ? await upsertEmployeeProfile(client, data.user, credentials.employeeName)
      : null,
    message: data.session
      ? "Account created"
      : "Account created. Check email if confirmation is enabled.",
  };
}

export async function signOut(): Promise<AuthState> {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  await clearRememberedSession();
  isSessionRestored = false;

  return {
    isAuthenticated: false,
    profile: null,
  };
}

export async function resetPassword(
  email: string,
): Promise<{ message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.",
    );
  }

  const { error } = await client.auth.resetPasswordForEmail(email);

  if (error) {
    throw new Error(error.message);
  }

  return {
    message: "Password reset email sent",
  };
}

export async function getAuthState(): Promise<AuthState> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      isAuthenticated: false,
      profile: null,
      message: "Supabase is not configured",
    };
  }

  await ensureRememberedSessionRestored(client);
  const { data } = await client.auth.getUser();

  return {
    isAuthenticated: Boolean(data.user),
    profile: data.user ? await getEmployeeProfile(client, data.user) : null,
  };
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const state = await getAuthState();

  return (
    state.profile ?? {
      employeeName: "",
      employeeEmail: "",
    }
  );
}

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  await ensureRememberedSessionRestored(client);
  const { data, error } = await client.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function getCurrentEmployeeProfile(
  user?: User,
): Promise<AccountProfile | null> {
  const client = getSupabaseClient();
  const resolvedUser = user ?? (await getCurrentUser());

  if (!client || !resolvedUser) {
    return null;
  }

  return getEmployeeProfile(client, resolvedUser);
}

export function getAuthenticatedSupabaseClient(): SupabaseClient | null {
  return getSupabaseClient();
}

export async function updateProfile(updates: {
  employeeName?: string;
  employeeEmail?: string;
}): Promise<AccountProfile> {
  const client = getSupabaseClient();
  const user = await getCurrentUser();

  if (!client || !user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await client
    .from("employee_profiles")
    .update({
      employee_name: updates.employeeName,
      email: updates.employeeEmail,
    })
    .eq("id", user.id)
    .select("id, employee_name, email, role, is_active")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return profileFromRow(data);
}

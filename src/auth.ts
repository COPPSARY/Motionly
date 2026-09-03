export interface MotionlyUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

interface AuthResponse {
  readonly data: { readonly user: MotionlyUser; readonly csrfToken: string };
}

const API_URL =
  import.meta.env["VITE_MOTIONLY_API_URL"] ||
  (typeof window !== "undefined" &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "https://motionly-backend.onrender.com"
    : "http://localhost:3000");
let csrfToken = "";

export function currentCsrfToken(): string {
  return csrfToken;
}

export async function currentMotionlyUser(): Promise<MotionlyUser | null> {
  try {
    const response = await fetch(`${API_URL}/v1/auth/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const session = ((await response.json()) as AuthResponse).data;
    csrfToken = session.csrfToken;
    return session.user;
  } catch {
    return null;
  }
}

export function motionlyLoginUrl(): string {
  return `${API_URL}/v1/auth/google`;
}

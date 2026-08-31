export interface MotionlyUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

interface AuthResponse {
  readonly data: { readonly user: MotionlyUser };
}

interface MotionlyConfig {
  readonly motionlyApiUrl?: string;
}

const LOCAL_API_URL = "http://localhost:3000";
const PRODUCTION_API_URL = "https://api.motionly.site";

function apiUrl(): string {
  if (typeof window !== "undefined") {
    const config = (window as Window & { __MOTIONLY_CONFIG__?: MotionlyConfig })
      .__MOTIONLY_CONFIG__;
    return (
      config?.motionlyApiUrl?.replace(/\/$/, "") ||
      import.meta.env["VITE_MOTIONLY_API_URL"] ||
      (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? LOCAL_API_URL
        : PRODUCTION_API_URL)
    );
  }
  return import.meta.env["VITE_MOTIONLY_API_URL"] || LOCAL_API_URL;
}

export async function currentMotionlyUser(): Promise<MotionlyUser | null> {
  try {
    const response = await fetch(`${apiUrl()}/v1/auth/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return ((await response.json()) as AuthResponse).data.user;
  } catch {
    return null;
  }
}

export function motionlyLoginUrl(): string {
  return `${apiUrl()}/v1/auth/google`;
}

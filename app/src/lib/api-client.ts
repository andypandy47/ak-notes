import { env } from "@/config/environment";

function apiBase() {
  if (env.DEV) {
    return "/api/v1";
  }
  const base = env.VITE_API_URL;
  if (!base || new URL(base).protocol !== "https:") {
    throw new Error("Configure an HTTPS API URL before using a packaged app.");
  }
  return base.replace(/\/$/, "") + "/api/v1";
}

export async function apiRequest(token: string, suffix: string, init: RequestInit = {}) {
  const url = apiBase() + suffix;
  try {
    return await fetch(url, {
      ...init,
      redirect: "error",
      cache: "no-store",
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Could not reach the API. Check that the local API is running, then retry.");
  }
}

export function checkApiStatus(response: Response) {
  if (response.ok) {
    return;
  }
  if (response.status === 401) {
    throw new Error("API token was not accepted. Disconnect and check your token.");
  }
  if (response.status === 409) {
    throw new Error("The vault changed elsewhere. Reload its details before trying again.");
  }
  throw new Error("The API could not complete the request. Check its setup and try again.");
}

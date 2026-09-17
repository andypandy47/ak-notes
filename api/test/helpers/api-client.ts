import { exports } from "cloudflare:workers";

type ApiRequest = {
  path: string;
  token?: string;
  method?: string;
  json?: unknown;
  body?: string;
  headers?: HeadersInit;
};

export const apiRequest = ({ path, token, method, json, body, headers }: ApiRequest) => {
  const requestHeaders = new Headers(headers);
  if (token !== undefined) requestHeaders.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`http://localhost${path}`, {
    method,
    body: json === undefined ? body : JSON.stringify(json),
    headers: requestHeaders,
  });
};

export const responseJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

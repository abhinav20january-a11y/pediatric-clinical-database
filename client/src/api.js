/**
 * Shared HTTP client for the React application.
 * It centralizes the API base URL, JSON headers, and error normalization so
 * page components only need to describe the endpoint and request payload.
 */
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

/**
 * Sends one JSON request to the Express API.
 * Successful 204 responses have no body; other successful responses are parsed
 * as JSON. API error messages are converted into normal JavaScript errors.
 */
export async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

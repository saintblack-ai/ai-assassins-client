import { readApiJson } from "./apiResponse.js";

// Health and admin reads use the platform's object envelope. Provider feeds do not.
export async function readDashboardApiObject(response) {
  const payload = await readApiJson(response);
  if (!response.ok) {
    const error = new Error(`Dashboard API request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Dashboard API returned an invalid object response.");
    error.code = "invalid_api_response";
    error.status = response.status;
    throw error;
  }
  return payload;
}

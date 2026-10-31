// A successful HTML fallback is a routing failure, not a successful API read.
export async function readApiJson(response) {
  const mediaType = (response.headers.get("content-type") || "")
    .split(";", 1)[0].trim().toLowerCase();
  const isJson = mediaType === "application/json" ||
    (mediaType.startsWith("application/") && mediaType.endsWith("+json"));

  let payload = null;
  if (isJson) {
    try {
      payload = await response.json();
    } catch {
      // Preserve HTTP errors below; successful malformed JSON must fail closed.
    }
  }

  if (response.ok && (!isJson || payload === null)) {
    const error = new Error("API returned an invalid JSON response. Check API routing and backend configuration.");
    error.code = "invalid_api_response";
    error.status = response.status;
    throw error;
  }

  return payload;
}

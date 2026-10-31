import test from "node:test";
import assert from "node:assert/strict";
import { readApiJson } from "./apiResponse.js";

test("rejects the observed HTTP 200 SPA fallback instead of reporting success", async () => {
  const response = new Response('<!doctype html><div id="root"></div>', {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
  await assert.rejects(readApiJson(response), { code: "invalid_api_response", status: 200 });
});

test("accepts JSON and structured JSON media types", async () => {
  for (const type of ["application/json; charset=utf-8", "Application/JSON", "application/problem+json"]) {
    assert.deepEqual(await readApiJson(new Response('{"ok":true}', {
      headers: { "content-type": type }
    })), { ok: true });
  }
});

test("rejects malformed, null and missing-content-type successful responses", async () => {
  for (const body of ["{broken", "null"]) {
    await assert.rejects(readApiJson(new Response(body, {
      headers: { "content-type": "application/json" }
    })), { code: "invalid_api_response" });
  }
  await assert.rejects(readApiJson(new Response('{"ok":true}')), { code: "invalid_api_response" });
});

test("preserves JSON error payloads and HTTP errors with non-JSON bodies", async () => {
  assert.deepEqual(await readApiJson(new Response('{"error":"unauthorized"}', {
    status: 401, headers: { "content-type": "application/json" }
  })), { error: "unauthorized" });
  assert.equal(await readApiJson(new Response("Forbidden", { status: 403 })), null);
  assert.equal(await readApiJson(new Response("{", {
    status: 502, headers: { "content-type": "application/json" }
  })), null);
});

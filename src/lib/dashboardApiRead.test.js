import test from "node:test";
import assert from "node:assert/strict";
import { readDashboardApiObject } from "./dashboardApiRead.js";

const jsonResponse = (body, status = 200) => new Response(body, {
  status, headers: { "content-type": "application/json" }
});

test("health/admin reads reject successful SPA HTML, malformed/null/scalar/array JSON", async () => {
  for (const response of [new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
    ...["{", "null", "false", "42", '"OK"', "[]"].map(body => jsonResponse(body))]) {
    await assert.rejects(readDashboardApiObject(response), { code: "invalid_api_response", status: 200 });
  }
});

test("health/admin reads cannot treat a JSON HTTP error as success", async () => {
  for (const status of [401, 403, 500]) {
    await assert.rejects(readDashboardApiObject(jsonResponse('{"ok":true}', status)), { status });
  }
});

test("health/admin reads preserve valid object envelopes", async () => {
  for (const payload of [{ ok: true }, { ok: false }, { metrics: {}, users: [] }]) {
    assert.deepEqual(await readDashboardApiObject(jsonResponse(JSON.stringify(payload))), payload);
  }
});

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "taskflow-test-")
);

process.env.DATA_DIR = tempDir;
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-only-secret";

const app = require("../server");
const db = require("../src/db");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("health endpoint returns healthy", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "healthy");
});

test("readiness endpoint confirms database readiness", async () => {
  const response = await fetch(`${baseUrl}/api/ready`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ready");
});

test("projects endpoint requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/projects`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Please log in first.");
});

test("registration rejects an invalid email", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "not-an-email",
      password: "test-password-123"
    })
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Enter a valid email address.");
});

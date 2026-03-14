// Test-only defaults for modules that require env vars at import time.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/test_db'
}

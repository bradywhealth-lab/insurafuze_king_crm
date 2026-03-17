#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "bunx",
  ["tsc", "--noEmit", "--project", "tsconfig.typecheck.json", "--pretty", "false"],
  { encoding: "utf8", stdio: "inherit" },
);

if (result.error) {
  console.error("Typecheck failed to execute tsc.");
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);

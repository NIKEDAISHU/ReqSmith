#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Start Vite dev server
const vite = spawn("npx", ["vite"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});

// Wait for Vite to be ready, then start Electron
setTimeout(() => {
  const require = createRequire(import.meta.url);
  const electronPath = require("electron");

  const electron = spawn(electronPath, [path.join(root, "dist/main/index.js")], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://localhost:5173",
    },
  });

  electron.on("close", () => {
    vite.kill();
    process.exit(0);
  });
}, 3000);

process.on("SIGINT", () => {
  vite.kill();
  process.exit(0);
});

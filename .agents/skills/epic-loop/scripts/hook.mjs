#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { handleHook } from "./lib/hooks.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  handleHook(fs.readFileSync(0, "utf8"), flags);
});

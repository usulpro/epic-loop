#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { requestStop } from "./lib/loop-stop-gate.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  requestStop(flags);
});

#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { unbindSession } from "./lib/epics.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  unbindSession(flags);
});

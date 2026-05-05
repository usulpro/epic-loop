#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { appendImplementationLog } from "./lib/implementation-log.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  appendImplementationLog(flags);
});

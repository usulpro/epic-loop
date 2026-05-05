#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { installHooks } from "./lib/hooks.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  installHooks(flags);
});

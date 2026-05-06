#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { setNextRole } from "./lib/loop.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  setNextRole(flags);
});

#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { status } from "./lib/epics.mjs";

runCli(() => {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  status(flags, positionals);
});

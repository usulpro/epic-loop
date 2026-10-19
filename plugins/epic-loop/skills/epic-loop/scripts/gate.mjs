#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { gateCommand } from "./lib/loop-gates.mjs";

runCli(() => {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  gateCommand(flags, positionals);
});

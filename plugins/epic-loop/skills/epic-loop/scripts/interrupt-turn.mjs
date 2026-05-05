#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { interruptOpenTurn } from "./lib/loop.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  interruptOpenTurn(flags);
});

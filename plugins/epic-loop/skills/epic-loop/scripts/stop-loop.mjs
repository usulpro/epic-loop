#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { stopLoopCommand } from "./lib/loop-user-prompt.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  stopLoopCommand(flags);
});

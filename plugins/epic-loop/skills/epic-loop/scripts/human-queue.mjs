#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { humanQueueCommand } from "./lib/human-queue.mjs";

runCli(() => {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  humanQueueCommand(flags, positionals);
});

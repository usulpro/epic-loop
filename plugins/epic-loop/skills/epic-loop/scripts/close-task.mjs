#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { closeTask } from "./lib/roadmap.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  closeTask(flags);
});

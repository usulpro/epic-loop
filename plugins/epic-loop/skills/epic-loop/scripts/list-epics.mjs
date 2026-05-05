#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { listEpics } from "./lib/epics.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  listEpics(flags);
});

#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { writeEngineerBrief } from "./lib/briefs.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  writeEngineerBrief(flags);
});

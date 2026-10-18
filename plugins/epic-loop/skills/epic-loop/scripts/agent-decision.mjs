#!/usr/bin/env node

import process from "node:process";

import { parseArgs, runCli } from "./lib/common.mjs";
import { agentDecisionCommand } from "./lib/agent-decisions.mjs";

runCli(() => {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  agentDecisionCommand(flags, positionals);
});

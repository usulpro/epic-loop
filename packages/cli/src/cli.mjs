import path from "node:path";
import process from "node:process";

import { getConfigValue, readConfig, setConfigValue } from "./config.mjs";
import { runDoctor } from "./doctor/index.mjs";
import { runInstall, runUpdate } from "./install.mjs";
import { readCliVersion } from "./paths.mjs";
import { findProjectRoot } from "./project-root.mjs";
import { runStatus } from "./status.mjs";

const USAGE = `Usage: epic-loop [command] [options]

Commands:
  (none)                      List epics in the current project
  doctor --platform <p>       Check hooks, epic state, and skill version/updates [--json] [--root] [--skill-dir]
  install --platform <p>      Install the skill into this project and set up hooks [--root] [--no-hooks]
  update                      Replace a local skill copy with this CLI's version [--skill-dir] [--force] [--json]
  config [get|set] <key> [v]  Read or write machine-local settings (keys: autoupdate)

Platforms: codex, claude-code`;

function parseArgs(argv) {
  const flags = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const name = arg.slice(2);
    const next = argv[index + 1];
    if (name.startsWith("no-") || next === undefined || next.startsWith("--")) {
      flags[name] = true;
      continue;
    }

    flags[name] = next;
    index += 1;
  }

  return { flags, positionals };
}

function runConfig(positionals, flags) {
  const root = path.resolve(typeof flags.root === "string" ? flags.root : (findProjectRoot(process.cwd()) ?? "."));
  const [action, key, value] = positionals;

  if (!action) {
    console.log(JSON.stringify(readConfig(root), null, 2));
  } else if (action === "get" && key) {
    console.log(JSON.stringify(getConfigValue(root, key)));
  } else if (action === "set" && key && value !== undefined) {
    console.log(`${key} = ${JSON.stringify(setConfigValue(root, key, value))}`);
  } else {
    throw new Error("Usage: epic-loop config [get <key> | set <key> <value>]");
  }
  return 0;
}

async function main(argv) {
  const { flags, positionals } = parseArgs(argv);
  const [command, ...rest] = positionals;

  if (flags.version || argv.includes("-v")) {
    console.log(`epic-loop v${readCliVersion()}`);
    return 0;
  }
  if (flags.help || argv.includes("-h") || command === "help") {
    console.log(USAGE);
    return 0;
  }

  switch (command) {
    case undefined:
      return runStatus();
    case "doctor":
      return runDoctor(flags, { argv });
    case "install":
      return runInstall(flags);
    case "update":
      return runUpdate(flags);
    case "config":
      return runConfig(rest, flags);
    default:
      console.error(`Unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

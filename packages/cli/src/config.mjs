import fs from "node:fs";
import path from "node:path";

const CONFIG_KEYS = {
  autoupdate: {
    default: false,
    parse(raw) {
      if (raw === "true" || raw === true) {
        return true;
      }
      if (raw === "false" || raw === false) {
        return false;
      }
      throw new Error(`Invalid value for autoupdate: ${raw}. Expected true or false.`);
    },
  },
};

// Machine-local settings: lives under `.runtime/` so it is never committed or shared.
export function configPath(root) {
  return path.join(root, ".epic-loop", ".runtime", "config.json");
}

function readStoredConfig(root) {
  try {
    const value = JSON.parse(fs.readFileSync(configPath(root), "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function readConfig(root) {
  const stored = readStoredConfig(root);
  const config = {};

  for (const [key, spec] of Object.entries(CONFIG_KEYS)) {
    try {
      config[key] = key in stored ? spec.parse(stored[key]) : spec.default;
    } catch {
      config[key] = spec.default;
    }
  }

  return config;
}

function requireKey(key) {
  if (!Object.hasOwn(CONFIG_KEYS, key)) {
    throw new Error(`Unknown config key: ${key}. Known keys: ${Object.keys(CONFIG_KEYS).join(", ")}.`);
  }
  return CONFIG_KEYS[key];
}

export function setConfigValue(root, key, rawValue) {
  const value = requireKey(key).parse(rawValue);
  const filePath = configPath(root);
  const next = { ...readStoredConfig(root), [key]: value };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return value;
}

export function getConfigValue(root, key) {
  requireKey(key);
  return readConfig(root)[key];
}

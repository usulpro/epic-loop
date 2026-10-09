// Prints the trusted_hash state for every hook in a Codex hooks.json (reproduces Codex 0.145-0.162 hashing).
import crypto from 'node:crypto';
import fs from 'node:fs';
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const labels = {SessionStart:'session_start',UserPromptSubmit:'user_prompt_submit',Stop:'stop',PreToolUse:'pre_tool_use',PostToolUse:'post_tool_use'};
const noMatcher = new Set(['UserPromptSubmit','Stop']);
const file = process.argv[2];
const j = JSON.parse(fs.readFileSync(file,'utf8'));
for (const [ev, groups] of Object.entries(j.hooks)) groups.forEach((g, gi) => g.hooks.forEach((h, hi) => {
  const handler = {type:'command', command:h.command, timeout: Math.max(1, h.timeout ?? 600), async: !!h.async};
  if (h.statusMessage != null) handler.statusMessage = h.statusMessage;
  if (h.additionalContextLimit != null && h.additionalContextLimit !== 2500) handler.additionalContextLimit = h.additionalContextLimit;
  const id = {event_name: labels[ev], hooks:[handler]};
  if (g.matcher != null && !noMatcher.has(ev)) id.matcher = g.matcher;
  const hash = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(canon(id))).digest('hex');
  console.log(`[hooks.state."${file}:${labels[ev]}:${gi}:${hi}"]\ntrusted_hash = "${hash}"`);
}));

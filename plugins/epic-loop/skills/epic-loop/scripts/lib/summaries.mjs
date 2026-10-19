import fs from "node:fs";
import path from "node:path";

import { epicRoot, epicRuntimeRoot, readJson, requireFlag, resolveRoot, runtimeStatePath } from "./common.mjs";
import { readAgentDecisions } from "./agent-decisions.mjs";
import { readHumanQueue } from "./human-queue.mjs";
import { AWAITING_REVIEW, describeGate, openGates, reviewPath } from "./loop-gates.mjs";
import { readRoadmapSummary } from "./roadmap.mjs";

export function roleSummary(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const runtime = readJson(runtimeStatePath(root, slug), {});
  const roadmap = readRoadmapSummary(root, slug);
  const latestReportPath = path.join(epicRuntimeRoot(root, slug), "latest-engineer-report.md");
  const latestManagerReportPath = path.join(epicRuntimeRoot(root, slug), "latest-manager-report.md");
  const statePath = path.join(epicRoot(root, slug), "state-of-epic.md");

  const summary = {
    slug,
    mode: runtime.mode ?? null,
    active_phase: roadmap.active_phase ?? runtime.active_phase ?? null,
    active_task: roadmap.active_task ?? runtime.active_task ?? null,
    implementation_loop: runtime.implementation_loop ?? null,
    state_path: path.relative(root, statePath),
    tracker_path: `.epic-loop/epics/${slug}/tracker.md`,
    latest_engineer_report_path: fs.existsSync(latestReportPath) ? path.relative(root, latestReportPath) : null,
    latest_engineer_report: fs.existsSync(latestReportPath) ? fs.readFileSync(latestReportPath, "utf8").trim() : null,
    latest_manager_report_path: fs.existsSync(latestManagerReportPath) ? path.relative(root, latestManagerReportPath) : null,
    latest_manager_report: fs.existsSync(latestManagerReportPath) ? fs.readFileSync(latestManagerReportPath, "utf8").trim() : null,
    open_human_queue: readHumanQueue(root, slug)
      .filter((item) => item.status === "open")
      .map(({ ask, blocks, id, kind }) => ({ ask, blocks, id, kind })),
    open_gates: openGates(runtime.implementation_loop).map(({ blocking, covers, review, status }) => ({
      blocking,
      covers: covers ?? [],
      path: reviewPath(slug, review),
      review,
      status,
    })),
    unconfirmed_agent_decisions: readAgentDecisions(root, slug)
      .filter((decision) => decision.state === "unconfirmed")
      .map(({ id, title }) => ({ id, title })),
  };

  if (flags.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Epic: ${slug}`);
  console.log(`Mode: ${summary.mode ?? "unknown"}`);
  console.log(`Active phase: ${summary.active_phase ?? "none"}`);
  console.log(`Active task: ${summary.active_task ?? "none"}`);
  console.log(`State: ${summary.state_path}`);
  console.log(`Tracker: ${summary.tracker_path}`);
  if (summary.implementation_loop?.status === AWAITING_REVIEW) {
    console.log(`Loop: ${AWAITING_REVIEW} (a blocking gate ended the last manager turn)`);
  }
  if (summary.open_human_queue.length > 0) {
    console.log("");
    console.log(`Open human-queue items (.epic-loop/epics/${slug}/human-queue.md):`);
    for (const item of summary.open_human_queue) {
      console.log(`- ${item.id} ${item.kind}: ${item.ask} (blocks: ${item.blocks})`);
    }
  }
  const gates = openGates(runtime.implementation_loop);
  if (gates.length > 0) {
    console.log("");
    console.log("Open gates (review pages the human answers):");
    for (const gate of gates) {
      console.log(`- ${describeGate(slug, gate)}`);
    }
  }
  if (summary.unconfirmed_agent_decisions.length > 0) {
    console.log("");
    console.log("Unconfirmed agent-made decisions (decision-log.md):");
    for (const decision of summary.unconfirmed_agent_decisions) {
      console.log(`- ${decision.id} ${decision.title}`);
    }
  }
  if (summary.latest_manager_report_path) {
    console.log(`Latest manager report: ${summary.latest_manager_report_path}`);
    console.log("");
    console.log(summary.latest_manager_report);
    if (summary.latest_engineer_report_path) {
      console.log("");
    }
  }
  if (summary.latest_engineer_report_path) {
    console.log(`Latest engineer report: ${summary.latest_engineer_report_path}`);
    console.log("");
    console.log(summary.latest_engineer_report);
  }
}

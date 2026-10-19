// The epic home's response: the full page or one of its live fragments, with the id links and, in
// the second language, the translated segments (Phase 5 Tasks 2–5).
import { readEpicActivity } from "../epic/activity.mjs";
import { listEpicDocs } from "../epic/docs.mjs";
import { buildIdIndex } from "../epic/id-index.mjs";
import { buildOverview } from "../epic/overview.mjs";
import { buildStatistics } from "../epic/statistics.mjs";
import { renderActivity, renderEpicHome, renderHomeMain } from "./home.mjs";
import { collectSegments, translateHtml } from "./i18n.mjs";
import { readInbox } from "./inbox.mjs";
import { linkIdsInHtml } from "./refs.mjs";
import { epicDir, listEpicsWithReviews, listOpenGates, listReviews } from "./reviews.mjs";

export function homeHtml({ root, projectName, slug, fragment, lang, langSwitch, translator }) {
  const dir = epicDir(root, slug);
  const index = buildIdIndex(dir);
  // Translate the app's own text first (segments, one batched job for the missing ones), then link ids.
  const finish = (html) => {
    let out = html;
    if (lang) {
      const { found } = translator.segments(dir, lang, collectSegments(out));
      out = translateHtml(out, found);
    }
    return linkIdsInHtml(out, index, slug);
  };
  // ?fragment=activity is the activity section alone, refreshed after an activity event.
  if (fragment === "activity") return finish(renderActivity(readEpicActivity(root, dir)));
  const gates = listOpenGates(root, slug);
  const view = {
    activity: readEpicActivity(root, dir),
    docs: listEpicDocs(dir),
    epic: listEpicsWithReviews(root).find((item) => item.slug === slug),
    gates,
    inbox: readInbox(dir),
    overview: buildOverview(dir, { gates }),
    reviews: listReviews(root, slug),
    statistics: buildStatistics(dir),
  };
  // ?fragment=main is the inner <main> the live page swaps in after a change event.
  if (fragment === "main") return finish(renderHomeMain(view));
  return renderEpicHome(projectName, view, finish, { lang, langSwitch });
}

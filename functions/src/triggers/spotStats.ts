/**
 * rollupSpotStats (daily, 4:00 Budapest): copies the changed spotStats/{spotId} counters onto their
 * spots (viewCount, visitCount) for Explore's "Popular" order, then clears the dirty mark. Once a
 * day, so a view never pushes the spot doc to every map listener. Counter-only spot writes are
 * ignored by the spot triggers (onlyCountersChanged). Logs only counts.
 */
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";

const PAGE = 300;

export const rollupSpotStats = onSchedule(
  {schedule: "0 4 * * *", timeZone: "Europe/Budapest", timeoutSeconds: 540},
  async () => {
    let updated = 0;
    let missing = 0;
    for (;;) {
      const page = await db.collection("spotStats").where("dirty", "==", true).limit(PAGE).get();
      if (page.empty) break;
      const spots = await db.getAll(...page.docs.map((d) => db.collection("spots").doc(d.id)));
      const batch = db.batch();
      page.docs.forEach((stat, i) => {
        batch.update(stat.ref, {dirty: false});
        if (!spots[i].exists) {
          missing += 1;
          return;
        }
        const views = stat.get("viewCount");
        const visits = stat.get("visitCount");
        batch.update(spots[i].ref, {
          viewCount: typeof views === "number" ? views : 0,
          visitCount: typeof visits === "number" ? visits : 0,
        });
        updated += 1;
      });
      await batch.commit();
      if (page.size < PAGE) break;
    }
    logger.info("rollupSpotStats", {updated, missing});
  },
);

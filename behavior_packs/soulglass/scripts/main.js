import { world } from "@minecraft/server";
import { subscribeSafe, subscriptionFailures } from "./safe.js";
import { startTracking } from "./tracker.js";
import { registerGrave, registerLocator } from "./grave.js";
import { registerGuide } from "./guide.js";

startTracking();
registerGrave();
registerLocator();
registerGuide();

/*
 * One line in the content log saying whether everything came up.
 *
 * A silent "ready" would be a lie on a version where an event has moved or
 * disappeared: subscribeSafe keeps the rest of the addon alive, and without
 * this the only symptom is a feature quietly not working.
 */
subscribeSafe(world.afterEvents, "worldLoad", () => {
  const failed = subscriptionFailures();
  if (failed.length === 0) {
    console.warn("[Soulglass] ready");
    return;
  }
  console.warn(`[Soulglass] ready, with ${failed.length} event(s) unavailable:`);
  for (const reason of failed) console.warn(`[Soulglass]   ${reason}`);
});

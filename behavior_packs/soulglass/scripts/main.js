import { world } from "@minecraft/server";
import { subscribeSafe } from "./safe.js";
import { startTracking } from "./tracker.js";
import { registerGrave, registerLocator } from "./grave.js";
import { registerGuide } from "./guide.js";

startTracking();
registerGrave();
registerLocator();
registerGuide();

subscribeSafe(world.afterEvents, "worldLoad", () => {
  console.warn("[Soulglass] ready");
});

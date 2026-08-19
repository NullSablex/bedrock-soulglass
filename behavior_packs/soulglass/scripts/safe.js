/**
 * Defensive event subscription.
 *
 * The Bedrock Script API changes between game versions: an event that existed
 * in 1.21 may have been removed or moved to beta by 1.26. Without this guard a
 * single bad subscription throws during load and takes the WHOLE addon down —
 * no checks run, nothing reaches the chat, and there is no obvious error.
 *
 * Here each subscription fails in isolation and the reason lands in the
 * content log.
 */

const failures = [];

/**
 * @param bus      world.afterEvents, world.beforeEvents, system.afterEvents...
 * @param name     event name
 * @param handler  callback
 * @param options  event filter options, when the event supports them
 * @returns true when the subscription succeeded
 */
export function subscribeSafe(bus, name, handler, options) {
  try {
    const signal = bus?.[name];
    if (!signal || typeof signal.subscribe !== "function") {
      failures.push(`${name}: not available in this API version`);
      console.warn(`[Soulglass] event not available: ${name}`);
      return false;
    }
    if (options) signal.subscribe(handler, options);
    else signal.subscribe(handler);
    return true;
  } catch (e) {
    failures.push(`${name}: ${e}`);
    console.warn(`[Soulglass] failed to subscribe to ${name}: ${e}`);
    return false;
  }
}

/** Events that could not be subscribed, for status reporting. */
export function subscriptionFailures() {
  return [...failures];
}

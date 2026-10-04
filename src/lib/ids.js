let counter = 0;

/** Short unique id, e.g. "im3x9k2a0". Unique within a session and across reloads. */
export const newId = () => 'i' + Date.now().toString(36) + (counter++).toString(36);

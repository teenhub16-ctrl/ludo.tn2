type DebugEntry = {
  colour: string;
  dice: number;
  chosen: string;
  candidates: { id: number; pos: string; score: number; safe: boolean; backward: boolean }[];
};

const log: DebugEntry[] = [];

export function pushDebug(entry: DebugEntry) {
  log.push(entry);
  if (log.length > 3) log.shift();
  window.dispatchEvent(new CustomEvent('botdebug', { detail: [...log] }));
}

export function getDebugLog() {
  return [...log];
}
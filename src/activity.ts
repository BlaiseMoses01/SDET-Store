// In-process ring buffer of recent events, plus a subscriber list for
// SSE fanout to the admin panel. Lost on restart by design — this is a
// live observer, not an audit log.

export type ActivityEvent = {
  ts: number;
  kind: "http" | "mode_switch" | "seed";
  user?: string;
  method?: string;
  path?: string;
  status?: number;
  detail?: string;
};

type Subscriber = (e: ActivityEvent) => void;

const MAX = 100;
const buffer: ActivityEvent[] = [];
const subscribers = new Set<Subscriber>();

export function record(e: Omit<ActivityEvent, "ts">): void {
  const event: ActivityEvent = { ts: Date.now(), ...e };
  buffer.push(event);
  if (buffer.length > MAX) buffer.shift();
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      subscribers.delete(fn);
    }
  }
}

export function snapshot(): ActivityEvent[] {
  return [...buffer];
}

export function addActivitySubscriber(fn: Subscriber): void {
  subscribers.add(fn);
}

export function removeActivitySubscriber(fn: Subscriber): void {
  subscribers.delete(fn);
}

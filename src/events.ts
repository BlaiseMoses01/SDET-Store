// In-process pub/sub for admin-driven UI refresh.
// Subscribers are SSE write callbacks registered by GET /__admin/events.

type Send = (data: string) => void;

const subscribers = new Set<Send>();

export function addSubscriber(send: Send): void {
  subscribers.add(send);
}

export function removeSubscriber(send: Send): void {
  subscribers.delete(send);
}

export function broadcast(event: string): void {
  for (const send of subscribers) {
    try {
      send(event);
    } catch {
      subscribers.delete(send);
    }
  }
}

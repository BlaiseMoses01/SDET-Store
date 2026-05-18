// Mirrors the inline comments in main app's src/bugs.ts.
// If a new mode is added on the main app but not listed here,
// the panel falls back to showing the mode name only.

export const MODE_DESCRIPTIONS: Record<string, string> = {
  healthy: "Default behavior. All features work correctly.",

  "buggy-auth-1": "Login accepts any password for alice@example.com.",
  "buggy-auth-2": "Signup allows duplicate emails.",
  "buggy-auth-3": "Expired sessions are still treated as valid.",

  "buggy-products-1": "Search filter is case-sensitive (should be case-insensitive).",
  "buggy-products-2": "Out-of-stock items can still be added to cart.",
  "buggy-products-3": "Price sort is inverted (ascending and descending swapped).",

  "buggy-cart-1": "Remove button silently does nothing.",
  "buggy-cart-2": "Quantity update doesn't recalculate subtotal (shows stale unit price).",
  "buggy-cart-3": "Nav cart count always reads 0.",

  "buggy-checkout-1": "Shipping form accepts invalid zip codes.",
  "buggy-checkout-2": "Order total ignores quantity (sums unit prices only).",
  "buggy-checkout-3": "Order confirmation shows 'pending' instead of 'confirmed'.",

  "buggy-api-auth-1": "API endpoints allow access without a session.",
  "buggy-api-auth-2": "API login accepts any password for existing users.",
  "buggy-api-products-1": "API in_stock filter is ignored.",
  "buggy-api-cart-1": "API allows quantities beyond stock and out-of-stock items.",
  "buggy-api-orders-1": "API idempotency key is ignored (duplicate orders allowed).",
  "buggy-api-flaky-1": "Flaky endpoint counts attempts globally instead of per-client.",
};

export function describeMode(mode: string): string {
  return MODE_DESCRIPTIONS[mode] ?? "";
}

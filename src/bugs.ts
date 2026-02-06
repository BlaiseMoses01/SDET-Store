// ─── Bug Registry ──────────────────────────────────────────────
// Each bug is a named behavior change that can be activated via
// the APP_MODE environment variable. Routes call into these
// functions at their decision points.
//
// APP_MODE can be:
//   "healthy"                         — normal behavior (default)
//   "buggy-auth-1"                    — login accepts any password for alice
//   "buggy-auth-2"                    — signup allows duplicate emails
//   "buggy-auth-3"                    — expired sessions still work
//   "buggy-products-1"               — search filter is case-sensitive (should be insensitive)
//   "buggy-products-2"               — out-of-stock items can be added to cart
//   "buggy-products-3"               — price sort is inverted
//   "buggy-cart-1"                    — remove button doesn't actually remove
//   "buggy-cart-2"                    — quantity update doesn't recalculate subtotal (shows stale price)
//   "buggy-cart-3"                    — cart count in nav is always 0
//   "buggy-checkout-1"               — shipping form accepts invalid zip codes
//   "buggy-checkout-2"               — order total is wrong (doesn't multiply by quantity)
//   "buggy-checkout-3"               — order confirmation shows wrong status
//   "buggy-api-auth-1"               — API allows access without a session
//   "buggy-api-auth-2"               — API login accepts any password for existing users
//   "buggy-api-products-1"           — API in_stock filter is ignored
//   "buggy-api-cart-1"               — API allows quantities beyond stock/out-of-stock
//   "buggy-api-orders-1"             — API idempotency key is ignored
//   "buggy-api-flaky-1"              — API flaky attempts are global

export const VALID_MODES = [
  "healthy",
  "buggy-auth-1",
  "buggy-auth-2",
  "buggy-auth-3",
  "buggy-products-1",
  "buggy-products-2",
  "buggy-products-3",
  "buggy-cart-1",
  "buggy-cart-2",
  "buggy-cart-3",
  "buggy-checkout-1",
  "buggy-checkout-2",
  "buggy-checkout-3",
  "buggy-api-auth-1",
  "buggy-api-auth-2",
  "buggy-api-products-1",
  "buggy-api-cart-1",
  "buggy-api-orders-1",
  "buggy-api-flaky-1",
] as const;

export type AppMode = (typeof VALID_MODES)[number];

let mode: AppMode | string = process.env.APP_MODE || "healthy";

export function getMode(): string {
  return mode;
}

export function setMode(nextMode: AppMode | string): void {
  mode = nextMode;
}

// ─── Auth bugs ─────────────────────────────────────────────────

// buggy-auth-1: login accepts any password for alice@example.com
export function shouldSkipPasswordCheck(email: string): boolean {
  return mode === "buggy-auth-1" && email === "alice@example.com";
}

// buggy-auth-2: signup skips the duplicate email check
export function shouldSkipDuplicateEmailCheck(): boolean {
  return mode === "buggy-auth-2";
}

// buggy-auth-3: expired sessions are treated as valid
// (the session query WHERE clause changes)
export function shouldIgnoreSessionExpiry(): boolean {
  return mode === "buggy-auth-3";
}

// ─── Product bugs ──────────────────────────────────────────────

// buggy-products-1: search is case-sensitive instead of case-insensitive
// In healthy mode we use LIKE which is case-insensitive in SQLite for ASCII.
// In buggy mode we use GLOB which is case-sensitive.
export function shouldUseCaseSensitiveSearch(): boolean {
  return mode === "buggy-products-1";
}

// buggy-products-2: out-of-stock products show "Add to Cart" instead of disabled
export function shouldAllowOutOfStockPurchase(): boolean {
  return mode === "buggy-products-2";
}

// buggy-products-3: price sort ascending/descending is swapped
export function shouldInvertPriceSort(): boolean {
  return mode === "buggy-products-3";
}

// ─── Cart bugs ─────────────────────────────────────────────────

// buggy-cart-1: remove action silently does nothing
export function shouldSkipCartRemove(): boolean {
  return mode === "buggy-cart-1";
}

// buggy-cart-2: subtotal doesn't account for quantity (shows unit price only)
export function shouldShowUnitPriceAsSubtotal(): boolean {
  return mode === "buggy-cart-2";
}

// buggy-cart-3: nav cart count always reads 0
export function shouldShowZeroCartCount(): boolean {
  return mode === "buggy-cart-3";
}

// ─── Checkout bugs ─────────────────────────────────────────────

// buggy-checkout-1: zip code validation is skipped
export function shouldSkipZipValidation(): boolean {
  return mode === "buggy-checkout-1";
}

// buggy-checkout-2: order total = sum of unit prices, ignoring quantity
export function shouldIgnoreQuantityInTotal(): boolean {
  return mode === "buggy-checkout-2";
}

// buggy-checkout-3: order confirmation always says "pending" instead of "confirmed"
export function shouldShowWrongOrderStatus(): boolean {
  return mode === "buggy-checkout-3";
}

// ─── API bugs ──────────────────────────────────────────────────

// buggy-api-auth-1: API endpoints allow access without a session
export function shouldBypassApiAuth(): boolean {
  return mode === "buggy-api-auth-1";
}

// buggy-api-auth-2: API login accepts any password for any existing user
export function shouldSkipApiPasswordCheck(): boolean {
  return mode === "buggy-api-auth-2";
}

// buggy-api-products-1: in_stock filter is ignored
export function shouldIgnoreApiInStockFilter(): boolean {
  return mode === "buggy-api-products-1";
}

// buggy-api-cart-1: cart allows quantities beyond stock / out-of-stock
export function shouldAllowOverstockCart(): boolean {
  return mode === "buggy-api-cart-1";
}

// buggy-api-orders-1: idempotency key is ignored (duplicates allowed)
export function shouldIgnoreIdempotency(): boolean {
  return mode === "buggy-api-orders-1";
}

// buggy-api-flaky-1: flaky attempts are global, ignoring client id
export function shouldUseGlobalFlaky(): boolean {
  return mode === "buggy-api-flaky-1";
}

# Bug Evaluation Key

This app is designed to validate that your agentic tests **catch** intentional defects.
For each `APP_MODE`, scenarios tagged with `@xfail-<mode>` are expected to fail.

## How To Use

1. Set mode via admin API:
   - `POST /__admin/mode` body: `{ "mode": "buggy-cart-2" }`
2. Run your test suite (UI + API).
3. Compare failures to the expected tags listed below.
4. Optional: run `features/**/bugs.feature` to confirm the bug is present.

## Expected Failures By Mode

- `buggy-auth-1` -> `@xfail-buggy-auth-1`
- `buggy-auth-2` -> `@xfail-buggy-auth-2`
- `buggy-auth-3` -> `@xfail-buggy-auth-3`
- `buggy-products-1` -> `@xfail-buggy-products-1`
- `buggy-products-2` -> `@xfail-buggy-products-2`
- `buggy-products-3` -> `@xfail-buggy-products-3`
- `buggy-cart-1` -> `@xfail-buggy-cart-1`
- `buggy-cart-2` -> `@xfail-buggy-cart-2`
- `buggy-cart-3` -> `@xfail-buggy-cart-3`
- `buggy-checkout-1` -> `@xfail-buggy-checkout-1`
- `buggy-checkout-2` -> `@xfail-buggy-checkout-2`
- `buggy-checkout-3` -> `@xfail-buggy-checkout-3`
- `buggy-api-auth-1` -> `@xfail-buggy-api-auth-1`
- `buggy-api-auth-2` -> `@xfail-buggy-api-auth-2`
- `buggy-api-products-1` -> `@xfail-buggy-api-products-1`
- `buggy-api-cart-1` -> `@xfail-buggy-api-cart-1`
- `buggy-api-orders-1` -> `@xfail-buggy-api-orders-1`
- `buggy-api-flaky-1` -> `@xfail-buggy-api-flaky-1`

## Notes

- Scenarios tagged `@xfail-...` live in the normal feature files (not the bug-mode files).
- `features/**/bugs.feature` are **positive confirmations** of each bug mode.

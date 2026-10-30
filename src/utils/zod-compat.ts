import { z } from 'zod';

/**
 * Polyfill for Zod v4 compatibility with @hookform/resolvers/zod.
 * @hookform/resolvers checks `Array.isArray(error?.errors)`, but Zod v4 uses `issues`.
 * Defining `errors` on ZodError prototype ensures @hookform/resolvers handles validation errors
 * gracefully instead of throwing uncaught promise rejections.
 */
try {
  z.string().parse(1);
} catch (e: unknown) {
  if (e && typeof e === 'object') {
    const proto = Object.getPrototypeOf(e);
    if (proto && !('errors' in proto)) {
      Object.defineProperty(proto, 'errors', {
        get() {
          return (this as { issues?: unknown[] }).issues;
        },
        configurable: true,
      });
    }
  }
}

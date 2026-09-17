/// <reference types="@cloudflare/vitest-plugin/types" />

declare global {
  interface Env {
    TEST_MIGRATIONS: D1Migration[];
  }

  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};

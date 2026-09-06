# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command               | Purpose                   |
| --------------------- | ------------------------- |
| `npx wrangler dev`    | Local development         |
| `npx wrangler deploy` | Deploy to Cloudflare      |
| `npx wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

## Purpose

This repository contains a REST API running on Cloudflare Workers.

When modifying backend code, preserve the existing architecture and conventions in this repository. Prefer consistency with existing code over introducing new patterns.

Before implementing a change, inspect analogous routes, services, schemas, and tests already in the repository.

---

## General rules

- Write TypeScript.
- Keep TypeScript strict and avoid weakening compiler settings.
- Do not use `any` unless there is no reasonable alternative.
- Prefer explicit types at application boundaries.
- Keep functions small and focused.
- Prefer composition over inheritance.
- Do not introduce abstractions for a single use case unless they materially improve clarity.
- Avoid speculative refactoring unrelated to the requested task.
- Do not add dependencies unless the existing stack cannot reasonably solve the problem.
- Prefer existing repository utilities and patterns over adding new helpers.

---

## Cloudflare Workers constraints

Code must be compatible with the Cloudflare Workers runtime.

- Do not use Node.js APIs unless the project explicitly enables and relies on Node.js compatibility.
- Do not assume access to:
  - the filesystem
  - long-lived processes
  - local persistent memory
  - traditional TCP sockets
- Do not store request-specific or mutable application state in module-level variables.
- Treat Worker instances as ephemeral.
- Use Cloudflare bindings for external resources such as:
  - D1
  - KV
  - R2
  - Durable Objects
  - Queues
  - Service Bindings
  - Secrets
- Access bindings through the application's typed environment object.
- Never hard-code secrets, account IDs, tokens, or environment-specific values.

Prefer Web Platform APIs where possible, including:

- `Request`
- `Response`
- `URL`
- `URLSearchParams`
- `fetch`
- `Headers`
- `crypto`

---

## REST API design

Follow existing route structure and naming conventions.

Use conventional HTTP semantics.

### Methods

- `GET` reads resources.
- `POST` creates resources or performs non-idempotent operations.
- `PUT` replaces resources where appropriate.
- `PATCH` performs partial updates.
- `DELETE` removes resources.

Do not use `POST` for operations that are naturally reads.

### Status codes

Use appropriate HTTP status codes.

Common examples:

- `200` successful request
- `201` resource created
- `204` successful request with no response body
- `400` malformed request
- `401` unauthenticated
- `403` authenticated but not authorized
- `404` resource not found
- `409` resource conflict
- `422` syntactically valid request that fails domain validation, if this is an established repository convention
- `429` rate limited
- `500` unexpected server error

Do not return `200` for errors.

---

## Route handlers

Route handlers should be thin.

A handler should primarily:

1. Read request data.
2. Validate input.
3. Resolve authentication and authorization.
4. Call application/domain logic.
5. Map the result to an HTTP response.

Do not place substantial business logic directly inside route handlers.

# Quality check tools

These tools and companion skills enforce or extend the conventions in this skill. Use them when the task goes beyond organizing files: when you need to verify code quality, catch performance issues, or design better component APIs.

## react-doctor

Scans your React codebase for issues across state and effects, performance, architecture, security, and accessibility. Run it after applying this skill's conventions to catch what the agent missed.

```bash
npx react-doctor@latest
```

Works with Next.js, Vite, TanStack, React Native, Expo. Can run in CI on pull requests. 13.5k stars.

Notable: react-doctor catches exactly the kinds of problems this skill teaches you to avoid: state in the wrong place, barrel files breaking tree shaking, missing error boundaries. The two tools complement each other.

[https://github.com/millionco/react-doctor](https://github.com/millionco/react-doctor)

## Vercel react-best-practices

70 rules across 8 categories, prioritized by impact: eliminating waterfalls, bundle size, server-side performance, client-side data fetching, re-render optimization, rendering performance, JavaScript performance, and advanced patterns.

Load this skill when performance is the specific concern, not just "where do I put these files" but "why is this page slow and how do I fix it."

```bash
npx skills add vercel-labs/agent-skills --skill react-best-practices
```

[https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

## Vercel composition-patterns

Component architecture patterns: compound components with shared context, avoiding boolean prop proliferation, lifting state into providers, and React 19 API changes (no more `forwardRef`, `use()` instead of `useContext()`).

Load this skill when designing component APIs, not file organization but the contract between a component and its callers.

```bash
npx skills add vercel-labs/agent-skills --skill composition-patterns
```

[https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns)

<!-- source: bulletproof-react docs/performance.md -->

# Performance

## Code splitting

Split at the route level so the initial load only fetches what's needed for the first screen, and everything else loads lazily as the user navigates. Don't split more granularly than that by default: too many small chunks means too many requests, which can hurt performance instead of helping it.

## State and re-renders

- Don't put everything in one global state object. A single state blob means any update anywhere triggers re-renders everywhere. Split state by where it's actually used.
- Keep state as close as possible to the components that use it. State lifted higher than necessary causes components in between to re-render even though they don't care about the value.
- If a piece of state is initialized from an expensive computation, pass the initializer function to `useState`, not the computed value:

  ```javascript
  // runs the expensive function on every re-render
  const [state, setState] = useState(myExpensiveFn());

  // runs it once, on mount
  const [state, setState] = useState(() => myExpensiveFn());
  ```

- For state that tracks many independent elements at once, consider a store with atomic updates (Zustand, Jotai) instead of one big object.
- React Context is fine for low-frequency data: theme, user info, small local state. For data that updates often, plain context will re-render every consumer on every change. Either use a library with built-in selectors (Zustand, Jotai) or `use-context-selector` if staying with context. And before reaching for context at all, check whether lifting state up or better component composition solves the problem without it. Context is not the default answer to prop drilling.
- If the app updates frequently and runtime styling libraries (emotion, styled-components) show up as a bottleneck, consider a zero-runtime alternative (Tailwind, vanilla-extract, CSS modules) that generates styles at build time instead.

## Use `children` to avoid re-renders

Passing JSX through `children` is the cheapest optimization. Content passed as `children` is a VDOM structure the parent doesn't own and can't re-render. State changes in the parent leave it untouched.

```javascript
// PureComponent re-renders every time count changes
const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
      <PureComponent />
    </div>
  );
};

// PureComponent is passed as children, so it's isolated from count updates
const Counter = ({ children }) => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
      {children}
    </div>
  );
};
```

## Images

Lazy-load images outside the viewport. Use WebP where possible. Use `srcset` so the browser picks the right image size for the screen instead of always loading the largest.

## Web vitals

Check Lighthouse and PageSpeed Insights scores. Search ranking takes web vitals into account, so this isn't purely a UX concern.

## Data prefetching

If you can predict where the user is headed next, prefetch that data with `queryClient.prefetchQuery` (react-query) before they navigate. The data is already cached by the time the page mounts, so there's no loading state to show.

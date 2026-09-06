# Effects: You might not need one

Effects let you step outside React to synchronize components with external systems like network requests, browser DOM, or non-React widgets. If there is no external system involved, you should not need an Effect. Agents overuse Effects for transforming data and handling user events. Removing unnecessary Effects makes code easier to follow, faster to run, and less error-prone.

## Contents

- [When to remove Effects](#when-to-remove-effects)
- [Updating state based on props or state](#updating-state-based-on-props-or-state)
- [Caching expensive calculations](#caching-expensive-calculations)
- [Resetting all state when a prop changes](#resetting-all-state-when-a-prop-changes)
- [Adjusting some state when a prop changes](#adjusting-some-state-when-a-prop-changes)
- [Sharing logic between event handlers](#sharing-logic-between-event-handlers)
- [Sending a POST request](#sending-a-post-request)
- [Chains of computations](#chains-of-computations)
- [Initializing the application](#initializing-the-application)
- [Notifying parent components about state changes](#notifying-parent-components-about-state-changes)
- [Passing data to the parent](#passing-data-to-the-parent)
- [Subscribing to an external store](#subscribing-to-an-external-store)
- [Fetching data](#fetching-data)
- [Companion: ESLint plugin](#companion-eslint-plugin)

## When to remove Effects

There are two common cases where you do not need Effects:

1. You do not need Effects to transform data for rendering. If you want to filter a list before displaying it, do not write an Effect that updates a state variable when the list changes. That is inefficient. React calls your component functions to calculate what should be on the screen, commits those changes to the DOM, and then runs your Effects. If your Effect immediately updates state, it restarts the whole process from scratch. Transform data at the top level of your components instead. That code automatically re-runs whenever your props or state change.
2. You do not need Effects to handle user events. If you want to send a POST request when a user buys a product, do it in the Buy button click event handler. By the time an Effect runs, you do not know what the user did. Handle user events in their corresponding event handlers.

You do need Effects to synchronize with external systems. You can write an Effect that keeps a jQuery widget synchronized with React state. You can also fetch data with Effects to synchronize search results with the current query. Modern frameworks provide more efficient built-in data fetching mechanisms than writing Effects directly in components.

## Updating state based on props or state

Suppose you have a component with `firstName` and `lastName` state variables. You want to calculate `fullName` from them and update it whenever they change. Do not add a `fullName` state variable and update it in an Effect.

```jsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  // Avoid: redundant state and unnecessary Effect
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
  // ...
}
```

This does an entire render pass with a stale value for `fullName`, then immediately re-renders with the updated value. Remove the state variable and the Effect. Calculate it during rendering.

```jsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  // Good: calculated during rendering
  const fullName = firstName + ' ' + lastName;
  // ...
}
```

If something can be calculated from existing props or state, do not put it in state. Calculate it during rendering.

## Caching expensive calculations

If you filter a list of todos based on a filter prop, calculating it during rendering is fine if the operation is fast. If `getFilteredTodos` is slow or you have a large list, you can memoize the calculation with `useMemo`. Do not use an Effect to store the result in state.

```jsx
import { useMemo, useState } from 'react';

function TodoList({ todos, filter }) {
  const [newTodo, setNewTodo] = useState('');

  const visibleTodos = useMemo(() => {
    // Does not re-run unless todos or filter change
    return getFilteredTodos(todos, filter);
  }, [todos, filter]);
  // ...
}
```

React will remember the return value of `getFilteredTodos` during the initial render. On the next renders, it checks if `todos` or `filter` are different. If they are the same, `useMemo` returns the last result. If they are different, React calls the inner function again.

The React Compiler can automatically memoize expensive calculations for you, eliminating the need for manual `useMemo` in many cases. The function you wrap in `useMemo` runs during rendering, so this only works for pure calculations.

To tell if a calculation is expensive, you can add a console log to measure the time spent. If the overall logged time adds up to a significant amount, like 1ms or more, it might make sense to memoize that calculation. Note that measuring performance in development will not give accurate results because of Strict Mode double rendering. Build the app for production and test on a device your users have.

## Resetting all state when a prop changes

If a component receives a `userId` prop and you want to clear its `comment` state whenever `userId` changes, do not reset state on prop change in an Effect.

```jsx
export default function ProfilePage({ userId }) {
  const [comment, setComment] = useState('');
  // Avoid: Resetting state on prop change in an Effect
  useEffect(() => {
    setComment('');
  }, [userId]);
  // ...
}
```

This renders `ProfilePage` and its children with the stale value first, then renders again. Split the component in two and pass a `key` attribute from the outer component to the inner one.

```jsx
export default function ProfilePage({ userId }) {
  return (
    <Profile
      userId={userId}
      key={userId}
    />
  );
}

function Profile({ userId }) {
  // Good: This and any other state below will reset on key change automatically
  const [comment, setComment] = useState('');
  // ...
}
```

By passing `userId` as a `key` to the `Profile` component, you ask React to treat two `Profile` components with different `userId` values as two different components. Whenever the key changes, React recreates the DOM and resets the state of the `Profile` component and all its children.

## Adjusting some state when a prop changes

Sometimes you might want to reset or adjust a part of the state on a prop change, but not all of it. If a `List` component receives `items` and maintains a `selection` state, you might want to reset `selection` to null whenever `items` changes. Do not do this in an Effect.

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);
  // Avoid: Adjusting state on prop change in an Effect
  useEffect(() => {
    setSelection(null);
  }, [items]);
  // ...
}
```

Delete the Effect and adjust the state directly during rendering.

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);
  // Better: Adjust the state while rendering
  const [prevItems, setPrevItems] = useState(items);

  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
  // ...
}
```

React will re-render the `List` immediately after it exits with a `return` statement. React has not rendered the `List` children or updated the DOM yet, so this lets the children skip rendering the stale `selection` value. A condition like `items !== prevItems` is necessary to avoid loops. You may adjust state like this, but any other side effects should stay in event handlers or Effects to keep components pure.

Most components should not need this pattern. Always check whether you can reset all state with a key or calculate everything during rendering instead. Store the selected item ID instead of storing the selected item object, and find the item during rendering.

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  // Best: Calculate everything during rendering
  const selection = items.find(item => item.id === selectedId) ?? null;
  // ...
}
```

## Sharing logic between event handlers

If you have two buttons that both add a product to the cart and show a notification, do not place this logic in an Effect.

```jsx
function ProductPage({ product, addToCart }) {
  // Avoid: Event-specific logic inside an Effect
  useEffect(() => {
    if (product.isInCart) {
      showNotification(`Added ${product.name} to the shopping cart!`);
    }
  }, [product]);

  function handleBuyClick() {
    addToCart(product);
  }

  function handleCheckoutClick() {
    addToCart(product);
    navigateTo('/checkout');
  }
  // ...
}
```

This Effect causes bugs. If the app remembers the shopping cart between page reloads, the notification will appear every time you refresh the page because `product.isInCart` will be true on load. Delete the Effect and put the shared logic into a function called from both event handlers.

```jsx
function ProductPage({ product, addToCart }) {
  // Good: Event-specific logic is called from event handlers
  function buyProduct() {
    addToCart(product);
    showNotification(`Added ${product.name} to the shopping cart!`);
  }

  function handleBuyClick() {
    buyProduct();
  }

  function handleCheckoutClick() {
    buyProduct();
    navigateTo('/checkout');
  }
  // ...
}
```

Use Effects only for code that should run because the component was displayed to the user. If the logic is caused by a particular interaction, keep it in the event handler.

## Sending a POST request

If a form sends an analytics event when it mounts and a POST request to an API when submitted, the analytics POST request should remain in an Effect because the reason to send the event is that the form was displayed. The API POST request is not caused by the form being displayed. It should only happen when the user presses the button. Delete the Effect for the API request and move that POST request into the event handler.

```jsx
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Good: This logic runs because the component was displayed
  useEffect(() => {
    post('/analytics/event', { eventName: 'visit_form' });
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    // Good: Event-specific logic is in the event handler
    post('/api/register', { firstName, lastName });
  }
  // ...
}
```

## Chains of computations

Do not chain Effects that each adjust a piece of state based on other state.

```jsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  // Avoid: Chains of Effects that adjust the state solely to trigger each other
  useEffect(() => {
    if (card !== null && card.gold) {
      setGoldCardCount(c => c + 1);
    }
  }, [card]);

  useEffect(() => {
    if (goldCardCount > 3) {
      setRound(r => r + 1)
      setGoldCardCount(0);
    }
  }, [goldCardCount]);

  // ...
}
```

This is inefficient because the component and its children have to re-render between each `set` call in the chain. It is also rigid and fragile as requirements change. Calculate what you can during rendering, and adjust the state in the event handler.

```jsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);
  // Good: Calculate what you can during rendering
  const isGameOver = round > 5;

  function handlePlaceCard(nextCard) {
    if (isGameOver) {
      throw Error('Game already ended.');
    }

    // Good: Calculate all the next state in the event handler
    setCard(nextCard);
    if (nextCard.gold) {
      if (goldCardCount < 3) {
        setGoldCardCount(goldCardCount + 1);
      } else {
        setGoldCardCount(0);
        setRound(round + 1);
        if (round === 5) {
          alert('Good game!');
        }
      }
    }
  }
  // ...
}
```

Remember that inside event handlers, state behaves like a snapshot. If you need to use the next value for calculations, define it manually like `const nextRound = round + 1`. In some cases where you cannot calculate the next state directly in the event handler, a chain of Effects is appropriate because you are synchronizing with network.

## Initializing the application

If logic should only run once when the app loads, do not place it in an Effect in the top-level component without a guard. It runs twice in development and can cause issues if the function was not designed to be called twice. If some logic must run once per app load rather than once per component mount, add a top-level variable to track whether it has already executed.

```jsx
let didInit = false;
function App() {
  useEffect(() => {
    if (!didInit) {
      didInit = true;
      // Good: Only runs once per app load
      loadDataFromLocalStorage();
      checkAuthToken();
    }
  }, []);
  // ...
}
```

You can also run it during module initialization at the top level of your root component module before the app renders. Keep app-wide initialization logic to root component modules or in your application's entry point to avoid slowdowns when importing components.

## Notifying parent components about state changes

If a `Toggle` component with internal `isOn` state notifies a parent whenever its state changes, do not call the parent's `onChange` event from an Effect.

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);
  // Avoid: The onChange handler runs too late
  useEffect(() => {
    onChange(isOn);
  }, [isOn, onChange])

  function handleClick() {
    setIsOn(!isOn);
  }
  // ...
}
```

The `Toggle` updates its state first, React updates the screen, and then React runs the Effect to call `onChange`. The parent component then updates its own state, starting another render pass. Delete the Effect and update the state of both components within the same event handler.

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);

  function updateToggle(nextIsOn) {
    // Good: Perform all updates during the event that caused them
    setIsOn(nextIsOn);
    onChange(nextIsOn);
  }

  function handleClick() {
    updateToggle(!isOn);
  }
  // ...
}
```

React batches updates from different components together, so there will only be one render pass. You might also remove the state altogether and receive `isOn` from the parent component. Lifting state up lets the parent component fully control the `Toggle`.

## Passing data to the parent

If a child component fetches data and passes it to the parent in an Effect, the data flow becomes difficult to trace. Let the parent component fetch that data and pass it down to the child instead.

```jsx
function Parent() {
  const data = useSomeAPI();
  // Good: Passing data down to the child
  return <Child data={data} />;
}

function Child({ data }) {
  // ...
}
```

Data flows from the parent components to their children in React.

## Subscribing to an external store

If components need to subscribe to data outside React state from a third-party library or browser API, you might use an Effect with manual state management. React has a purpose-built Hook for subscribing to an external store called `useSyncExternalStore`. Use it instead of an Effect.

```jsx
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function useOnlineStatus() {
  // Good: Subscribing to an external store with a built-in Hook
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

function ChatIndicator() {
  const isOnline = useOnlineStatus();
  // ...
}
```

This approach is less error-prone than manually syncing mutable data to React state with an Effect.

## Fetching data

Many apps use Effects to kick off data fetching. You do not need to move this fetch to an event handler. While the user typing in a search box is an event, the main reason to fetch is that the component is visible and you want to keep the results synchronized with the current query and page.

However, a naive fetch in an Effect has a race condition bug. If a user types "hello" fast, separate fetches kick off, but there is no guarantee about which order the responses arrive in. The "hell" response may arrive after the "hello" response, displaying the wrong search results. To fix the race condition, add a cleanup function to ignore stale responses.

```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;
    fetchResults(query, page).then(json => {
      if (!ignore) {
        setResults(json);
      }
    });
    return () => {
      ignore = true;
    };
  }, [query, page]);

  function handleNextPageClick() {
    setPage(page + 1);
  }
  // ...
}
```

This ensures that all responses except the last requested one will be ignored. Handling race conditions is not the only difficulty with implementing data fetching. You also need to think about caching responses, fetching data on the server, and avoiding network waterfalls. Modern frameworks provide more efficient built-in data fetching mechanisms than fetching data in Effects.

If you do not use a framework but want to make data fetching from Effects more ergonomic, extract your fetching logic into a custom Hook. The fewer raw `useEffect` calls you have in your components, the easier you will find it to maintain the application. TanStack Query handles caching, invalidation, and refetching for you, so use it instead of raw fetch in an Effect for client-side data fetching.

## Companion: ESLint plugin

[eslint-plugin-react-you-might-not-need-an-effect](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect)
catches unnecessary Effects at lint time. Install it alongside this reference.

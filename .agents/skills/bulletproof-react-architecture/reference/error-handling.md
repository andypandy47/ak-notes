<!-- source: bulletproof-react docs/error-handling.md -->

# Error handling

## API errors

Handle them in one place: an interceptor on the API client. Use it to surface error toasts, log out a user whose session expired, or trigger a token refresh. Don't scatter error handling across every call site.

## In-app errors

Use multiple error boundaries, not one boundary wrapping the entire app. A single top-level boundary means any error anywhere takes down the whole UI. Placing boundaries around independent sections lets a failure in one part stay contained there while the rest of the app keeps working.

## Error tracking

Track production errors with a dedicated service (Sentry or similar) rather than building your own. You get the browser, platform, and user context around each error for free, and you need source maps uploaded to see where the error actually happened in your original code, not in minified output.

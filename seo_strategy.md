# SEO Strategy

## In scope
- Public app entry at `/` and its initial HTML shell
- Public auth surface rendered by `src/auth/AuthGate.tsx` when authentication is required
- The separate settings entry at `/settings.html` when directly opened or shared
- Share-preview metadata and crawler-visible HTML for public entry points

## Out of scope
- Authenticated workspace UI after the SPA boots (terminal, editor, file explorer, preview panes)
- Internal API routes under `/api/**`
- WebSocket endpoints under `/ws`

## Target audience
- Developers looking for a lightweight, cross-platform AI-native terminal / ADE

## Primary keywords
- ai terminal
- ai-native terminal
- lightweight terminal app
- cross-platform ai terminal
- developer terminal with ai

## Dismissed categories
- Issues that only apply when `TERAX_REQUIRE_AUTH` is enabled, because login is optional by default in the current source configuration.

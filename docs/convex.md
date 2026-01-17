# Convex Data Model

The Convex backend only handles persistence for users, prompt feeds, and the reels that populate each feed. Video generation and hosting continue to live behind the FastAPI service, which returns a public video URL that we then store with the reel metadata.

## Tables

| Table | Purpose | Important fields |
| --- | --- | --- |
| `users` | Auth0 backed accounts. Created/updated by `users.upsert`. | `auth0Id`, `email`, `name`, `avatarUrl`, `createdAt`, `lastLoginAt` |
| `feeds` | A saved prompt/session for a user. | `userId`, `prompt`, `topic`, `description`, `tags`, `status`, `lastSeenReelId`, `lastSeenIndex`, `createdAt`, `updatedAt` |
| `reels` | Individual pieces of content tied to a feed. | `feedId`, `position`, `sourceType`, `status`, `videoUrl`, `thumbnailUrl`, `sourceReference`, `metadata`, `createdAt`, `updatedAt` |

Indexes enable quick lookups by Auth0 ID, user feeds, feed status, and feed-specific reels.

## Public Convex Functions

- `users.upsert` (mutation) – Create or update a user record every time Auth0 authenticates. Returns the Convex `Id<"users">`.
- `users.getByAuth0Id` / `users.getById` (queries) – Resolve stored user info for the frontend.
- `feeds.create` (mutation) – Persist a new feed tied to the current user + prompt metadata. Starts in `pending` status until reels arrive.
- `feeds.listByUser` (query) – Show all feeds for a dashboard, optionally filtered by feed status (pending, curating, ready, archived).
- `feeds.updateStatus` (mutation) – Update lifecycle state as the orchestrator pulls content together.
- `feeds.updateProgress` (mutation) – Persist the user’s last seen reel ID/index so they can resume scrolling later.
- `reels.addToFeed` (mutation) – Attach a reel placeholder or completed reel to a feed. FastAPI/external scrapers call this with metadata plus the video URL they generate or retrieve.
- `reels.update` (mutation) – Patch reel status/metadata once FastAPI finishes processing (e.g., mark as `ready` and attach the generated video URL).
- `reels.listForFeed` / `reels.getById` (queries) – Retrieve reels for playback or observe an individual reel’s state.

## Typical Flow

1. **User logs in** → call `users.upsert`.
2. **User creates a prompt** → call `feeds.create` and keep the returned feed ID.
3. **Content orchestration**  
   - External scrapers or FastAPI workers call `reels.addToFeed` to insert metadata.  
   - When FastAPI returns the final video URL, call `reels.update` to flip the status to `ready`.
4. **Frontend consumption**  
   - Use `feeds.listByUser` to show saved sessions.  
   - Use `reels.listForFeed` as the user scrolls.  
   - Periodically call `feeds.updateProgress` with the last viewed reel so the user can resume later.

Only metadata and URLs are persisted here; binary video assets remain in your storage layer managed by FastAPI.

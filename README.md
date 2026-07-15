# Collective Player Dashboard Integration

Copy these folders into the root of your existing Collective repository.

## Files to replace

- `public/player.html`
- `public/css/player.css`
- `public/js/player.js`

## API files to add

Copy the included `api/player/` and `api/_lib/` folders into your existing `api/` folder.
Also add `api/player-progress-admin.js` so admins, coaches, and advisors can save ratings later.

## Install the required packages

Run this from the root of the repository:

```bash
npm install mongodb @vercel/blob formidable
```

Do not replace your whole `package.json`. The included `package-additions.json` only shows the dependencies this integration needs.

## Environment variables

Keep your existing MongoDB variable:

```text
MONGODB_URI=your MongoDB Atlas connection string
```

Optional variables:

```text
MONGODB_DB=your database name
SESSION_COOKIE_NAME=session
```

`SESSION_COOKIE_NAME` must match the cookie name created by your login API. The helper also checks `collective_session` and `auth_session` automatically.

## Vercel Blob

In the Vercel project:

1. Open **Storage**.
2. Create or connect a Blob store.
3. Vercel will add the Blob token environment variable automatically.
4. Redeploy the project.

Photos, videos, and documents are stored in Vercel Blob. Their URL, owner, category, note, MIME type, and upload date are stored in MongoDB.

## Route

The dashboard file is `public/player.html`. Add this rewrite to the existing `rewrites` array in `vercel.json`:

```json
{
  "source": "/dashboard",
  "destination": "/player.html"
}
```

Do not replace your other rewrites.

## Login redirect

After a successful player login, redirect with:

```js
window.location.replace("/dashboard");
```

Admins should continue going to the admin dashboard.

## Middleware

Your middleware must allow authenticated players to access:

```text
/dashboard
/player.html
/css/player.css
/js/player.js
/api/player/*
```

The API files also verify the session themselves and require the role to be `Player`.

## MongoDB collections

The integration uses:

- `users`
- `messages`
- `playerPrograms`
- `playerProgress`
- `playerFiles`

No manual collection creation is required. MongoDB creates them when the first record is inserted.

## Existing user requirements

The logged-in player must exist in `users` and have:

```js
{
  type: "Player"
}
```

The session cookie must contain a payload with at least:

```js
{
  userId: "MongoDB user _id",
  role: "Player",
  expiresAt: 1780000000000
}
```

## Progress ratings from staff

Staff can save a progress rating by sending this request:

```js
fetch("/api/player-progress-admin", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    playerId: "PLAYER_MONGODB_ID",
    category: "Skating",
    rating: 84,
    note: "Improved first-step acceleration."
  })
});
```

The player dashboard will automatically display records from `playerProgress`.

## Important

This package does not replace your login API, logout API, middleware, existing admin API, or inquiry API. It connects to them through the session cookie and the existing `users` and `messages` collections.

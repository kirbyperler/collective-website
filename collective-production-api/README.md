# Collective production API replacement

This package consolidates the existing Collective API routes while preserving the old frontend URLs through Vercel rewrites.

## Final project structure

Place these folders at the project root, beside `public`, `package.json`, and `vercel.json`:

```text
api/
├── admin.js
├── auth.js
├── files.js
├── inquiries.js
├── player.js
└── test.js

lib/
├── auth.js
├── db.js
└── http.js
```

Only the six files directly inside `api/` are Vercel Functions. The shared helpers are intentionally in root-level `lib/`, outside `api/`, so they do not create additional functions.

After the deployment works, delete `api/test.js` to use five functions.

## Replace the old files

1. Back up the current `api` folder.
2. Copy the new `api` and `lib` folders into the project root.
3. Merge the rewrites from `vercel-rewrites-to-merge.json` into the existing `vercel.json`.
4. Install the dependencies.
5. Deploy and test.
6. Only then remove the backup.

## Old API files that can be deleted after testing

```text
api/login.js
api/logout.js
api/complete-account-setup.js
api/users.js
api/messages.js
api/player-progress-admin.js
api/accept-inquiry.js
api/db.js
api/lib/
api/player/
```

The new replacement files `api/auth.js`, `api/admin.js`, `api/player.js`, `api/files.js`, `api/inquiries.js`, and `api/test.js` must remain.

## Why the rewrites matter

Your existing frontend currently calls URLs such as:

```text
/api/login
/api/logout
/api/users
/api/messages
/api/player/me
/api/player/files
```

The rewrites forward those existing URLs to the consolidated functions, so you do not have to immediately rewrite every frontend JavaScript file.

Put the rewrite entries before any broad catch-all rewrite such as `/(.*)`.

Do not replace your entire `vercel.json` blindly. Add the supplied entries to its existing `rewrites` array and keep your existing page routes.

## Install dependencies

```bash
npm install mongodb bcryptjs resend @vercel/blob formidable
```

## Required environment variables

```text
MONGO_URI or MONGODB_URI
MONGODB_DB (optional; defaults to collective)
SESSION_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
RESEND_API_KEY
SITE_URL
BLOB_READ_WRITE_TOKEN
```

## Collections used

```text
users
inquiries
messages
playerPrograms
playerProgress
playerFiles
```

## Important behavior preserved

- Admin login uses the existing `ADMIN_USERNAME` and scrypt `ADMIN_PASSWORD_HASH`.
- Player, coach, and advisor logins use bcrypt password hashes from account setup.
- The cookie remains named `collective_session`.
- The session contains the logged-in MongoDB user `_id`, so `/api/player/me` loads the current player instead of a hard-coded player.
- Public inquiry submission remains at `/api/inquiries`.
- Accepting an inquiry creates a pending user and sends the setup email.
- Existing admin `/api/users` and `/api/messages` calls continue working through rewrites.
- Existing player `/api/player/...` calls continue working through rewrites.
- Photos, videos, documents, and avatars use Vercel Blob; their metadata is stored in MongoDB.

## Test in this order

1. `/api/test`
2. Public inquiry submission
3. Admin login
4. Admin users list
5. Accept inquiry and setup email
6. Complete account setup
7. Player login
8. `/api/player/me`
9. Player messages and recruiting
10. File and avatar upload
11. Admin progress ratings

## Git commands

```bash
git add .
git commit -m "Consolidate Collective API routes"
git push
```

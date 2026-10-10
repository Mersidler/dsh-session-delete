# dsh-delete-sessions

Session deletion plugin for DeepSeek Harness: it **actually removes logs from disk** (via a recoverable trash), filling the gap where the built-in "archive" only hides a session.

English | [中文](README.zh.md)

> npm package `dsh-delete-sessions`; the GitHub repository keeps the name `dsh-session-delete`.

## Features

- **Delete from the sidebar**: the session row's "⋯" menu gains a "Delete session" item, using dsh's own confirm modal. The row disappears on its own — no page reload.
- **Settings page**: **Settings → Session trash**, scanning real directories under `~/.dsh/sessions/**` and showing title (read from the same sessions service the sidebar uses, no log decoding), project, on-disk size and updated time.
- **Bulk actions**: multi-select then move to trash; select-all, and search by title / ID / project.
- **Trash**: restore (back to its original group) / delete permanently / empty all.
- **Matches the host theme**: every control is a dsh UI primitive, and colors and radii come from the host's design tokens, so light and dark both follow automatically.

## Install

```bash
dsh plugin --profile web add dsh-delete-sessions
```

Restart `dsh web` to load it. To remove:

```bash
dsh plugin --profile web remove dsh-delete-sessions
```

## Usage

1. Click "⋯" on a session row → "Delete session" → confirm; or use **Settings → Session trash** for bulk work.
2. Deleting only `rename`s the session folder into the trash (`~/.dsh/trash/sessions/`) — **this is the plugin's own folder, not the OS Recycle Bin**.
3. The Trash tab restores or purges; only "Delete permanently" calls `rmSync`.

## Data safety

- Delete is a `renameSync` into the trash; original files are never overwritten and restore is byte-identical.
- Every host-side path is resolved through `realpath` first, then verified to sit inside the sessions root, so an out-of-tree path cannot be deleted.
- Session logs (zstd-compressed) are never parsed; titles come only from DSH's own session service.

## Authentication

All four `/api/session-delete/*` routes go through the host's `ctx.connection.requestRejection()`: a Host/Origin fence first, then the browser cookie signed for this activation. Unauthenticated gets 401, an untrusted origin gets 403, and if that service is unavailable the route returns 503 rather than allowing the request (fail closed).

> This part has to be explicit: routes added via `ctx.webServer.register()` do not pass through `dsh-api-gateway` and are unauthenticated by default.

## About "running" sessions

This plugin deliberately does **not** pre-check "is this session running". The only host-side signal available, `agents.get(id)`, really means "this process opened an agent for that session" — a single glance keeps it true — so gating on it blocks nearly everything, and `stopActivity` only guarantees a stop request was issued, not that the agent exited.

The filesystem is the actual authority: if a handle inside the directory is still open, `rename` throws `EPERM` / `EBUSY`. The plugin reports that reason verbatim and retries at most 6 times, 250ms apart. Nothing gets blocked for no reason, and nothing gets silently allowed.

## Compatibility

Written against DSH `0.2.0-rc.2` and later. Zero build step (plain JS, no TypeScript, no bundler). Web UI only.

## License

Apache-2.0

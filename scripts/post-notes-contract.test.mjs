import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("Post launcher is global and appears immediately before notifications", () => {
  const header = source("src/components/layout/AppTopHeader.tsx");
  const postLauncherIndex = header.indexOf("<PostNotes />");
  const notificationBellIndex = header.indexOf("<NotificationBell");

  assert.ok(postLauncherIndex >= 0);
  assert.ok(notificationBellIndex > postLauncherIndex);
});

test("Post notes are private to the authenticated profile and scoped by module", () => {
  const migration = source("database/migrations/0073_user_post_notes.sql");
  const queries = source("src/modules/post-notes/queries.ts");

  assert.match(migration, /foreign key \(profile_id, empresa_id\)/);
  assert.match(migration, /profile_id = auth\.uid\(\)/);
  assert.match(migration, /empresa_id = public\.current_empresa_id\(\)/);
  assert.match(migration, /alter table public\.user_post_notes enable row level security/);
  assert.match(queries, /\.eq\("scope_key", scopeKey\)/);
  assert.match(queries, /\.eq\("profile_id", tenant\.profileId\)/);
});

test("Post interactions use the three-dot menu and persist movement and size", () => {
  const card = source("src/modules/post-notes/components/post-note.tsx");
  const manager = source("src/modules/post-notes/components/post-notes.tsx");

  assert.match(card, /<MoreHorizontal/);
  assert.match(card, />Eliminar</);
  assert.doesNotMatch(card, /onContextMenu/);
  assert.match(card, /onPointerDown=\{handleDragStart\}/);
  assert.match(card, /onPointerDown=\{handleResizeStart\}/);
  assert.match(manager, /method: "PATCH"/);
  assert.match(manager, /AUTOSAVE_DELAY_MS/);
  assert.match(manager, /<DeletePostNoteDialog/);
});

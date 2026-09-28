import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { newWorkspace, newPhoto, uid } from '../../src/domain';
let db: PGlite;
const alice = '11111111-1111-4111-8111-111111111111',
  bob = '22222222-2222-4222-8222-222222222222';
const workspace = { ...newWorkspace('RLS test'), ownerId: alice };
workspace.photos = [newPhoto('Test', 'local-only', 1200, 800, 'image/png')];
workspace.activePhotoId = workspace.photos[0].id;
async function auth(id: string) {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}';`);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values ('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync(
      'supabase/migrations/20260928125937_smile_studio_workspaces.sql',
      'utf8',
    ),
  );
  await auth(alice);
  await db.query(
    'insert into public.dsd_workspaces(id,owner_id,body) values ($1,$2,$3)',
    [workspace.id, alice, workspace],
  );
});
afterAll(async () => {
  await db.close();
});
it('isolates reads, updates, deletes, and inserts by owner', async () => {
  await auth(bob);
  expect(
    (await db.query('select * from public.dsd_workspaces')).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        'update public.dsd_workspaces set revision=revision+1 where id=$1 returning id',
        [workspace.id],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        'delete from public.dsd_workspaces where id=$1 returning id',
        [workspace.id],
      )
    ).rows,
  ).toHaveLength(0);
  const forged = { ...workspace, id: uid() };
  await expect(
    db.query(
      'insert into public.dsd_workspaces(id,owner_id,body) values ($1,$2,$3)',
      [forged.id, alice, forged],
    ),
  ).rejects.toThrow(/row-level security/);
});
it('rejects embedded media and owner changes, and reserves AI only with consent and current revision', async () => {
  await auth(alice);
  await expect(
    db.query('update public.dsd_workspaces set owner_id=$1 where id=$2', [
      bob,
      workspace.id,
    ]),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query(
      'update public.dsd_workspaces set body=$1,revision=2 where id=$2',
      [
        {
          ...workspace,
          photos: [{ ...workspace.photos[0], base64: 'private-image-bytes' }],
        },
        workspace.id,
      ],
    ),
  ).rejects.toThrow(/no_embedded_media/);
  await expect(
    db.query('select public.reserve_smile_assistance($1,$2,0)', [
      workspace.id,
      workspace.activePhotoId,
    ]),
  ).rejects.toThrow(/consent/);
  workspace.consent = {
    recordedAt: new Date().toISOString(),
    recordedBy: alice,
    policyVersion: '1',
  };
  await db.query(
    'update public.dsd_workspaces set body=$1,revision=2 where id=$2',
    [workspace, workspace.id],
  );
  await expect(
    db.query('select public.reserve_smile_assistance($1,$2,9)', [
      workspace.id,
      workspace.activePhotoId,
    ]),
  ).rejects.toThrow(/outdated/);
  expect(
    (
      await db.query('select public.reserve_smile_assistance($1,$2,0)', [
        workspace.id,
        workspace.activePhotoId,
      ])
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query('select public.reserve_smile_assistance($1,$2,0)', [
      workspace.id,
      workspace.activePhotoId,
    ]),
  ).rejects.toThrow(/15 seconds/);
  await auth(bob);
  await expect(
    db.query('select public.reserve_smile_assistance($1,$2,0)', [
      workspace.id,
      workspace.activePhotoId,
    ]),
  ).rejects.toThrow(/unavailable/);
});
it('gives anonymous callers no access', async () => {
  await db.exec('reset role;set role anon;');
  await expect(db.query('select * from public.dsd_workspaces')).rejects.toThrow(
    /permission denied/,
  );
});

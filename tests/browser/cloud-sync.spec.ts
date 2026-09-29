import { test, expect, type Page } from '@playwright/test';
import type { Workspace } from '../../src/domain';

const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
type Row = { body: Workspace; revision: number };
async function cloudFixture(page: Page, cachedVersion?: number) {
  const rows = new Map<string, Row>();
  const writes: { method: string; id: string; expected: string | null }[] = [];
  const assists: {
    workspaceId: string;
    photoId: string;
    sourceRevision: number;
  }[] = [];
  let hideNextLookup = false;
  let heldLookup: { started: () => void; gate: Promise<void> } | null = null;
  await page.route(
    /https:\/\/[^/]+\/(auth|rest|functions)\/v1\//,
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const reply = (json: unknown, status = 200) =>
        route.fulfill({
          status,
          json,
          headers: { 'access-control-allow-origin': '*' },
        });
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          },
        });
        return;
      }
      if (url.pathname === '/auth/v1/logout') {
        await reply(null);
        return;
      }
      if (url.pathname === '/auth/v1/user') {
        await reply({
          id: owner,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'fixture@example.test',
          created_at: new Date().toISOString(),
        });
        return;
      }
      if (url.pathname === '/functions/v1/smile-assist') {
        const input = request.postDataJSON();
        const source = {
          workspaceId: input.workspaceId,
          photoId: input.photoId,
          sourceRevision: input.sourceRevision,
        };
        assists.push(source);
        await reply({
          id: '33333333-3333-4333-8333-333333333333',
          source,
          operation: input.operation,
          model: input.model,
          createdAt: new Date().toISOString(),
          result: {
            measurements: [
              {
                assessmentId: 'width-11',
                points: [
                  { x: 430, y: 430 },
                  { x: 490, y: 430 },
                ],
              },
            ],
            unavailable: [],
          },
        });
        return;
      }
      if (url.pathname === '/rest/v1/dsd_workspaces') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        if (request.method() === 'GET') {
          const held = heldLookup;
          heldLookup = null;
          if (held) {
            held.started();
            await held.gate;
          }
          if (hideNextLookup && id) {
            hideNextLookup = false;
            await reply([]);
          } else {
            await reply(
              id ? (rows.has(id) ? [rows.get(id)] : []) : [...rows.values()],
            );
          }
          return;
        }
        if (request.method() === 'POST') {
          const input = request.postDataJSON();
          writes.push({ method: 'POST', id: input.id, expected: null });
          if (rows.has(input.id))
            await reply({ code: '23505', message: 'duplicate key' }, 409);
          else {
            rows.set(input.id, { body: input.body, revision: input.revision });
            await reply(null, 201);
          }
          return;
        }
        if (request.method() === 'PATCH' && id) {
          const input = request.postDataJSON(),
            expected = url.searchParams.get('revision');
          writes.push({ method: 'PATCH', id, expected });
          expect(url.searchParams.get('owner_id')).toBe('eq.' + owner);
          if (
            rows.get(id)?.revision === Number(expected?.replace(/^eq\./, ''))
          ) {
            rows.set(id, { body: input.body, revision: input.revision });
            await reply([{ revision: input.revision }]);
          } else await reply([]);
          return;
        }
      }
      await reply({ message: 'Unexpected fixture request' }, 400);
    },
  );
  await page.goto('/');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const workspace = await page.evaluate(
    async ({ owner, cachedVersion }) => {
      const { newWorkspace, newPhoto, uid, now } = await import(
        '/src/domain.ts'
      );
      const { saveWorkspaces, saveMedia, saveCloudVersions } = await import(
        '/src/storage.ts'
      );
      const { supabase } = await import('/src/cloud.ts');
      if (!supabase)
        throw new Error(
          'The cloud-sync regression requires public Supabase configuration.',
        );
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      canvas.getContext('2d')!.fillRect(0, 0, 1200, 800);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png'),
      );
      const photo = newPhoto('Sync fixture.png', uid(), 1200, 800, 'image/png');
      const workspace = {
        ...newWorkspace('Sync fixture'),
        ownerId: owner,
        photos: [photo],
        activePhotoId: photo.id,
        consent: {
          recordedAt: now(),
          recordedBy: owner,
          policyVersion: '1' as const,
        },
      };
      await saveMedia(photo.mediaKey, blob);
      await saveWorkspaces(owner, [workspace]);
      if (cachedVersion !== undefined)
        await saveCloudVersions(
          owner,
          new Map([[workspace.id, cachedVersion]]),
        );
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
      const accessToken =
        encode({ alg: 'HS256', typ: 'JWT' }) +
        '.' +
        encode({
          sub: owner,
          aud: 'authenticated',
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }) +
        '.fixture';
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: 'fixture-refresh-token',
      });
      if (error) throw error;
      return workspace;
    },
    { owner, cachedVersion },
  );
  await expect(page.getByLabel('Current case')).toHaveValue(workspace.id);
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  return {
    workspace,
    rows,
    writes,
    assists,
    hideNextLookup: () => {
      hideNextLookup = true;
    },
    holdNextLookup: () => {
      let release!: () => void, started!: () => void;
      const requested = new Promise<void>((resolve) => {
        started = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      heldLookup = { started, gate };
      return { requested, release };
    },
  };
}
async function editWidth(page: Page) {
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await page
    .locator('.dsd-checklist summary')
    .filter({ hasText: 'Tooth dimensions & axes' })
    .click();
  await page
    .getByRole('button', { name: 'Measure 11 crown width', exact: true })
    .click();
  const box = (await page.getByTestId('canvas-surface').boundingBox())!;
  const scale = Math.min((box.width - 32) / 1200, (box.height - 32) / 800);
  for (const x of [510, 590])
    await page.mouse.click(
      box.x + box.width / 2 + (x - 600) * scale,
      box.y + box.height / 2,
    );
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
}
async function assist(page: Page) {
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Assist this assessment with Gemini',
      exact: true,
    })
    .click();
}
async function localCases(page: Page) {
  return page.evaluate(
    async (owner) => (await import('/src/storage.ts')).loadWorkspaces(owner),
    owner,
  );
}
async function savedVersion(page: Page, id: string, scope = owner) {
  return page.evaluate(
    async ({ scope, id }) =>
      (await (await import('/src/storage.ts')).loadCloudVersions(scope)).get(
        id,
      ),
    { scope, id },
  );
}
const proposal = (page: Page) =>
  page.getByRole('dialog', { name: 'Review the AI proposal', exact: true });

test('cloud revision survives refresh and local edits reach Gemini without re-inserting the case', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page
    .getByRole('button', { name: 'Sync this case', exact: true })
    .click();
  await expect.poll(() => savedVersion(page, cloud.workspace.id)).toBe(1);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await editWidth(page);
  await page.reload();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await assist(page);
  await expect(proposal(page)).toBeVisible();
  expect(cloud.writes.map((write) => write.method)).toEqual(['POST', 'PATCH']);
  expect(cloud.writes[1].expected).toBe('eq.1');
  expect(cloud.rows.get(cloud.workspace.id)?.revision).toBe(2);
  expect(
    cloud.rows.get(cloud.workspace.id)?.body.photos[0].measurements[0]
      .assessmentId,
  ).toBe('width-11');
  expect(cloud.assists).toHaveLength(1);
});

test('an existing identical cloud case reconnects automatically, regardless of JSON key order or another account cache', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, child]) => [key, reorder(child)]),
          )
        : value;
  cloud.rows.set(cloud.workspace.id, {
    body: reorder(cloud.workspace) as Workspace,
    revision: 4,
  });
  await page.evaluate(
    async ({ scope, id }) =>
      (await import('/src/storage.ts')).saveCloudVersions(
        scope,
        new Map([[id, 900]]),
      ),
    { scope: otherOwner, id: cloud.workspace.id },
  );
  await assist(page);
  await expect(proposal(page)).toBeVisible();
  expect(cloud.writes).toHaveLength(0);
  expect(await savedVersion(page, cloud.workspace.id)).toBe(4);
  expect(await savedVersion(page, cloud.workspace.id, otherOwner)).toBe(900);
});

test('different existing copies can continue with local edits while preserving the original cloud case', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  const remote = { ...cloud.workspace, name: 'Other device edits' };
  cloud.rows.set(remote.id, { body: remote, revision: 4 });
  await editWidth(page);
  await assist(page);
  await expect(
    page.getByRole('dialog', { name: 'Choose a case version' }),
  ).toBeVisible();
  expect(cloud.assists).toHaveLength(0);
  expect(cloud.writes).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Continue with my local edits', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const selected = await page.getByLabel('Current case').inputValue();
  expect(selected).not.toBe(remote.id);
  const local = await localCases(page);
  expect(local.find((c) => c.id === remote.id)?.name).toBe(
    'Other device edits',
  );
  expect(
    local.find((c) => c.id === selected)?.photos[0].measurements[0]
      .assessmentId,
  ).toBe('width-11');
  await assist(page);
  await expect(proposal(page)).toBeVisible();
  expect(cloud.rows.get(remote.id)).toEqual({ body: remote, revision: 4 });
  expect(cloud.rows.get(selected)?.revision).toBe(1);
  expect(cloud.assists[0].workspaceId).toBe(selected);
});

test('choosing the cloud version retains the local measurements in a separate case', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  cloud.rows.set(cloud.workspace.id, {
    body: { ...cloud.workspace, name: 'Cloud preferred' },
    revision: 4,
  });
  await editWidth(page);
  await assist(page);
  await expect(
    page.getByRole('dialog', { name: 'Choose a case version' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Use the cloud version', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Current case')).toHaveValue(cloud.workspace.id);
  const copy = (await localCases(page)).find(
    (c) => c.id !== cloud.workspace.id,
  )!;
  expect(copy.name).toContain('(local copy)');
  expect(copy.photos[0].measurements[0].assessmentId).toBe('width-11');
  await assist(page);
  await expect(proposal(page)).toBeVisible();
  expect(cloud.writes[0]).toMatchObject({ method: 'PATCH', expected: 'eq.4' });
});

test('a newer cloud revision is protected after restoring the saved revision', async ({
  page,
}) => {
  const cloud = await cloudFixture(page, 4);
  const remote = { ...cloud.workspace, name: 'Newer remote case' };
  cloud.rows.set(remote.id, { body: remote, revision: 5 });
  await assist(page);
  await expect(
    page.getByRole('dialog', { name: 'Choose a case version' }),
  ).toBeVisible();
  expect(cloud.writes[0]).toMatchObject({ method: 'PATCH', expected: 'eq.4' });
  expect(cloud.rows.get(remote.id)).toEqual({ body: remote, revision: 5 });
  expect(cloud.assists).toHaveLength(0);
});

test('loading cloud cases persists their revisions and same-account auth events keep the workspace usable', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  cloud.rows.set(cloud.workspace.id, { body: cloud.workspace, revision: 4 });
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page
    .getByRole('button', { name: 'Load cloud cases', exact: true })
    .click();
  await expect.poll(() => savedVersion(page, cloud.workspace.id)).toBe(4);
  await page.evaluate(async () => {
    const { supabase } = await import('/src/cloud.ts');
    const { data } = await supabase!.auth.getSession();
    await supabase!.auth.setSession({
      access_token: data.session!.access_token,
      refresh_token: data.session!.refresh_token,
    });
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'New case', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await editWidth(page);
  await assist(page);
  await expect(proposal(page)).toBeVisible();
  expect(cloud.writes[0]).toMatchObject({ method: 'PATCH', expected: 'eq.4' });
});

test('a case created concurrently between lookup and insert is recovered without a duplicate-case error', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  cloud.rows.set(cloud.workspace.id, { body: cloud.workspace, revision: 4 });
  cloud.hideNextLookup();
  await assist(page);
  await expect(proposal(page)).toBeVisible();
  expect(cloud.writes).toHaveLength(1);
  expect(cloud.writes[0].method).toBe('POST');
  expect(cloud.rows.get(cloud.workspace.id)?.revision).toBe(4);
  expect(await savedVersion(page, cloud.workspace.id)).toBe(4);
});

test('cloud records arriving after sign-out cannot enter the guest workspace', async ({
  page,
}) => {
  const cloud = await cloudFixture(page);
  cloud.rows.set(cloud.workspace.id, { body: cloud.workspace, revision: 4 });
  const held = cloud.holdNextLookup();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page
    .getByRole('button', { name: 'Load cloud cases', exact: true })
    .click();
  await held.requested;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Current case')).not.toHaveValue(
    cloud.workspace.id,
  );
  held.release();
  await expect(page.getByRole('alert')).toContainText('account changed');
  const guestCases = await page.evaluate(async () =>
    (await import('/src/storage.ts')).loadWorkspaces('guest'),
  );
  expect(guestCases.some((c) => c.id === cloud.workspace.id || c.ownerId)).toBe(
    false,
  );
  expect(await savedVersion(page, cloud.workspace.id, 'guest')).toBeUndefined();
});

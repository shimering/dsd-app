import { it, expect } from 'vitest';
import { createHandler } from '../../supabase/functions/smile-assist/handler';
import { DEFAULT_LIGHTING, newPhoto, seededTeeth, uid } from '../../src/domain';
import { applicableDsd } from '../../src/dsdCatalog';
import { ASSIST_MODEL } from '../../src/assistProtocol';
import {
  BASIC_TOOLS,
  basicFrameSuggestionSchema,
} from '../../src/basicFrameSchema';
const env = {
  get: (name: string) =>
    ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'public',
      GEMINI_API_KEY: 'server-secret',
    })[name],
};
const p = newPhoto('Test', 'local', 1200, 800, 'image/png'),
  source = { workspaceId: uid(), photoId: p.id, sourceRevision: 0 };
const input = {
  ...source,
  operation: 'outline',
  model: ASSIST_MODEL,
  image: { mimeType: 'image/jpeg', data: '/9j/AAAAAAAAAAAA' },
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const request = (value: unknown = input, token = true) =>
  new Request('https://edge.test', {
    method: 'POST',
    headers: {
      Origin: 'http://127.0.0.1:5174',
      ...(token ? { Authorization: 'Bearer test-user-token' } : {}),
    },
    body: JSON.stringify(value),
  });
const output = (result: unknown) => ({
  candidates: [
    {
      finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify(result) }] },
    },
  ],
});
function fakeFetch(result: unknown, currentRevision = 0, consent = true) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    if (String(url).includes('/auth/v1/user')) return response({ id: 'owner' });
    if (String(url).includes('/rpc/'))
      return consent
        ? response(p)
        : response({ message: 'Patient AI consent is required' }, 403);
    if (String(url).includes('googleapis.com')) return response(output(result));
    return response([
      {
        body: {
          photos: [{ ...p, revision: currentRevision }],
          consent: { recordedBy: 'owner' },
        },
      },
    ]);
  }) as typeof fetch;
  return { fetcher, requests };
}
it('accepts the production origin without transmitting a photo during preflight', async () => {
  const fake = fakeFetch({});
  const result = await createHandler(
    env,
    fake.fetcher,
  )(
    new Request('https://edge.test', {
      method: 'OPTIONS',
      headers: { Origin: 'https://dsd-app.gazarxperia.workers.dev' },
    }),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get('Access-Control-Allow-Origin')).toBe(
    'https://dsd-app.gazarxperia.workers.dev',
  );
  expect(fake.requests).toHaveLength(0);
});
it('blocks anonymous, unapproved origins, and unconsented photo transmission', async () => {
  const fake = fakeFetch({});
  const handler = createHandler(env, fake.fetcher);
  expect((await handler(request(input, false))).status).toBe(401);
  expect(fake.requests).toHaveLength(0);
  expect(
    (
      await handler(
        new Request('https://edge.test', {
          method: 'POST',
          headers: { Origin: 'https://unapproved.example' },
          body: '{}',
        }),
      )
    ).status,
  ).toBe(403);
  const unconsented = fakeFetch({}, 0, false);
  expect(
    (await createHandler(env, unconsented.fetcher)(request())).status,
  ).toBe(403);
  expect(
    unconsented.requests.some((r) => r.url.includes('googleapis.com')),
  ).toBe(false);
});
it('validates normalized geometry and rejects extra assumed scale fields', async () => {
  const fake = fakeFetch({
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 800 },
      { x: 100, y: 800 },
    ],
  });
  const r = await createHandler(env, fake.fetcher)(request());
  expect(r.status).toBe(200);
  const proposal = await r.json();
  expect(proposal.source).toEqual(source);
  expect(proposal.result.points).toHaveLength(4);
  const call = fake.requests.find((r) => r.url.includes('googleapis.com'))!,
    body = JSON.parse(String(call.init!.body));
  expect(call.url).toBe(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
  );
  expect(body.generationConfig).toEqual({
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingLevel: 'low' },
  });
  expect(body.contents[0].parts[1].inlineData).toEqual(input.image);
  expect(body.contents[0].parts[0].text).toContain('JSON Schema:');
  expect(String(call.init!.body)).not.toContain('server-secret');
  expect(call.init!.headers).toMatchObject({
    'x-goog-api-key': 'server-secret',
  });
  const invalid = fakeFetch({
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 800 },
    ],
    scaleMm: 10,
  });
  expect((await createHandler(env, invalid.fetcher)(request())).status).toBe(
    422,
  );
});
it('accepts saved lighting settings in the reserved case without changing proposal geometry', async () => {
  const points = [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 800 },
    { x: 100, y: 800 },
  ];
  const fake = fakeFetch({ points });
  const reserved = {
    ...p,
    designs: p.designs.map((d) => ({
      ...d,
      lighting: { ...DEFAULT_LIGHTING, lipShadow: 35, brightness: -10 },
    })),
  };
  const fetcher: typeof fetch = (url, init) =>
    String(url).includes('/rpc/')
      ? Promise.resolve(response(reserved))
      : fake.fetcher(url, init);
  const result = await createHandler(env, fetcher)(request());
  expect(result.status).toBe(200);
  expect((await result.json()).result.points).toEqual(points);
});
it('defaults to Gemini 3.5 Flash when the client does not specify a model', async () => {
  const fake = fakeFetch({
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 800 },
    ],
  });
  const { model: _model, ...withoutModel } = input;
  const result = await createHandler(env, fake.fetcher)(request(withoutModel));
  expect(result.status).toBe(200);
  expect((await result.json()).model).toBe('gemini-3.5-flash');
  const provider = fake.requests.find((r) => r.url.includes('googleapis.com'))!;
  expect(provider.url).toBe(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
  );
});
it('rejects intersections and a photo edited while the provider was working', async () => {
  const crossed = fakeFetch({
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 800 },
      { x: 900, y: 100 },
      { x: 100, y: 800 },
    ],
  });
  expect((await createHandler(env, crossed.fetcher)(request())).status).toBe(
    422,
  );
  const stale = fakeFetch(
    {
      points: [
        { x: 100, y: 100 },
        { x: 900, y: 100 },
        { x: 900, y: 800 },
      ],
    },
    1,
  );
  expect((await createHandler(env, stale.fetcher)(request())).status).toBe(409);
});
it('keeps authentication and provider failures actionable without leaking credentials', async () => {
  const fake = fakeFetch({});
  const noSecret = {
    get: (name: string) =>
      name === 'GEMINI_API_KEY' ? undefined : env.get(name),
  };
  const result = await createHandler(noSecret, fake.fetcher)(request());
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain('server-secret');
  const broken = createHandler(env, async () =>
    response({ error: 'token' }, 401),
  );
  expect((await broken(request())).status).toBe(401);
});
it('requests the full applicable DSD checklist with explicit unavailable anatomy and no inferred scale', async () => {
  const result = {
    measurements: [
      {
        assessmentId: 'width-11',
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
        ],
      },
    ],
    unavailable: applicableDsd('smile')
      .filter((m) => m.id !== 'width-11')
      .map((m) => ({
        assessmentId: m.id,
        reason: 'Not clearly visible in this fixture.',
      })),
  };
  const fake = fakeFetch(result);
  const r = await createHandler(
    env,
    fake.fetcher,
  )(request({ ...input, operation: 'assessment' }));
  expect(r.status).toBe(200);
  expect((await r.json()).result).toEqual(result);
  const call = fake.requests.find((r) => r.url.includes('googleapis.com'))!;
  const body = JSON.parse(String(call.init!.body));
  expect(body.generationConfig).toEqual({
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingLevel: 'low' },
  });
  expect(String(call.init!.body)).toContain(
    'resting lip positions from a smiling photo',
  );
  expect(String(call.init!.body)).toContain('lateral-step-12');
  expect(String(call.init!.body)).toContain('Never infer millimeters');
});
it('rejects incomplete DSD checklists, wrong photo views, stale assessments, and assumed calibration', async () => {
  const complete = {
    measurements: [],
    unavailable: applicableDsd('smile').map((m) => ({
      assessmentId: m.id,
      reason: 'Hidden',
    })),
  };
  for (const result of [
    { ...complete, unavailable: complete.unavailable.slice(1) },
    {
      ...complete,
      unavailable: [
        ...complete.unavailable.slice(1),
        { assessmentId: 'rest-display-11', reason: 'Hidden' },
      ],
    },
    { ...complete, scaleMm: 10 },
  ]) {
    const fake = fakeFetch(result);
    expect(
      (
        await createHandler(
          env,
          fake.fetcher,
        )(request({ ...input, operation: 'assessment' }))
      ).status,
    ).toBe(422);
  }
  const fake = fakeFetch(complete, 1);
  expect(
    (
      await createHandler(
        env,
        fake.fetcher,
      )(request({ ...input, operation: 'assessment' }))
    ).status,
  ).toBe(409);
});
it('uses a saved resting view without requesting smile-only anatomy', async () => {
  const result = {
    measurements: [],
    unavailable: applicableDsd('rest').map((m) => ({
      assessmentId: m.id,
      reason: 'Hidden',
    })),
  };
  const fake = fakeFetch(result);
  const fetcher: typeof fetch = (url, init) =>
    String(url).includes('/rpc/')
      ? Promise.resolve(
          response({ ...p, dsd: { view: 'rest', unavailable: [] } }),
        )
      : fake.fetcher(url, init);
  const r = await createHandler(
    env,
    fetcher,
  )(request({ ...input, operation: 'assessment' }));
  expect(r.status).toBe(200);
  const body = JSON.parse(
    String(
      fake.requests.find((r) => r.url.includes('googleapis.com'))!.init!.body,
    ),
  );
  expect(body.contents[0].parts[0].text).toContain('rest-display-11');
  expect(body.contents[0].parts[0].text).not.toContain('corridor-right');
});
it.each([
  { status: 400, expectedStatus: 502, message: /rejected the request/ },
  { status: 404, expectedStatus: 502, message: /model is unavailable/ },
  { status: 503, expectedStatus: 503, message: /temporarily busy/ },
  { status: 429, expectedStatus: 429, message: /quota/ },
])(
  'reports provider HTTP $status without exposing its response or retrying automatically',
  async ({ status, expectedStatus, message }) => {
    const fake = fakeFetch({});
    let providerCalls = 0;
    const fetcher: typeof fetch = (url, init) => {
      if (String(url).includes('googleapis.com')) {
        providerCalls++;
        return Promise.resolve(
          response({ error: { message: 'server-secret' } }, status),
        );
      }
      return fake.fetcher(url, init);
    };
    const result = await createHandler(env, fetcher)(request());
    expect(result.status).toBe(expectedStatus);
    const body = await result.text();
    expect(body).toMatch(message);
    expect(body).not.toContain('server-secret');
    expect(providerCalls).toBe(1);
  },
);
it('honors the selected assistance model and excludes thought text from the proposal', async () => {
  const points = [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 800 },
  ];
  const fake = fakeFetch({ points });
  let providerUrl = '';
  const fetcher: typeof fetch = (url, init) => {
    if (String(url).includes('googleapis.com')) {
      providerUrl = String(url);
      return Promise.resolve(
        response({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  { thought: true, text: 'Internal reasoning is not JSON.' },
                  { text: JSON.stringify({ points }) },
                ],
              },
            },
          ],
        }),
      );
    }
    return fake.fetcher(url, init);
  };
  const result = await createHandler(
    env,
    fetcher,
  )(request({ ...input, model: 'gemini-3.8-flash' }));
  expect(result.status).toBe(200);
  expect(providerUrl).toContain('/models/gemini-3.8-flash:generateContent');
  const proposal = await result.json();
  expect(proposal.model).toBe('gemini-3.8-flash');
  expect(proposal.result).toEqual({ points });
});
it.each(['MAX_TOKENS', 'SAFETY'])(
  'rejects a %s result even when it contains valid JSON',
  async (finishReason) => {
    const fake = fakeFetch({});
    const fetcher: typeof fetch = (url, init) =>
      String(url).includes('googleapis.com')
        ? Promise.resolve(
            response({
              candidates: [
                {
                  finishReason,
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          points: [
                            { x: 100, y: 100 },
                            { x: 900, y: 100 },
                            { x: 900, y: 800 },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          )
        : fake.fetcher(url, init);
    expect((await createHandler(env, fetcher)(request())).status).toBe(422);
  },
);
it('keeps image rendering on Interactions with the original photo and design blueprint', async () => {
  const fake = fakeFetch({});
  const renderPhoto = {
    ...p,
    lip: {
      points: [
        { x: 100, y: 100 },
        { x: 1000, y: 100 },
        { x: 1000, y: 700 },
        { x: 100, y: 700 },
      ],
      closed: true,
      smoothing: 0.35,
    },
    designs: p.designs.map((d) => ({ ...d, teeth: seededTeeth(p) })),
  };
  let providerUrl = '';
  let providerBody: Record<string, unknown> = {};
  const fetcher: typeof fetch = (url, init) => {
    if (String(url).includes('/rpc/'))
      return Promise.resolve(response(renderPhoto));
    if (String(url).includes('googleapis.com')) {
      providerUrl = String(url);
      providerBody = JSON.parse(String(init!.body));
      return Promise.resolve(
        response({
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [
                { type: 'image', mime_type: 'image/png', data: 'AAAAAAAA' },
              ],
            },
          ],
        }),
      );
    }
    return fake.fetcher(url, init);
  };
  const result = await createHandler(
    env,
    fetcher,
  )(
    request({
      ...input,
      operation: 'render',
      model: 'gemini-3.1-flash-image',
      blueprint: input.image,
    }),
  );
  expect(result.status).toBe(200);
  expect(providerUrl).toBe(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
  );
  expect(providerBody).toMatchObject({
    model: 'gemini-3.1-flash-image',
    store: false,
    stream: false,
    input: [
      expect.objectContaining({ type: 'text' }),
      {
        type: 'image',
        mime_type: input.image.mimeType,
        data: input.image.data,
      },
      {
        type: 'image',
        mime_type: input.image.mimeType,
        data: input.image.data,
      },
    ],
    response_format: {
      type: 'image',
      mime_type: 'image/png',
      aspect_ratio: '3:2',
    },
  });
  expect((await result.json()).result).toEqual({
    mimeType: 'image/png',
    data: 'AAAAAAAA',
  });
});
it('serves only six basic-frame tools and requires complete identities while retaining authenticated checks', async () => {
  const valid = {
    templates: [],
    unavailable: BASIC_TOOLS.map((t) => ({ id: t.id, reason: 'Not visible.' })),
  };
  const fake = fakeFetch(valid);
  const result = await createHandler(
    env,
    fake.fetcher,
  )(request({ ...input, operation: 'basic-frame' }));
  expect(result.status).toBe(200);
  expect(
    basicFrameSuggestionSchema.parse((await result.json()).result).unavailable,
  ).toHaveLength(6);
  const provider = fake.requests.find((r) => r.url.includes('googleapis.com'))!;
  expect(provider.init!.body).toContain('15,14,13,12,11,21,22,23,24,25');
  expect(provider.init!.body).toContain('never target ratios');
  for (const bad of [
    { ...valid, unavailable: valid.unavailable.slice(1) },
    {
      ...valid,
      unavailable: [...valid.unavailable.slice(1), valid.unavailable[1]],
    },
  ]) {
    const f = fakeFetch(bad);
    expect(
      (
        await createHandler(
          env,
          f.fetcher,
        )(request({ ...input, operation: 'basic-frame' }))
      ).status,
    ).toBe(422);
  }
  expect(
    (
      await createHandler(
        env,
        fakeFetch(valid).fetcher,
      )(request({ ...input, operation: 'basic-frame' }, false))
    ).status,
  ).toBe(401);
  expect(
    (
      await createHandler(
        env,
        fakeFetch(valid, 1).fetcher,
      )(request({ ...input, operation: 'basic-frame' }))
    ).status,
  ).toBe(409);
});

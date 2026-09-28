import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createCase } from "../../src/lib/case-model";
it("executes the migration and isolates SELECT, INSERT, UPDATE and DELETE between owners", async () => {
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;grant usage on schema public,auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;insert into auth.users values('${a}'),('${b}');`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../../supabase/migrations/20260928091330_dsd_cases.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const c = createCase();
    c.ownerId = a;
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    await db.query(
      "insert into public.dsd_cases(id,owner_id,body) values($1,$2,$3)",
      [c.id, a, JSON.stringify(c)],
    );
    expect(
      (await db.query("select * from public.dsd_cases")).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "update public.dsd_cases set owner_id=$1,body=jsonb_set(body,'{ownerId}',to_jsonb($1::text)) where id=$2",
        [b, c.id],
      ),
    ).rejects.toThrow();
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    expect(
      (await db.query("select * from public.dsd_cases")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.dsd_cases set updated_at=now() where id=$1 returning id",
          [c.id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from public.dsd_cases where id=$1 returning id",
          [c.id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.dsd_cases(id,owner_id,body) values($1,$2,$3)",
        [crypto.randomUUID(), a, JSON.stringify(c)],
      ),
    ).rejects.toThrow();
    const own = createCase();
    own.ownerId = b;
    await db.query(
      "insert into public.dsd_cases(id,owner_id,body) values($1,$2,$3)",
      [own.id, b, JSON.stringify(own)],
    );
    expect(
      (await db.query("select * from public.dsd_cases")).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "update public.dsd_cases set body=jsonb_set(body,'{photos}',$1::jsonb) where id=$2",
        [JSON.stringify([{ url: "data:image/png;base64,SECRET" }]), own.id],
      ),
    ).rejects.toThrow();
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from public.dsd_cases")).rejects.toThrow();
  } finally {
    await db.close();
  }
});

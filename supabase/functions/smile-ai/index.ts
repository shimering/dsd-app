import { createHandler } from "./handler.ts";
Deno.serve(createHandler({ get: (name) => Deno.env.get(name) }));

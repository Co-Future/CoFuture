import { vi } from "vitest";

/**
 * In-memory stand-in for the Supabase client, so route handlers and jobs run without a network.
 * Every `from()` and `rpc()` call takes the next queued result for that table or function and
 * records the builder calls (`select`, `eq`, `insert` …) for assertions.
 * Only made-up test data, never real people.
 */

export const USER = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER = "22222222-2222-4222-8222-222222222222";
export const ROUND = "33333333-3333-4333-8333-333333333333";
export const TEAM = "44444444-4444-4444-8444-444444444444";
export const ORG = "55555555-5555-4555-8555-555555555555";
export const JOB = "66666666-6666-4666-8666-666666666666";
export const DECISION = "77777777-7777-4777-8777-777777777777";

export type DbError = { code?: string; hint?: string; message?: string };
export type Result = { data?: unknown; error?: DbError | null };
export type Call = { method: string; args: unknown[] };
export type FakeQuery = PromiseLike<{ data: unknown; error: DbError | null }> & {
  readonly table: string;
  readonly calls: Call[];
};

function fakeQuery(table: string, result: Result): FakeQuery {
  const calls: Call[] = [];
  const settled = { data: result.data ?? null, error: result.error ?? null };
  const query: FakeQuery = new Proxy({} as FakeQuery, {
    get(_target, prop) {
      if (prop === "then") {
        return (onOk?: (value: typeof settled) => unknown, onError?: (reason: unknown) => unknown) =>
          Promise.resolve(settled).then(onOk, onError);
      }
      if (prop === "table") return table;
      if (prop === "calls") return calls;
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
        return query;
      };
    },
  });
  return query;
}

export type FakeOptions = {
  /** Signed-in user; `null` means signed out. */
  userId?: string | null;
  /** Results per table, used in call order. Missing entries resolve to `{ data: null, error: null }`. */
  tables?: Record<string, Result[]>;
  /** Results per database function, used in call order. */
  rpc?: Record<string, Result[]>;
};

export function fakeClient(options: FakeOptions = {}) {
  const userId = options.userId === undefined ? USER : options.userId;
  const tables = structuredClone(options.tables ?? {});
  const rpcResults = structuredClone(options.rpc ?? {});
  const queries: FakeQuery[] = [];

  type Listing = { data: { name: string; created_at?: string }[] | null };
  const bucket = {
    download: vi.fn<(path: string) => Promise<{ data: Blob | null; error: DbError | null }>>(async () => ({ data: null, error: null })),
    remove: vi.fn<(paths: string[]) => Promise<{ data: null; error: null }>>(async () => ({ data: null, error: null })),
    list: vi.fn<(prefix: string, options?: unknown) => Promise<Listing>>(async () => ({ data: [] })),
  };

  const client = {
    queries,
    bucket,
    from(table: string) {
      const query = fakeQuery(table, tables[table]?.shift() ?? {});
      queries.push(query);
      return query;
    },
    rpc(name: string, args?: unknown) {
      const query = fakeQuery(`rpc:${name}`, rpcResults[name]?.shift() ?? {});
      query.calls.push({ method: "rpc", args: [args] });
      queries.push(query);
      return query;
    },
    auth: {
      getClaims: async () => ({ data: userId ? { claims: { sub: userId } } : null }),
      admin: {
        getUserById: vi.fn<(id: string) => Promise<{ data: { user: { email?: string } | null } }>>(async () => ({
          data: { user: null },
        })),
        updateUserById: vi.fn<(id: string, attrs: unknown) => Promise<{ error: DbError | null }>>(async () => ({ error: null })),
        createUser: vi.fn<(attrs: unknown) => Promise<{ data: { user: { id: string } | null }; error: DbError | null }>>(
          async () => ({ data: { user: null }, error: null }),
        ),
        deleteUser: vi.fn<(id: string) => Promise<{ error: null }>>(async () => ({ error: null })),
      },
    },
    /** Every bucket name returns the same fake bucket. */
    storage: { from: () => bucket },
  };
  return client;
}

export type FakeClient = ReturnType<typeof fakeClient>;

/** All recorded queries on one table (or `rpc:<name>`). */
export function queriesOn(client: FakeClient, table: string): FakeQuery[] {
  return client.queries.filter((q) => q.table === table);
}

/** Arguments of the first call of `method` on any query of the table, or undefined. */
export function argsOf(client: FakeClient, table: string, method: string): unknown[] | undefined {
  for (const query of queriesOn(client, table)) {
    const call = query.calls.find((c) => c.method === method);
    if (call) return call.args;
  }
  return undefined;
}

export function jsonRequest(body: unknown, init: { method?: string; url?: string; headers?: Record<string, string> } = {}) {
  return new Request(init.url ?? "http://localhost:3000/api/test", {
    method: init.method ?? "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Route context as Next passes it. Typed loosely: route types come from `next typegen`. */
export function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) } as never;
}

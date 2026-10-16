import assert from "node:assert/strict";
import { test } from "node:test";
import { runSeed, type SeedConnection, type SeedModule } from "./runner";
import { guardSeedTarget } from "./target";

// An in-memory database: table name to rows, each row tagged with its owner.
type Row = { readonly owner: string; readonly value: string };
type Store = Map<string, Row[]>;
type Tx = { store: Store; log: string[] };

function moduleOwning(name: string, table: string, values: string[]): SeedModule<Tx> {
  return {
    name,
    async reset(tx) {
      tx.log.push(`reset ${name}`);
      tx.store.set(table, (tx.store.get(table) ?? []).filter((row) => row.owner !== name));
    },
    async insert(tx) {
      tx.log.push(`insert ${name}`);
      tx.store.set(table, [...(tx.store.get(table) ?? []), ...values.map((value) => ({ owner: name, value }))]);
    },
  };
}

function inMemory(store: Store, log: string[], urls: string[] = []) {
  const events: string[] = [];
  const connect = (url: string): SeedConnection<Tx> => {
    urls.push(url);
    return {
      async transaction(work) {
        events.push("begin");
        await work({ store, log });
        events.push("commit");
      },
      async close() {
        events.push("close");
      },
    };
  };
  return { connect, events };
}

async function localTarget(url = "postgres://dev@localhost/prt") {
  const verdict = await guardSeedTarget(url, async () => undefined);
  assert.ok(verdict.ok);
  return verdict.target;
}

const modules = [moduleOwning("structure", "divisions", ["MSA", "OPS"]), moduleOwning("people", "members", ["901"])];

test("running the seed twice leaves the same rows, and keeps rows the seed does not own", async () => {
  const store: Store = new Map([["members", [{ owner: "someone-else", value: "1" }]]]);
  const { connect } = inMemory(store, []);
  const target = await localTarget();

  await runSeed(target, modules, connect);
  const once = structuredClone([...store]);
  await runSeed(target, modules, connect);

  assert.deepEqual([...store], once);
  assert.deepEqual(store.get("members"), [
    { owner: "someone-else", value: "1" },
    { owner: "people", value: "901" },
  ]);
});

test("every reset runs, last module first, before any insert, inside one transaction", async () => {
  const log: string[] = [];
  const { connect, events } = inMemory(new Map(), log);
  const report = await runSeed(await localTarget(), modules, connect);

  assert.deepEqual(log, ["reset people", "reset structure", "insert structure", "insert people"]);
  assert.deepEqual(events, ["begin", "commit", "close"]);
  assert.deepEqual(report.modules, ["structure", "people"]);
});

test("it connects to the URL the guard approved", async () => {
  const urls: string[] = [];
  const { connect } = inMemory(new Map(), [], urls);
  await runSeed(await localTarget("postgres://dev@127.0.0.1:5433/other"), modules, connect);
  assert.deepEqual(urls, ["postgres://dev@127.0.0.1:5433/other"]);
});

test("a module name registered twice is refused before any connection opens", async () => {
  const urls: string[] = [];
  const { connect } = inMemory(new Map(), [], urls);
  await assert.rejects(runSeed(await localTarget(), [...modules, modules[0]], connect), /registered twice/);
  assert.deepEqual(urls, []);
});

test("the connection closes when a module fails", async () => {
  const failing: SeedModule<Tx> = {
    name: "broken",
    reset: async () => {},
    insert: async () => Promise.reject(new Error("boom")),
  };
  const events: string[] = [];
  const connect = (): SeedConnection<Tx> => ({
    transaction: (work) => work({ store: new Map(), log: [] }),
    close: async () => {
      events.push("close");
    },
  });
  await assert.rejects(runSeed(await localTarget(), [failing], connect), /boom/);
  assert.deepEqual(events, ["close"]);
});

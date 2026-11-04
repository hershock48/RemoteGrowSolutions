// Seeds the local development store with the demo facility from lib/demo.ts,
// so the screens have something to show before a real grower types a number.
//
//   npm run seed
//
// Writes to .data/rgs (the same embedded Postgres the dev server opens), so
// run it with the server stopped. Repeatable: the demo facility is deleted
// and rebuilt each time. A deployment with no database runs the same seed
// by itself on start (lib/store.ts), which is what makes a bare preview a
// working demo.
//
// Sign-in: facility "demo", passcode "grow-demo". Not a secret. The
// consultant door in development is "rgs-dev".

import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA, DEV_DATA_DIR } from "../lib/schema.ts";
import { seedDemo } from "../lib/demo.ts";
import { todayIn } from "../lib/dates.ts";

await mkdir(`${process.cwd()}/${DEV_DATA_DIR}`, { recursive: true });
const pg = new PGlite(`${process.cwd()}/${DEV_DATA_DIR}`);
await pg.exec(SCHEMA);
const q = { query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows }) };
console.log(await seedDemo(q, todayIn("America/Detroit")));
await pg.close();

// Test-only loader hook: lets Node's native type stripping resolve the
// extensionless relative imports the app code uses (`./dates`), by trying
// `.ts` when the bare specifier does not exist. The bundler does this for the
// app; Node needs telling. Registered via `node --import` in package.json.
import { register } from "node:module";

register(new URL("./resolve-ts-hook.mjs", import.meta.url));

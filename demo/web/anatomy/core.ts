import { Catalog } from "./catalog";
import * as bindings from "../wasm/wasm";
import * as content from "../content/content";

let wasm: Promise<typeof bindings> | undefined;
let data: Promise<typeof content> | undefined;
export function getWasm() { return wasm ??= bindings.default().then(() => bindings).catch(error => { wasm = undefined; throw error; }); }
export async function getCatalog(): Promise<Catalog> {
  const module = await (data ??= content.default().then(() => content).catch(error => { data = undefined; throw error; }));
  return new Catalog(new module.CatalogData());
}

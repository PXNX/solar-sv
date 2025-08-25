import * as server from '../entries/pages/_page.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/+page.server.ts";
export const imports = ["_app/immutable/nodes/2.C8nHNn6u.js","_app/immutable/chunks/NZTpNUN0.js","_app/immutable/chunks/CsiQVNsO.js","_app/immutable/chunks/D7IEW8hv.js","_app/immutable/chunks/DUNWw_Ew.js","_app/immutable/chunks/9yHYko7p.js"];
export const stylesheets = [];
export const fonts = [];



export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.JT8z8ydV.js","_app/immutable/chunks/NZTpNUN0.js","_app/immutable/chunks/CsiQVNsO.js"];
export const stylesheets = ["_app/immutable/assets/0.B6_LLNOs.css"];
export const fonts = [];

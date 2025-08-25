export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","service-worker.js"]),
	mimeTypes: {".png":"image/png"},
	_: {
		client: {start:"_app/immutable/entry/start.C3ZF4vPz.js",app:"_app/immutable/entry/app.NDsN6YW5.js",imports:["_app/immutable/entry/start.C3ZF4vPz.js","_app/immutable/chunks/C6XLyyDo.js","_app/immutable/chunks/D7IEW8hv.js","_app/immutable/chunks/CsiQVNsO.js","_app/immutable/entry/app.NDsN6YW5.js","_app/immutable/chunks/CsiQVNsO.js","_app/immutable/chunks/D7IEW8hv.js","_app/immutable/chunks/NZTpNUN0.js","_app/immutable/chunks/DUNWw_Ew.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

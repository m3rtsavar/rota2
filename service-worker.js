const CACHE_NAME = "rota-shell-v1";
const APP_SHELL_PATHS = [
	"./",
	"./index.html",
	"./manifest.webmanifest",
	"./pwa.js",
	"./supabase/app.js",
	"./icons/icon.svg",
	"./icons/icon-180.png",
	"./icons/icon-192.png",
	"./icons/icon-512.png",
	"./icons/icon-maskable-512.png"
];
const APP_SHELL = APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href);
const CACHEABLE_PATHS = new Set(APP_SHELL_PATHS.map((path) => new URL(path, self.registration.scope).pathname));

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys
				.filter((key) => key.startsWith("rota-shell-") && key !== CACHE_NAME)
				.map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== self.location.origin || url.search || !CACHEABLE_PATHS.has(url.pathname)) return;

	const networkResponse = fetch(request);
	event.waitUntil(networkResponse.then(async (response) => {
		if (!response.ok || response.type !== "basic") return;
		try {
			const cache = await caches.open(CACHE_NAME);
			await cache.put(request, response.clone());
		} catch (error) {
			console.error("Rota uygulama kabuğu önbelleği güncellenemedi.", error);
		}
	}, () => {}));
	event.respondWith(
		networkResponse
			.catch(async () => {
				const cached = await caches.match(request);
				if (cached) return cached;
				if (request.mode === "navigate") {
					const shell = await caches.match(new URL("./index.html", self.registration.scope).href);
					if (shell) return shell;
				}
				return Response.error();
			})
	);
});

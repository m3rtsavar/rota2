const installButtons = document.querySelectorAll("[data-install-app]");
const installHelp = document.querySelector("#install-help");
const installSteps = document.querySelector("#install-help-steps");
const installDescription = document.querySelector("#install-help-description");
let installPrompt = null;

function isIosDevice() {
	return /iPad|iPhone|iPod/.test(navigator.userAgent)
		|| (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function showInstallHelp() {
	const ios = isIosDevice();
	installDescription.textContent = ios
		? "Safari'de paylaşım menüsünü kullanarak Rota'yı uygulamalarının yanına ekleyebilirsin."
		: "Tarayıcının menüsünden Rota'yı ana ekrana ekleyebilirsin.";
	const steps = ios
		? ["Safari'de bu sayfayı aç.", "Paylaş simgesine dokun.", "Aşağı kaydırıp “Ana Ekrana Ekle”yi seç."]
		: ["Tarayıcı menüsünü aç.", "“Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğine dokun.", "Onay vererek Rota'yı yükle."];
	installSteps.replaceChildren(...steps.map((step) => {
		const item = document.createElement("li");
		item.textContent = step;
		return item;
	}));
	if (typeof installHelp.showModal === "function") installHelp.showModal();
}

installButtons.forEach((button) => {
	button.hidden = !window.isSecureContext || !("serviceWorker" in navigator);
	if (button.hidden) return;
	button.addEventListener("click", async () => {
		if (!installPrompt) {
			showInstallHelp();
			return;
		}
		await installPrompt.prompt();
		const choice = await installPrompt.userChoice;
		if (choice.outcome === "accepted") installButtons.forEach((installButton) => { installButton.hidden = true; });
		installPrompt = null;
	});
});

document.querySelector("[data-close-install-help]").addEventListener("click", () => installHelp.close());
installHelp.addEventListener("click", (event) => {
	if (event.target === installHelp) installHelp.close();
});

window.addEventListener("beforeinstallprompt", (event) => {
	event.preventDefault();
	installPrompt = event;
});

window.addEventListener("appinstalled", () => {
	installPrompt = null;
	installButtons.forEach((button) => { button.hidden = true; });
});

if ("serviceWorker" in navigator && window.isSecureContext) {
	navigator.serviceWorker.register("./service-worker.js")
		.catch((error) => console.error("Rota uygulama kabuğu çevrimdışı kullanıma kaydedilemedi.", error));
}

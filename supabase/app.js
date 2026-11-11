import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://fmbcgeybsqfphuioexpg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FXUR9bqZAG1W4MOqAs1_hQ_9nP0HOT0";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authOverlay = document.querySelector("#auth-overlay");
const authMessage = document.querySelector("#auth-message");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const signoutButton = document.querySelector("#signout-button");
let currentUser = null;
let currentProfile = null;
let selectedStudentId = null;
let activeUserId = null;

function showAuthMessage(message, isError = false) {
	authMessage.textContent = message;
	authMessage.dataset.error = String(isError);
	authMessage.hidden = false;
}

function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[character]);
}

function formatDate(value, options = { day: "numeric", month: "short" }) {
	if (!value) return "Tarih belirlenmedi";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Tarih belirlenmedi" : new Intl.DateTimeFormat("tr-TR", options).format(date);
}

function formatNet(value) {
	return value == null ? "-" : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function showToast(message) {
	window.rotaShowToast?.(message);
}

function setFormBusy(form, busy, busyText) {
	const submit = form.querySelector('[type="submit"]');
	if (!submit) return;
	if (busy) {
		submit.dataset.originalText = submit.textContent;
		submit.textContent = busyText;
	} else if (submit.dataset.originalText) {
		submit.textContent = submit.dataset.originalText;
		delete submit.dataset.originalText;
	}
	submit.disabled = busy;
}

function rowsMarkup(items, emptyMessage, renderItem) {
	return items.length ? items.map(renderItem).join("") : `<p class="record-empty">${escapeHtml(emptyMessage)}</p>`;
}

function taskMarkup(task, canComplete = false) {
	const due = task.due_date ? `Son tarih: ${formatDate(task.due_date)}` : "Son tarih yok";
	const completeButton = canComplete && task.status !== "completed"
		? `<button class="text-button" type="button" data-complete-task="${escapeHtml(task.id)}">Tamamla</button>`
		: "";
	return `<div class="record-row"><div><strong>${escapeHtml(task.subject)} · ${escapeHtml(task.title)}</strong><span>${escapeHtml(task.details || due)}${task.details ? ` · ${escapeHtml(due)}` : ""}</span></div><div>${task.status === "completed" ? '<span>Tamamlandı</span>' : completeButton}</div></div>`;
}

function planMarkup(plan) {
	return `<div class="record-row"><div><strong>${escapeHtml(plan.subject)} · ${escapeHtml(plan.title)}</strong><span>${escapeHtml(plan.details || "Ders çalışması")} · ${escapeHtml(formatDate(plan.starts_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></div></div>`;
}

function examMarkup(exam) {
	const nets = [`TYT ${formatNet(exam.tyt_net)}`, `AYT ${formatNet(exam.ayt_net)}`].join(" · ");
	return `<div class="record-row"><div><strong>${escapeHtml(exam.exam_name)}</strong><span>${escapeHtml(nets)}</span></div><span>${escapeHtml(formatDate(exam.exam_date))}</span></div>`;
}

function fillStat(card, label, value, note) {
	card.querySelector(".stat-label").textContent = label;
	card.querySelector(".stat-value").textContent = value;
	card.querySelector(".stat-note").textContent = note;
}

function updateStudentOverview(tasks, exams, coach) {
	const cards = [...document.querySelectorAll("#view-dashboard .stats-row .stat-card")];
	const completed = tasks.filter((task) => task.status === "completed").length;
	const latestExam = exams[0];
	fillStat(cards[0], "Koç görevleri", String(tasks.length), `${completed} görev tamamlandı`);
	fillStat(cards[1], "Son TYT netin", latestExam ? formatNet(latestExam.tyt_net) : "-", latestExam ? formatDate(latestExam.exam_date) : "Henüz deneme yok");
	fillStat(cards[2], "Son AYT netin", latestExam ? formatNet(latestExam.ayt_net) : "-", latestExam ? latestExam.exam_name : "Henüz deneme yok");
	fillStat(cards[3], "Koç bağlantısı", coach ? "Bağlı" : "Yok", coach ? coach.display_name : "Koç kodunu ekleyebilirsin");

	const count = tasks.length;
	const percentage = count ? Math.round((completed / count) * 100) : 0;
	document.querySelector("#task-progress").textContent = `${completed} / ${count}`;
	document.querySelector(".focus-copy h2").textContent = count ? `Görevlerinin %${percentage}’i tamamlandı` : "İlk koç görevini bekliyor";
	document.querySelector(".focus-copy > p:not(.eyebrow)").textContent = coach
		? `${coach.display_name} tarafından planlanan görev ve çalışmalar burada görünür.`
		: "Koç kodunu bağlayınca görevlerin ve çalışma planın burada görünecek.";
	document.querySelector(".focus-progress").style.background = `conic-gradient(var(--sidebar) 0 ${percentage}%, rgba(51,91,50,.16) ${percentage}% 100%)`;
	document.querySelector(".focus-progress").setAttribute("aria-label", `Görevlerin yüzde ${percentage}'i tamamlandı`);
	document.querySelector(".focus-progress span").innerHTML = `${percentage}%<small>TAMAMLANDI</small>`;
}

function renderStudentTrend(exams) {
	const chart = document.querySelector(".week-panel .chart");
	const note = document.querySelector(".week-panel .chart-note");
	const results = exams.filter((exam) => exam.tyt_net != null).slice(0, 7).reverse();
	chart.style.background = "none";
	if (!results.length) {
		chart.innerHTML = '<span class="record-empty" style="grid-column:1/-1;align-self:center;text-align:center">Net grafiğin, ilk denemeni eklediğinde oluşacak.</span>';
		chart.setAttribute("aria-label", "Henüz TYT deneme neti yok");
		note.textContent = "Deneme sonuçlarını Denemelerim bölümünden ekleyebilirsin.";
		return;
	}
	const maximum = Math.max(...results.map((exam) => Number(exam.tyt_net)), 1);
	chart.innerHTML = results.map((exam) => {
		const height = Math.max(8, Math.round((Number(exam.tyt_net) / maximum) * 100));
		return `<div class="chart-day"><div class="bar-track"><span class="bar" style="height:${height}%"></span></div><span>${escapeHtml(formatDate(exam.exam_date, { day: "numeric", month: "short" }))}</span></div>`;
	}).join("");
	chart.setAttribute("aria-label", `Son ${results.length} TYT deneme neti`);
	note.textContent = `Son ${results.length} deneme · TYT neti`;
}

async function loadStudentData() {
	const linkResult = await supabase.from("coach_students").select("coach_id").eq("student_id", currentUser.id).maybeSingle();
	if (linkResult.error) throw linkResult.error;
	let coach = null;
	if (linkResult.data) {
		const coachResult = await supabase.from("profiles").select("id, display_name, institution_name").eq("id", linkResult.data.coach_id).maybeSingle();
		if (coachResult.error) throw coachResult.error;
		coach = coachResult.data;
	}

	const [tasksResult, plansResult, examsResult] = await Promise.all([
		supabase.from("student_tasks").select("id, subject, title, details, due_date, status, created_at").eq("student_id", currentUser.id).order("created_at", { ascending: false }),
		supabase.from("study_plans").select("id, subject, title, details, starts_at").eq("student_id", currentUser.id).order("starts_at", { ascending: true }),
		supabase.from("exam_results").select("id, exam_name, exam_date, tyt_net, ayt_net").eq("student_id", currentUser.id).order("exam_date", { ascending: false })
	]);
	for (const result of [tasksResult, plansResult, examsResult]) if (result.error) throw result.error;
	const tasks = tasksResult.data || [];
	const plans = plansResult.data || [];
	const exams = examsResult.data || [];

	const connectPanel = document.querySelector("#student-coach-panel");
	const linkForm = document.querySelector("#coach-link-form");
	const linkedCoach = document.querySelector("#linked-coach");
	connectPanel.hidden = false;
	linkForm.hidden = Boolean(coach);
	linkedCoach.hidden = !coach;
	document.querySelector("#student-coach-status").textContent = coach ? "Koç bağlantın etkin." : "Koçunun paylaştığı kodu girerek bağlantı kur.";
	linkedCoach.textContent = coach ? `Koçun: ${coach.display_name}${coach.institution_name ? ` · ${coach.institution_name}` : ""}` : "";

	document.querySelector("#student-tasks-list").innerHTML = rowsMarkup(tasks, "Koçun henüz görev atamadı.", (task) => taskMarkup(task, true));
	document.querySelector("#student-plans-list").innerHTML = rowsMarkup(plans, "Henüz program eklenmedi.", planMarkup);
	document.querySelector("#student-exams-list").innerHTML = rowsMarkup(exams, "Henüz deneme sonucu eklenmedi.", examMarkup);
	document.querySelector("#student-program-view-list").innerHTML = rowsMarkup(plans, "Koçun henüz çalışma programı eklemedi.", (plan) => `<div class="simple-row"><span class="simple-symbol">${escapeHtml(formatDate(plan.starts_at))}</span><span class="simple-copy"><strong>${escapeHtml(plan.subject)} · ${escapeHtml(plan.title)}</strong><span>${escapeHtml(plan.details || "Ders çalışması")}</span></span><span class="simple-meta">${escapeHtml(formatDate(plan.starts_at, { hour: "2-digit", minute: "2-digit" }))}</span></div>`);
	const fullExamList = document.querySelector("#view-denemeler .simple-list");
	if (fullExamList) fullExamList.innerHTML = rowsMarkup(exams, "Henüz deneme sonucu eklemedin.", (exam) => `<div class="simple-row"><span class="simple-symbol">YKS</span><span class="simple-copy"><strong>${escapeHtml(exam.exam_name)}</strong><span>TYT ${formatNet(exam.tyt_net)} · AYT ${formatNet(exam.ayt_net)}</span></span><span class="simple-meta">${escapeHtml(formatDate(exam.exam_date))}</span></div>`);
	renderStudentTrend(exams);
	document.querySelector("#today-task-list").innerHTML = rowsMarkup(tasks.slice(0, 4), "Koç görevlerin burada görünecek.", (task) => `<div class="task-row ${task.status === "completed" ? "is-done" : ""}"><span class="task-copy"><strong>${escapeHtml(task.subject)} · ${escapeHtml(task.title)}</strong><span>${escapeHtml(task.details || (task.due_date ? `Son tarih: ${formatDate(task.due_date)}` : "Koç görevi"))}</span></span><span class="task-tag ${task.status === "completed" ? "" : "blue"}">${task.status === "completed" ? "Tamamlandı" : "Bekliyor"}</span></div>`);
	updateStudentOverview(tasks, exams, coach);
	document.querySelectorAll("[data-complete-task]").forEach((button) => button.addEventListener("click", async () => {
		button.disabled = true;
		const { error } = await supabase.rpc("complete_student_task", { p_task_id: button.dataset.completeTask });
		if (error) {
			button.disabled = false;
			showToast(error.message);
			return;
		}
		await loadStudentData();
	}));
}

async function loadCoachStudents() {
	document.querySelector("#coach-code-display").textContent = currentProfile.coach_code;
	const { data: links, error: linkError } = await supabase.from("coach_students").select("student_id, linked_at").eq("coach_id", currentUser.id).order("linked_at", { ascending: true });
	if (linkError) throw linkError;
	const studentIds = (links || []).map((link) => link.student_id);
	let students = [];
	if (studentIds.length) {
		const { data, error } = await supabase.from("profiles").select("id, display_name, grade_level, school_name, department").in("id", studentIds);
		if (error) throw error;
		students = data || [];
	}
	document.querySelector("#coach-student-count").textContent = `${students.length} öğrenci`;
	const list = document.querySelector("#coach-students-list");
	list.innerHTML = rowsMarkup(students, "Henüz bağlı öğrenci yok.", (student) => `<button class="coach-student-button" type="button" data-student-id="${escapeHtml(student.id)}"><strong>${escapeHtml(student.display_name)}</strong><span>${escapeHtml([student.grade_level ? `${student.grade_level}. sınıf` : "", student.department || ""].filter(Boolean).join(" · ") || "Öğrenci")}</span></button>`);
	list.querySelectorAll("[data-student-id]").forEach((button) => button.addEventListener("click", () => selectStudent(students.find((student) => student.id === button.dataset.studentId))));
}

async function selectStudent(student) {
	if (!student) return;
	selectedStudentId = student.id;
	document.querySelector("#coach-student-empty").hidden = true;
	document.querySelector("#coach-student-detail").hidden = false;
	document.querySelector("#selected-student-name").textContent = student.display_name;
	document.querySelector("#selected-student-meta").textContent = [student.grade_level ? `${student.grade_level}. sınıf` : "", student.department || "", student.school_name || ""].filter(Boolean).join(" · ") || "Öğrenci profili";
	const [examsResult, tasksResult, plansResult] = await Promise.all([
		supabase.from("exam_results").select("id, exam_name, exam_date, tyt_net, ayt_net").eq("student_id", student.id).order("exam_date", { ascending: false }),
		supabase.from("student_tasks").select("id, subject, title, details, due_date, status").eq("student_id", student.id).order("created_at", { ascending: false }),
		supabase.from("study_plans").select("id, subject, title, details, starts_at").eq("student_id", student.id).order("starts_at", { ascending: true })
	]);
	for (const result of [examsResult, tasksResult, plansResult]) if (result.error) throw result.error;
	document.querySelector("#coach-exam-list").innerHTML = rowsMarkup(examsResult.data || [], "Öğrenci henüz deneme sonucu eklemedi.", examMarkup);
	document.querySelector("#coach-task-list").innerHTML = rowsMarkup(tasksResult.data || [], "Henüz görev atanmadı.", taskMarkup);
	document.querySelector("#coach-plan-list").innerHTML = rowsMarkup(plansResult.data || [], "Henüz program eklenmedi.", planMarkup);
	document.querySelectorAll(".coach-student-button").forEach((button) => button.setAttribute("aria-current", String(button.dataset.studentId === student.id)));
}

async function loadCurrentAccount(user) {
	if (activeUserId === user.id) return;
	activeUserId = user.id;
	const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
	if (error || !profile) {
		activeUserId = null;
		document.querySelector("#auth-overlay").hidden = false;
		showAuthMessage(error?.message || "Profil bulunamadı. SQL şemasının kurulduğunu kontrol et.", true);
		return;
	}
	currentUser = user;
	currentProfile = profile;
	const initials = profile.display_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
	document.querySelector("#profile-initials").textContent = initials;
	document.querySelector("#profile-name").textContent = profile.display_name;
	document.querySelector("#page-title").textContent = `Merhaba, ${profile.display_name}`;
	document.querySelector("#dashboard-date").textContent = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" }).format(new Date());
	document.querySelector("#profile-subtitle").textContent = profile.role === "coach"
		? `Koç · ${profile.institution_name || profile.department || "Bağımsız"}`
		: `${profile.grade_level === "mezun" ? "Mezun" : `${profile.grade_level || ""}. sınıf`} · ${profile.department || "Öğrenci"}`;
	window.rotaEnterApp(profile);
	try {
		if (profile.role === "coach") await loadCoachStudents();
		else await loadStudentData();
	} catch (loadError) {
		showToast(`Veriler yüklenemedi: ${loadError.message}`);
	}
}

loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	setFormBusy(loginForm, true, "Giriş yapılıyor...");
	authMessage.hidden = true;
	const values = new FormData(loginForm);
	const { data, error } = await supabase.auth.signInWithPassword({ email: values.get("email"), password: values.get("password") });
	setFormBusy(loginForm, false);
	if (error) {
		showAuthMessage("E-posta veya şifre hatalı. Bilgilerini kontrol et.", true);
		return;
	}
	authOverlay.hidden = true;
	await loadCurrentAccount(data.user);
});

signupForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	setFormBusy(signupForm, true, "Hesap oluşturuluyor...");
	authMessage.hidden = true;
	const values = new FormData(signupForm);
	const role = values.get("role");
	const metadata = {
		display_name: String(values.get("display_name") || "").trim(),
		role,
		grade_level: role === "student" ? values.get("grade_level") : null,
		school_name: role === "student" ? String(values.get("school_name") || "").trim() : null,
		department: role === "student" ? String(values.get("student_department") || "").trim() : String(values.get("coach_department") || "").trim(),
		institution_name: role === "coach" ? String(values.get("institution_name") || "").trim() : null
	};
	const { data, error } = await supabase.auth.signUp({
		email: values.get("email"),
		password: values.get("password"),
		options: { data: metadata, emailRedirectTo: window.location.origin }
	});
	setFormBusy(signupForm, false);
	if (error) {
		showAuthMessage(error.message, true);
		return;
	}
	if (!data.session) {
		showAuthMessage("Doğrulama bağlantısını e-posta adresine gönderdik. E-postanı doğruladıktan sonra giriş yap.");
		return;
	}
	authOverlay.hidden = true;
	await loadCurrentAccount(data.user);
});

document.querySelector("#coach-link-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	setFormBusy(form, true, "Bağlanıyor...");
	const code = new FormData(form).get("coach_code").trim().toUpperCase();
	const { error } = await supabase.rpc("link_student_to_coach", { p_coach_code: code });
	setFormBusy(form, false);
	if (error) {
		showToast(error.message.includes("not found") ? "Bu kodla eşleşen koç bulunamadı." : error.message);
		return;
	}
	form.reset();
	showToast("Koçunla bağlantı kuruldu.");
	await loadStudentData();
});

document.querySelector("#exam-entry-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const values = new FormData(form);
	const tytNet = values.get("tyt_net");
	const aytNet = values.get("ayt_net");
	if (!tytNet && !aytNet) {
		showToast("En az bir TYT veya AYT neti gir.");
		return;
	}
	setFormBusy(form, true, "Kaydediliyor...");
	const { error } = await supabase.from("exam_results").insert({
		student_id: currentUser.id,
		exam_name: values.get("exam_name").trim(),
		exam_date: values.get("exam_date"),
		tyt_net: tytNet ? Number(tytNet) : null,
		ayt_net: aytNet ? Number(aytNet) : null
	});
	setFormBusy(form, false);
	if (error) {
		showToast(error.message);
		return;
	}
	form.reset();
	showToast("Deneme sonucu kaydedildi.");
	await loadStudentData();
});

document.querySelector("[data-show-exam-form]").addEventListener("click", () => {
	setTimeout(() => document.querySelector("#exam-entry-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
});

document.querySelector("#coach-task-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!selectedStudentId) return;
	const form = event.currentTarget;
	const values = new FormData(form);
	setFormBusy(form, true, "Gönderiliyor...");
	const { error } = await supabase.from("student_tasks").insert({
		coach_id: currentUser.id,
		student_id: selectedStudentId,
		subject: values.get("subject").trim(),
		title: values.get("title").trim(),
		details: String(values.get("details") || "").trim() || null,
		due_date: values.get("due_date") || null
	});
	setFormBusy(form, false);
	if (error) {
		showToast(error.message);
		return;
	}
	form.reset();
	showToast("Görev öğrenciye atandı.");
	const { data: student } = await supabase.from("profiles").select("id, display_name, grade_level, school_name, department").eq("id", selectedStudentId).single();
	await selectStudent(student);
});

document.querySelector("#coach-plan-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!selectedStudentId) return;
	const form = event.currentTarget;
	const values = new FormData(form);
	setFormBusy(form, true, "Ekleniyor...");
	const { error } = await supabase.from("study_plans").insert({
		coach_id: currentUser.id,
		student_id: selectedStudentId,
		subject: values.get("subject").trim(),
		title: values.get("title").trim(),
		details: String(values.get("details") || "").trim() || null,
		starts_at: new Date(values.get("starts_at")).toISOString()
	});
	setFormBusy(form, false);
	if (error) {
		showToast(error.message);
		return;
	}
	form.reset();
	showToast("Ders programı öğrenciye eklendi.");
	const { data: student } = await supabase.from("profiles").select("id, display_name, grade_level, school_name, department").eq("id", selectedStudentId).single();
	await selectStudent(student);
});

document.querySelector("#copy-coach-code").addEventListener("click", async () => {
	if (!currentProfile?.coach_code) return;
	try {
		await navigator.clipboard.writeText(currentProfile.coach_code);
		showToast("Koç kodu kopyalandı.");
	} catch {
		showToast(`Koç kodun: ${currentProfile.coach_code}`);
	}
});

signoutButton.addEventListener("click", async () => {
	const { error } = await supabase.auth.signOut();
	if (error) showToast(error.message);
});

supabase.auth.onAuthStateChange((event, session) => {
	if (session?.user && event !== "TOKEN_REFRESHED") setTimeout(() => loadCurrentAccount(session.user), 0);
	if (event === "SIGNED_OUT") {
		activeUserId = null;
		currentUser = null;
		currentProfile = null;
		selectedStudentId = null;
		window.rotaShowLanding();
	}
});

const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
if (sessionError) showAuthMessage("Supabase oturumu yüklenemedi.", true);
if (sessionData?.session?.user) await loadCurrentAccount(sessionData.session.user);
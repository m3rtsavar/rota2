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
let selectedStudentPlans = [];
let selectedStudentHabits = [];
let selectedStudentLogs = [];
let studentPlans = [];
let studentHabits = [];
let studentLogs = [];
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = new Date();
let studentCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedStudentDate = new Date();
let flashcardItems = [];
let flashcardIndex = 0;

const studySubjects = [
	"TYT Türkçe", "TYT Matematik", "TYT Tarih", "TYT Coğrafya", "TYT Felsefe", "TYT Din Kültürü", "TYT Fizik", "TYT Kimya", "TYT Biyoloji",
	"AYT Matematik", "AYT Fizik", "AYT Kimya", "AYT Biyoloji", "AYT Türk Dili ve Edebiyatı", "AYT Tarih-1", "AYT Coğrafya-1", "AYT Tarih-2", "AYT Coğrafya-2", "AYT Felsefe Grubu", "AYT Din Kültürü"
];

const examSubjects = [
	{ id: "turkce", name: "TYT Türkçe", group: "TYT", max: 40 },
	{ id: "sosyal", name: "TYT Sosyal", group: "TYT", max: 20 },
	{ id: "tyt_matematik", name: "TYT Matematik", group: "TYT", max: 40 },
	{ id: "tyt_fen", name: "TYT Fen", group: "TYT", max: 20 },
	{ id: "ayt_matematik", name: "AYT Matematik", group: "AYT", max: 40 },
	{ id: "fizik", name: "AYT Fizik", group: "AYT", max: 14 },
	{ id: "kimya", name: "AYT Kimya", group: "AYT", max: 13 },
	{ id: "biyoloji", name: "AYT Biyoloji", group: "AYT", max: 13 },
	{ id: "edebiyat", name: "AYT Edebiyat", group: "AYT", max: 24 },
	{ id: "tarih_1", name: "AYT Tarih-1", group: "AYT", max: 10 },
	{ id: "cografya_1", name: "AYT Coğrafya-1", group: "AYT", max: 6 },
	{ id: "tarih_2", name: "AYT Tarih-2", group: "AYT", max: 11 },
	{ id: "cografya_2", name: "AYT Coğrafya-2", group: "AYT", max: 11 },
	{ id: "felsefe", name: "AYT Felsefe", group: "AYT", max: 12 },
	{ id: "din", name: "AYT Din Kültürü", group: "AYT", max: 6 }
];

function populateStudySubjects() {
	document.querySelectorAll("[data-subject-select]").forEach((select) => {
		select.innerHTML = `<option value="">Ders seç</option>${studySubjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("")}`;
	});
	document.querySelector("#error-subject-select").innerHTML = `<option value="">Ders seç (isteğe bağlı)</option>${studySubjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("")}`;
}

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

function planMarkup(plan) {
	const book = plan.books?.name ? ` · ${escapeHtml(plan.books.name)}` : "";
	return `<div class="record-row"><div><strong>${escapeHtml(plan.subject)} · ${escapeHtml(plan.title)}</strong><span>${escapeHtml(plan.details || "Ders çalışması")} · ${escapeHtml(formatDate(plan.starts_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}${book}</span></div></div>`;
}

function examMarkup(exam) {
	const nets = [`TYT ${formatNet(exam.tyt_net)}`, `AYT ${formatNet(exam.ayt_net)}`].join(" · ");
	const subjects = Object.entries(exam.subject_results || {}).map(([id, result]) => `${result.name || id}: ${formatNet(result.net)}`).join(" · ");
	return `<div class="record-row"><div><strong>${escapeHtml(exam.exam_name)}</strong><span>${escapeHtml(nets)}${subjects ? ` · ${escapeHtml(subjects)}` : ""}</span></div><span>${escapeHtml(formatDate(exam.exam_date))}</span></div>`;
}

function fillStat(card, label, value, note) {
	card.querySelector(".stat-label").textContent = label;
	card.querySelector(".stat-value").textContent = value;
	card.querySelector(".stat-note").textContent = note;
}

function resultCounts(logs) {
	return logs.reduce((totals, result) => {
		totals.correct += result.correct_count;
		totals.wrong += result.wrong_count;
		totals.blank += result.blank_count;
		return totals;
	}, { correct: 0, wrong: 0, blank: 0 });
}

function updateStudentOverview(plans, habits, exams, coach, errors, logs) {
	const today = dateKey(new Date());
	const todaysTasks = [...plans.filter((plan) => plan.study_date === today), ...habits];
	const todaysLogs = logs.filter((log) => log.work_date === today);
	const completed = todaysTasks.filter((task) => todaysLogs.some((log) => log.task_type === (task.study_date ? "plan" : "habit") && log.task_id === task.id)).length;
	const tyts = exams.filter((exam) => exam.tyt_net != null);
	const averageTyt = tyts.length ? tyts.reduce((total, exam) => total + Number(exam.tyt_net), 0) / tyts.length : null;
	const percentage = todaysTasks.length ? Math.round((completed / todaysTasks.length) * 100) : 0;
	const stats = {
		tasks: [String(todaysTasks.length), todaysTasks.length ? "Bugünün çalışmaları" : "Bugün için çalışma yok"],
		completed: [String(completed), "Tamamlanan çalışma"],
		tyt: [averageTyt == null ? "-" : formatNet(averageTyt), tyts.length ? `${tyts.length} deneme ortalaması` : "Henüz deneme yok"],
		errors: [String(errors.length), "Kaydedilen soru"]
	};
	for (const [key, [value, note]] of Object.entries(stats)) {
		document.querySelector(`[data-dashboard-stat="${key}"]`).textContent = value;
		document.querySelector(`[data-dashboard-note="${key}"]`).textContent = note;
	}
	document.querySelector("#task-progress").textContent = `${completed} / ${todaysTasks.length}`;
	document.querySelector(".focus-copy h2").textContent = todaysTasks.length ? `Bugünkü çalışmaların %${percentage} tamamlandı` : "Bugün için çalışma yok";
	document.querySelector(".dashboard-focus-copy").textContent = coach
		? `${coach.display_name} tarafından planlanan çalışmalar takviminde görünür.`
		: "Koçunu bağlayınca çalışma programın ve alışkanlıkların burada görünür.";
	document.querySelector(".focus-progress").style.background = `conic-gradient(var(--sidebar) 0 ${percentage}%, rgba(51,91,50,.16) ${percentage}% 100%)`;
	document.querySelector(".focus-progress").setAttribute("aria-label", `Bugünkü çalışmaların yüzde ${percentage}'i tamamlandı`);
	document.querySelector(".focus-progress span").innerHTML = todaysTasks.length ? `${percentage}%<small>TAMAMLANDI</small>` : "0<small>ÇALIŞMA</small>";
	document.querySelector("#dashboard-exam-count").textContent = String(exams.length);
	document.querySelector("#dashboard-tyt-net").textContent = exams[0]?.tyt_net == null ? "-" : formatNet(exams[0].tyt_net);
	const counts = resultCounts(logs);
	const totalQuestions = counts.correct + counts.wrong + counts.blank;
	const statCards = [...document.querySelectorAll("#student-statistics .stat-card")];
	fillStat(statCards[0], "Toplam soru", String(totalQuestions), `${logs.length} günlük çalışma kaydı`);
	fillStat(statCards[1], "Doğru", String(counts.correct), "Tüm kayıtlı günler");
	fillStat(statCards[2], "Yanlış", String(counts.wrong), "Tüm kayıtlı günler");
	fillStat(statCards[3], "Boş", String(counts.blank), "Tüm kayıtlı günler");
}

function dateKey(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function renderStudyCalendar(scope, plans, habits, logs) {
	const isCoach = scope === "coach";
	const month = isCoach ? calendarMonth : studentCalendarMonth;
	const selectedDate = isCoach ? selectedCalendarDate : selectedStudentDate;
	const prefix = isCoach ? "coach" : "student";
	const heading = document.querySelector(`#${prefix}-calendar-month`);
	const grid = document.querySelector(`#${prefix}-calendar-grid`);
	if (!heading || !grid) return;
	heading.textContent = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(month);
	const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
	const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
	const startOffset = (firstDay.getDay() + 6) % 7;
	const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - startOffset);
	const planDates = new Set(plans.map((plan) => plan.study_date));
	const days = Array.from({ length: 42 }, (_, index) => {
		const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
		const key = dateKey(date);
		const outsideMonth = date.getMonth() !== month.getMonth() ? " outside-month" : "";
		const hasPlans = planDates.has(key) || habits.length ? " has-plans" : "";
		return `<button class="calendar-day${outsideMonth}${hasPlans}" type="button" data-calendar-date="${key}" aria-pressed="${key === dateKey(selectedDate)}">${date.getDate()}</button>`;
	}).join("");
	grid.innerHTML = `${weekdays.map((day) => `<span class="calendar-weekday">${day}</span>`).join("")}${days}`;
	const selectedKey = dateKey(selectedDate);
	if (isCoach) {
		const planDate = document.querySelector('#coach-plan-form [name="plan_date"]');
		if (planDate) planDate.value = selectedKey;
	}
	document.querySelector(`#${prefix}-calendar-selected-label`).textContent = `Seçili gün: ${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(selectedDate)}`;
	const entries = [
		...plans.filter((plan) => plan.study_date === selectedKey).map((plan) => ({
			id: plan.id, type: "plan", subject: plan.subject, title: plan.title, details: plan.details,
			book: plan.books?.name, time: formatDate(plan.starts_at, { hour: "2-digit", minute: "2-digit" })
		})),
		...habits.map((habit) => ({ id: habit.id, type: "habit", subject: habit.subject, title: habit.title, details: habit.details }))
	];
	const dayTasks = document.querySelector(isCoach ? "#coach-calendar-day-plans" : "#student-calendar-tasks");
	const futureDay = selectedKey > dateKey(new Date());
	dayTasks.innerHTML = rowsMarkup(
		entries,
		"Bu güne çalışma veya günlük alışkanlık eklenmemiş.",
		(entry) => {
			const result = logs.find((log) => log.task_type === entry.type && log.task_id === entry.id && log.work_date === selectedKey);
			const details = [entry.time, entry.details, entry.book ? `Kitap: ${entry.book}` : ""].filter(Boolean).map(escapeHtml).join(" · ");
			const summary = result
				? `<p class="result-summary">Doğru ${result.correct_count} · Yanlış ${result.wrong_count} · Boş ${result.blank_count}</p>`
				: `<p class="result-summary">Henüz sonuç girilmedi.</p>`;
			const form = isCoach ? summary : futureDay
				? '<p class="panel-subtitle">Bu gün geldiğinde sonuçlarını girebilirsin.</p>'
				: `<form class="task-result-form" data-daily-result data-task-type="${entry.type}" data-task-id="${escapeHtml(entry.id)}" data-work-date="${selectedKey}"><label class="auth-field">Doğru<input name="correct_count" type="number" min="0" step="1" value="${result?.correct_count ?? 0}" required></label><label class="auth-field">Yanlış<input name="wrong_count" type="number" min="0" step="1" value="${result?.wrong_count ?? 0}" required></label><label class="auth-field">Boş<input name="blank_count" type="number" min="0" step="1" value="${result?.blank_count ?? 0}" required></label><button class="auth-submit" type="submit">${result ? "Sonucu güncelle" : "Sonucu kaydet"}</button></form>`;
			return `<article class="day-task-card"><strong>${escapeHtml(entry.subject)} · ${escapeHtml(entry.title)}</strong>${details ? `<p>${details}</p>` : ""}${entry.type === "habit" ? '<p class="panel-subtitle">Her gün tekrarlanır</p>' : ""}${form}</article>`;
		}
	);
}

function renderStudentDay(plans, habits, logs) {
	const today = dateKey(new Date());
	const todaysTasks = [...plans.filter((plan) => plan.study_date === today), ...habits];
	const completedCount = todaysTasks.filter((task) => logs.some((log) =>
		log.work_date === today && log.task_type === (task.study_date ? "plan" : "habit") && log.task_id === task.id
	)).length;
	document.querySelector("#task-progress").textContent = `${completedCount} / ${todaysTasks.length}`;
	document.querySelector("#today-task-list").innerHTML = rowsMarkup(
		todaysTasks,
		"Bugün için çalışma yok.",
		(task) => {
			const taskType = task.study_date ? "plan" : "habit";
			const result = logs.find((log) => log.work_date === today && log.task_type === taskType && log.task_id === task.id);
			return `<div class="task-row ${result ? "is-done" : ""}"><span class="task-copy"><strong>${escapeHtml(task.subject)} · ${escapeHtml(task.title)}</strong><span>${result ? `Doğru ${result.correct_count} · Yanlış ${result.wrong_count} · Boş ${result.blank_count}` : "Sonuç bekleniyor"}</span></span><span class="task-tag ${result ? "" : "blue"}">${result ? "Kaydedildi" : "Bekliyor"}</span></div>`;
		}
	);
}

function renderStudentStats(logs) {
	const bySubject = new Map();
	const byDayAndSubject = new Map();
	logs.forEach((log) => {
		const subjectTotals = bySubject.get(log.subject) || { correct: 0, wrong: 0, blank: 0 };
		const dayKey = `${log.work_date}|${log.subject}`;
		const dailyTotals = byDayAndSubject.get(dayKey) || { date: log.work_date, subject: log.subject, correct: 0, wrong: 0, blank: 0 };
		for (const key of ["correct", "wrong", "blank"]) {
			const count = Number(log[`${key}_count`]);
			subjectTotals[key] += count;
			dailyTotals[key] += count;
		}
		bySubject.set(log.subject, subjectTotals);
		byDayAndSubject.set(dayKey, dailyTotals);
	});
	const renderCounts = (item) => `<span>Doğru ${item.correct} · Yanlış ${item.wrong} · Boş ${item.blank} · Toplam ${item.correct + item.wrong + item.blank}</span>`;
	document.querySelector("#statistics-subject-list").innerHTML = rowsMarkup(
		[...bySubject.entries()].sort((first, second) => first[0].localeCompare(second[0], "tr")),
		"Çalışma sonuçların kaydedildikçe ders toplamları görünür.",
		([subject, totals]) => `<div class="record-row"><div><strong>${escapeHtml(subject)}</strong>${renderCounts(totals)}</div></div>`
	);
	document.querySelector("#statistics-daily-list").innerHTML = rowsMarkup(
		[...byDayAndSubject.values()].sort((first, second) => second.date.localeCompare(first.date) || first.subject.localeCompare(second.subject, "tr")),
		"Günlük sonuçların tarih ve ders bazında burada listelenir.",
		(item) => `<div class="record-row"><div><strong>${escapeHtml(formatDate(item.date, { day: "numeric", month: "short", year: "numeric" }))} · ${escapeHtml(item.subject)}</strong>${renderCounts(item)}</div></div>`
	);
}

function renderStudentHabits(habits) {
	document.querySelector("#student-habits-list").innerHTML = rowsMarkup(
		habits,
		"Koçun henüz günlük alışkanlık eklemedi.",
		(habit) => `<div class="record-row"><div><strong>${escapeHtml(habit.subject)} · ${escapeHtml(habit.title)}</strong><span>${escapeHtml(habit.details || "Her gün")}</span></div><span>Her gün</span></div>`
	);
}

function renderCoachHabits(habits) {
	document.querySelector("#coach-habit-list").innerHTML = rowsMarkup(
		habits,
		"Öğrenciye henüz alışkanlık eklenmedi.",
		(habit) => `<div class="record-row"><div><strong>${escapeHtml(habit.subject)} · ${escapeHtml(habit.title)}</strong><span>${escapeHtml(habit.details || "Her gün")}</span></div><button class="text-button" type="button" data-deactivate-habit="${escapeHtml(habit.id)}">Durdur</button></div>`
	);
}

async function signedImageUrl(path) {
	const { data, error } = await supabase.storage.from("student-media").createSignedUrl(path, 3600);
	if (error) throw error;
	return data.signedUrl;
}

async function uploadImage(file, category) {
	if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
		throw new Error("JPG, PNG veya WebP biçiminde bir fotoğraf seç.");
	}
	if (file.size > 10 * 1024 * 1024) throw new Error("Fotoğraf en fazla 10 MB olabilir.");
	const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
	const path = `${currentUser.id}/${category}/${crypto.randomUUID()}.${extension}`;
	const { error } = await supabase.storage.from("student-media").upload(path, file, { contentType: file.type, upsert: false });
	if (error) throw error;
	return path;
}

async function renderStudentMedia(books, errors) {
	const errorCards = await Promise.all(errors.map(async (item) => ({
		item,
		url: await signedImageUrl(item.image_path)
	})));
	const bookCards = await Promise.all(books.map(async (book) => ({
		book,
		url: await signedImageUrl(book.image_path)
	})));
	document.querySelector("#error-question-list").innerHTML = rowsMarkup(
		errorCards,
		"Hata defterine henüz soru eklemedin.",
		({ item, url }) => `<article class="error-card"><img src="${escapeHtml(url)}" alt="${escapeHtml(item.subject || "Hatalı soru")}"><div class="error-card-copy"><strong>${escapeHtml(item.subject || "Ders belirtilmedi")}</strong><span>${escapeHtml(item.note || formatDate(item.created_at))}</span></div><div class="card-actions"><button class="danger-button" type="button" data-delete-error="${escapeHtml(item.id)}" data-image-path="${escapeHtml(item.image_path)}">Sil</button></div></article>`
	);
	document.querySelector("#book-list").innerHTML = rowsMarkup(
		bookCards,
		"Henüz kitap eklemedin.",
		({ book, url }) => `<article class="book-card"><img src="${escapeHtml(url)}" alt="${escapeHtml(book.name)}"><div class="book-card-copy"><strong>${escapeHtml(book.name)}</strong></div><div class="card-actions"><button class="danger-button" type="button" data-delete-book="${escapeHtml(book.id)}" data-image-path="${escapeHtml(book.image_path)}">Sil</button></div></article>`
	);
	document.querySelector("#start-error-review").disabled = errors.length === 0;
	document.querySelectorAll("[data-delete-error], [data-delete-book]").forEach((button) => button.addEventListener("click", async () => {
		const table = button.hasAttribute("data-delete-error") ? "error_questions" : "books";
		const id = button.dataset.deleteError || button.dataset.deleteBook;
		button.disabled = true;
		const { error } = await supabase.from(table).delete().eq("id", id);
		if (error) {
			button.disabled = false;
			showToast(error.message);
			return;
		}
		const { error: storageError } = await supabase.storage.from("student-media").remove([button.dataset.imagePath]);
		if (storageError) showToast(`Kayıt silindi ancak fotoğraf kaldırılamadı: ${storageError.message}`);
		else showToast("Kayıt silindi.");
		await loadStudentData();
	}));
}

async function renderCoachBookPicker(books, studentId) {
	const picker = document.querySelector("#coach-book-picker");
	picker.innerHTML = "";
	document.querySelector('#coach-plan-form [name="book_id"]').value = "";
	if (!books.length) {
		picker.innerHTML = '<span class="record-empty">Öğrencinin kayıtlı kitabı yok.</span>';
		return;
	}
	const items = await Promise.all(books.map(async (book) => ({ book, url: await signedImageUrl(book.image_path) })));
	if (studentId !== selectedStudentId) return;
	picker.innerHTML = items.map(({ book, url }) => `<button class="book-choice" type="button" data-book-id="${escapeHtml(book.id)}" aria-pressed="false"><img src="${escapeHtml(url)}" alt=""><span>${escapeHtml(book.name)}</span></button>`).join("");
	picker.querySelectorAll("[data-book-id]").forEach((button) => button.addEventListener("click", () => {
		const input = document.querySelector('#coach-plan-form [name="book_id"]');
		const selected = input.value === button.dataset.bookId;
		input.value = selected ? "" : button.dataset.bookId;
		picker.querySelectorAll("[data-book-id]").forEach((choice) => choice.setAttribute("aria-pressed", String(!selected && choice === button)));
	}));
}

function renderStudentSubjects(exams) {
	const totals = new Map();
	exams.forEach((exam) => Object.entries(exam.subject_results || {}).forEach(([id, result]) => {
		const entry = totals.get(id) || { name: result.name || id, group: result.group, count: 0, net: 0 };
		entry.count += 1;
		entry.net += Number(result.net);
		totals.set(id, entry);
	}));
	const subjects = [...totals.entries()].sort((first, second) => first[1].group.localeCompare(second[1].group) || first[1].name.localeCompare(second[1].name, "tr"));
	document.querySelector("#ders-list").innerHTML = rowsMarkup(
		subjects,
		"Ders netlerin ilk denemeni eklediğinde görünür.",
		([, result]) => `<div class="simple-row"><span class="simple-symbol">${escapeHtml(result.group)}</span><span class="simple-copy"><strong>${escapeHtml(result.name)}</strong><span>${result.count} denemede ders net ortalaması</span></span><span class="simple-meta">${escapeHtml(formatNet(result.net / result.count))} net</span></div>`
	);
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

	const [plansResult, habitsResult, examsResult, booksResult, errorsResult, logsResult] = await Promise.all([
		supabase.from("study_plans").select("id, subject, title, details, book_id, study_date, starts_at, books(name)").eq("student_id", currentUser.id).order("starts_at", { ascending: true }),
		supabase.from("study_habits").select("id, subject, title, details, is_active").eq("student_id", currentUser.id).eq("is_active", true).order("created_at", { ascending: false }),
		supabase.from("exam_results").select("id, exam_name, exam_date, tyt_net, ayt_net, subject_results").eq("student_id", currentUser.id).order("exam_date", { ascending: false }),
		supabase.from("books").select("id, name, image_path, created_at").eq("student_id", currentUser.id).order("created_at", { ascending: false }),
		supabase.from("error_questions").select("id, subject, note, image_path, created_at").eq("student_id", currentUser.id).order("created_at", { ascending: false }),
		supabase.from("daily_task_results").select("id, task_type, task_id, work_date, subject, task_title, correct_count, wrong_count, blank_count").eq("student_id", currentUser.id).order("work_date", { ascending: false })
	]);
	for (const result of [plansResult, habitsResult, examsResult, booksResult, errorsResult, logsResult]) if (result.error) throw result.error;
	const plans = plansResult.data || [];
	const habits = habitsResult.data || [];
	const exams = examsResult.data || [];
	const books = booksResult.data || [];
	const errors = errorsResult.data || [];
	const logs = logsResult.data || [];
	studentPlans = plans;
	studentHabits = habits;
	studentLogs = logs;

	const connectPanel = document.querySelector("#student-coach-panel");
	const linkForm = document.querySelector("#coach-link-form");
	const linkedCoach = document.querySelector("#linked-coach");
	connectPanel.hidden = false;
	linkForm.hidden = Boolean(coach);
	linkedCoach.hidden = !coach;
	document.querySelector("#student-coach-status").textContent = coach ? "Koç bağlantın etkin." : "Koçunun paylaştığı kodu girerek bağlantı kur.";
	linkedCoach.textContent = coach ? `Koçun: ${coach.display_name}${coach.institution_name ? ` · ${coach.institution_name}` : ""}` : "";

	document.querySelector("#student-exams-list").innerHTML = rowsMarkup(exams, "Henüz deneme sonucu eklenmedi.", examMarkup);
	const fullExamList = document.querySelector("#student-exams-full-list");
	if (fullExamList) fullExamList.innerHTML = rowsMarkup(exams, "Henüz deneme sonucu eklemedin.", (exam) => `<div class="simple-row"><span class="simple-symbol">YKS</span><span class="simple-copy"><strong>${escapeHtml(exam.exam_name)}</strong><span>TYT ${formatNet(exam.tyt_net)} · AYT ${formatNet(exam.ayt_net)}</span></span><span class="simple-meta">${escapeHtml(formatDate(exam.exam_date))}</span></div>`);
	renderStudentTrend(exams);
	renderStudentSubjects(exams);
	await renderStudentMedia(books, errors);
	renderStudentHabits(habits);
	renderStudentStats(logs);
	renderStudentDay(plans, habits, logs);
	renderStudyCalendar("student", plans, habits, logs);
	updateStudentOverview(plans, habits, exams, coach, errors, logs);
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
	const isNewStudent = selectedStudentId !== student.id;
	selectedStudentId = student.id;
	document.querySelector("#coach-student-empty").hidden = true;
	document.querySelector("#coach-student-detail").hidden = false;
	document.querySelector("#selected-student-name").textContent = student.display_name;
	document.querySelector("#selected-student-meta").textContent = [student.grade_level ? `${student.grade_level}. sınıf` : "", student.department || "", student.school_name || ""].filter(Boolean).join(" · ") || "Öğrenci profili";
	const [examsResult, plansResult, booksResult, habitsResult, logsResult] = await Promise.all([
		supabase.from("exam_results").select("id, exam_name, exam_date, tyt_net, ayt_net, subject_results").eq("student_id", student.id).order("exam_date", { ascending: false }),
		supabase.from("study_plans").select("id, subject, title, details, book_id, study_date, starts_at, books(name)").eq("student_id", student.id).order("starts_at", { ascending: true }),
		supabase.from("books").select("id, name, image_path").eq("student_id", student.id).order("created_at", { ascending: false }),
		supabase.from("study_habits").select("id, subject, title, details, is_active").eq("student_id", student.id).eq("is_active", true).order("created_at", { ascending: false }),
		supabase.from("daily_task_results").select("id, task_type, task_id, work_date, subject, task_title, correct_count, wrong_count, blank_count").eq("student_id", student.id).order("work_date", { ascending: false })
	]);
	for (const result of [examsResult, plansResult, booksResult, habitsResult, logsResult]) if (result.error) throw result.error;
	if (student.id !== selectedStudentId) return;
	selectedStudentPlans = plansResult.data || [];
	selectedStudentHabits = habitsResult.data || [];
	selectedStudentLogs = logsResult.data || [];
	document.querySelector("#coach-exam-list").innerHTML = rowsMarkup(examsResult.data || [], "Öğrenci henüz deneme sonucu eklemedi.", examMarkup);
	document.querySelector("#coach-plan-list").innerHTML = rowsMarkup(plansResult.data || [], "Henüz program eklenmedi.", planMarkup);
	renderCoachHabits(selectedStudentHabits);
	if (isNewStudent) {
		calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
		selectedCalendarDate = new Date();
	}
	renderStudyCalendar("coach", selectedStudentPlans, selectedStudentHabits, selectedStudentLogs);
	await renderCoachBookPicker(booksResult.data || [], student.id);
	document.querySelectorAll(".coach-student-button").forEach((button) => button.setAttribute("aria-current", String(button.dataset.studentId === student.id)));
}

async function refreshSelectedStudent() {
	const { data, error } = await supabase.from("profiles").select("id, display_name, grade_level, school_name, department").eq("id", selectedStudentId).single();
	if (error) throw error;
	await selectStudent(data);
}

async function loadCurrentAccount(user) {
	if (activeUserId === user.id) return;
	activeUserId = user.id;
	const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
	if (error || !profile) {
		activeUserId = null;
		window.rotaShowLogin();
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

function renderExamSubjectInputs() {
	const root = document.querySelector("#exam-subject-fields");
	const groups = ["TYT", "AYT"];
	root.innerHTML = groups.map((group) => `<details ${group === "TYT" ? "open" : ""}><summary>${group} dersleri</summary><div class="exam-subject-heading"><span>Ders</span><span>Doğru</span><span>Yanlış</span></div>${examSubjects.filter((subject) => subject.group === group).map((subject) => `<label class="exam-subject-row"><span>${subject.name} · ${subject.max} soru</span><input name="${subject.id}_correct" type="number" min="0" max="${subject.max}" step="1" inputmode="numeric" placeholder="0" aria-label="${subject.name} doğru sayısı"><input name="${subject.id}_incorrect" type="number" min="0" max="${subject.max}" step="1" inputmode="numeric" placeholder="0" aria-label="${subject.name} yanlış sayısı"></label>`).join("")}</div></details>`).join("");
}
populateStudySubjects();
renderExamSubjectInputs();

document.querySelector("#exam-entry-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const values = new FormData(form);
	const subjectResults = {};
	const groupNets = { TYT: 0, AYT: 0 };
	const groupHasResults = { TYT: false, AYT: false };
	for (const subject of examSubjects) {
		const correctValue = values.get(`${subject.id}_correct`);
		const incorrectValue = values.get(`${subject.id}_incorrect`);
		const correct = Number(correctValue || 0);
		const incorrect = Number(incorrectValue || 0);
		if (!correctValue && !incorrectValue) continue;
		if (correct + incorrect > subject.max) {
			showToast(`${subject.name} için doğru ve yanlış toplamı ${subject.max} soruyu geçemez.`);
			return;
		}
		const net = correct - incorrect / 4;
		subjectResults[subject.id] = { name: subject.name, group: subject.group, correct, incorrect, net };
		groupNets[subject.group] += net;
		groupHasResults[subject.group] = true;
	}
	if (!Object.keys(subjectResults).length) {
		showToast("En az bir ders için doğru veya yanlış sayısı gir.");
		return;
	}
	setFormBusy(form, true, "Kaydediliyor...");
	const { error } = await supabase.from("exam_results").insert({
		student_id: currentUser.id,
		exam_name: values.get("exam_name").trim(),
		exam_date: values.get("exam_date"),
		tyt_net: groupHasResults.TYT ? groupNets.TYT : null,
		ayt_net: groupHasResults.AYT ? groupNets.AYT : null,
		subject_results: subjectResults
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

document.querySelector("#error-upload-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const values = new FormData(form);
	setFormBusy(form, true, "Yükleniyor...");
	let imagePath = null;
	try {
		imagePath = await uploadImage(values.get("image"), "errors");
		const { error } = await supabase.from("error_questions").insert({
			student_id: currentUser.id,
			image_path: imagePath,
			subject: String(values.get("subject") || "").trim() || null,
			note: String(values.get("note") || "").trim() || null
		});
		if (error) {
			const { error: cleanupError } = await supabase.storage.from("student-media").remove([imagePath]);
			throw new Error(cleanupError ? `${error.message}. Fotoğraf temizlenemedi: ${cleanupError.message}` : error.message);
		}
		form.reset();
		showToast("Soru hata defterine eklendi.");
		await loadStudentData();
	} catch (error) {
		showToast(`Fotoğraf yüklenemedi: ${error.message}`);
	} finally {
		setFormBusy(form, false);
	}
});

document.querySelector("#book-entry-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const values = new FormData(form);
	setFormBusy(form, true, "Yükleniyor...");
	let imagePath = null;
	try {
		imagePath = await uploadImage(values.get("image"), "books");
		const { error } = await supabase.from("books").insert({
			student_id: currentUser.id,
			name: String(values.get("name") || "").trim(),
			image_path: imagePath
		});
		if (error) {
			const { error: cleanupError } = await supabase.storage.from("student-media").remove([imagePath]);
			throw new Error(cleanupError ? `${error.message}. Fotoğraf temizlenemedi: ${cleanupError.message}` : error.message);
		}
		form.reset();
		showToast("Kitaplarına eklendi.");
		await loadStudentData();
	} catch (error) {
		showToast(`Kitap eklenemedi: ${error.message}`);
	} finally {
		setFormBusy(form, false);
	}
});

function showFlashcard() {
	const stage = document.querySelector("#flashcard-stage");
	const card = document.querySelector("#flashcard");
	stage.hidden = flashcardItems.length === 0;
	if (!flashcardItems.length) return;
	const item = flashcardItems[flashcardIndex];
	card.innerHTML = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.subject || "Hata defterindeki soru")}">`;
	document.querySelector("#flashcard-meta").textContent = `${flashcardIndex + 1} / ${flashcardItems.length} · ${item.subject || "Ders belirtilmedi"}${item.note ? ` · ${item.note}` : ""}`;
}

document.querySelector("#start-error-review").addEventListener("click", async () => {
	try {
		const { data, error } = await supabase.from("error_questions").select("id, subject, note, image_path").eq("student_id", currentUser.id);
		if (error) throw error;
		flashcardItems = await Promise.all((data || []).map(async (item) => ({ ...item, url: await signedImageUrl(item.image_path) })));
		for (let index = flashcardItems.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(Math.random() * (index + 1));
			[flashcardItems[index], flashcardItems[swapIndex]] = [flashcardItems[swapIndex], flashcardItems[index]];
		}
		flashcardIndex = 0;
		showFlashcard();
		if (!flashcardItems.length) showToast("Hata defterinde henüz soru yok.");
	} catch (error) {
		showToast(`Hata defteri açılamadı: ${error.message}`);
	}
});

document.querySelectorAll("[data-flashcard-step]").forEach((button) => button.addEventListener("click", () => {
	if (!flashcardItems.length) return;
	flashcardIndex = (flashcardIndex + Number(button.dataset.flashcardStep) + flashcardItems.length) % flashcardItems.length;
	showFlashcard();
}));

document.addEventListener("keydown", (event) => {
	if (document.querySelector("#flashcard-stage").hidden || !flashcardItems.length) return;
	if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
		flashcardIndex = (flashcardIndex + (event.key === "ArrowRight" ? 1 : -1) + flashcardItems.length) % flashcardItems.length;
		showFlashcard();
	}
});

document.querySelector("[data-show-exam-form]").addEventListener("click", () => {
	setTimeout(() => document.querySelector("#exam-entry-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
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
		book_id: values.get("book_id") || null,
		study_date: values.get("plan_date"),
		starts_at: new Date(`${values.get("plan_date")}T${values.get("plan_time")}`).toISOString()
	});
	setFormBusy(form, false);
	if (error) {
		showToast(error.message);
		return;
	}
	form.reset();
	form.elements.plan_date.value = dateKey(selectedCalendarDate);
	showToast("Ders programı öğrenciye eklendi.");
	await refreshSelectedStudent();
});

document.querySelector("#coach-habit-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!selectedStudentId) return;
	const form = event.currentTarget;
	const values = new FormData(form);
	setFormBusy(form, true, "Ekleniyor...");
	const { error } = await supabase.from("study_habits").insert({
		coach_id: currentUser.id,
		student_id: selectedStudentId,
		subject: values.get("subject").trim(),
		title: values.get("title").trim(),
		details: String(values.get("details") || "").trim() || null
	});
	setFormBusy(form, false);
	if (error) {
		showToast(error.message);
		return;
	}
	form.reset();
	showToast("Günlük alışkanlık öğrenciye eklendi.");
	await refreshSelectedStudent();
});

document.querySelector("#coach-habit-list").addEventListener("click", async (event) => {
	const button = event.target.closest("[data-deactivate-habit]");
	if (!button || !selectedStudentId) return;
	button.disabled = true;
	const { error } = await supabase.from("study_habits").update({ is_active: false }).eq("id", button.dataset.deactivateHabit).eq("student_id", selectedStudentId);
	if (error) {
		button.disabled = false;
		showToast(error.message);
		return;
	}
	showToast("Günlük alışkanlık durduruldu.");
	await refreshSelectedStudent();
});

document.querySelector("#coach-calendar-grid").addEventListener("click", (event) => {
	const button = event.target.closest("[data-calendar-date]");
	if (!button) return;
	selectedCalendarDate = new Date(`${button.dataset.calendarDate}T12:00:00`);
	calendarMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
	renderStudyCalendar("coach", selectedStudentPlans, selectedStudentHabits, selectedStudentLogs);
});

document.querySelector('#coach-plan-form [name="plan_date"]').addEventListener("change", (event) => {
	if (!event.currentTarget.value) return;
	selectedCalendarDate = new Date(`${event.currentTarget.value}T12:00:00`);
	calendarMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
	renderStudyCalendar("coach", selectedStudentPlans, selectedStudentHabits, selectedStudentLogs);
});

document.querySelector("#student-calendar-grid").addEventListener("click", (event) => {
	const button = event.target.closest("[data-calendar-date]");
	if (!button) return;
	selectedStudentDate = new Date(`${button.dataset.calendarDate}T12:00:00`);
	studentCalendarMonth = new Date(selectedStudentDate.getFullYear(), selectedStudentDate.getMonth(), 1);
	renderStudyCalendar("student", studentPlans, studentHabits, studentLogs);
});

document.querySelectorAll("[data-calendar-month]").forEach((button) => button.addEventListener("click", () => {
	if (button.dataset.calendarScope === "coach") {
		calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(button.dataset.calendarMonth), 1);
		renderStudyCalendar("coach", selectedStudentPlans, selectedStudentHabits, selectedStudentLogs);
		return;
	}
	studentCalendarMonth = new Date(studentCalendarMonth.getFullYear(), studentCalendarMonth.getMonth() + Number(button.dataset.calendarMonth), 1);
	renderStudyCalendar("student", studentPlans, studentHabits, studentLogs);
}));

document.addEventListener("submit", async (event) => {
	const form = event.target;
	if (!form.matches("[data-daily-result]")) return;
	event.preventDefault();
	const values = new FormData(form);
	const correct = Number(values.get("correct_count"));
	const wrong = Number(values.get("wrong_count"));
	const blank = Number(values.get("blank_count"));
	if (![correct, wrong, blank].every(Number.isInteger) || correct < 0 || wrong < 0 || blank < 0 || correct + wrong + blank === 0) {
		showToast("Doğru, yanlış veya boş alanlarından en az birine sıfırdan büyük bir sayı gir.");
		return;
	}
	setFormBusy(form, true, "Kaydediliyor...");
	const { error } = await supabase.rpc("save_daily_task_result", {
		p_task_type: form.dataset.taskType,
		p_task_id: form.dataset.taskId,
		p_work_date: form.dataset.workDate,
		p_correct: correct,
		p_wrong: wrong,
		p_blank: blank
	});
	setFormBusy(form, false);
	if (error) {
		showToast(error.message);
		return;
	}
	showToast("Günlük sonuç kaydedildi.");
	await loadStudentData();
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
if (sessionError) {
	window.rotaShowLogin();
	showAuthMessage("Supabase oturumu yüklenemedi.", true);
} else if (sessionData?.session?.user) {
	await loadCurrentAccount(sessionData.session.user);
} else if (window.rotaHasPanelRoute()) {
	window.rotaShowLogin();
} else {
	window.rotaShowLanding();
}
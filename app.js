import firebaseConfig from './firebase-config.js';
import { initializeApp } from "firebase/app";
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "firebase/auth";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// --- State ---
const loginOverlay = document.getElementById('login-overlay');
const appContent = document.getElementById('app-content');

const btnLogin = document.getElementById('btn-login');
const btnGuest = document.getElementById('btn-guest');
const btnLogout = document.getElementById('btn-logout');

const userInfoEl = document.getElementById('user-info');
const appTitleEl = document.getElementById('app-title');

const successCountEl = document.getElementById('success-count');
const calendarTitleEl = document.getElementById('calendar-title');
const calendarGridEl = document.getElementById('calendar-grid');
const logListEl = document.getElementById('log-list');
const logDateLabel = document.getElementById('log-date-label');

const inputDate = document.getElementById('input-date');
const inputTime = document.getElementById('input-time');
const inputComment = document.getElementById('input-comment');
const btnSave = document.getElementById('btn-save');

const xpBarFill = document.getElementById('xp-bar-fill');
const xpStatusText = document.getElementById('xp-status');
const appLevelEl = document.getElementById('app-level');
const levelNameEl = document.getElementById('level-name');

// Lottery Elements
const collectionCountEl = document.getElementById('collection-count');
const prizeCollectionEl = document.getElementById('prize-collection');
const gachaOverlay = document.getElementById('gacha-overlay');
const gachaBox = document.getElementById('gacha-box');
const gachaResult = document.getElementById('gacha-result');
const gachaLoadingText = document.getElementById('gacha-loading-text');
const btnCloseGacha = document.getElementById('btn-close-gacha');

const prizeStarsEl = document.getElementById('prize-stars');
const prizeIconEl = document.getElementById('prize-icon');
const prizeNameEl = document.getElementById('prize-name');
const rarityGuideEl = document.getElementById('rarity-guide');

let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();
let activeViewDate = formatDateForInput(new Date());
let currentHeatmapView = 'accident';

const STICKER_THRESHOLD = 100;
const levelNames = ['トイレの たまご', 'トイレの ひよこ', 'おしっこ ガードマン', 'おしっこ ナイト', 'トイレの 王さま'];

const ANIMAL_POOL = [
    { id: 'lion', name: 'ライオン', emoji: '🦁', stars: 5, weight: 5 },
    { id: 'giraffe', name: 'きりん', emoji: '🦒', stars: 4, weight: 15 },
    { id: 'dog', name: 'いぬ', emoji: '🐶', stars: 3, weight: 25 },
    { id: 'elephant', name: 'ぞう', emoji: '🐘', stars: 2, weight: 30 },
    { id: 'dinosaur', name: 'きょうりゅう', emoji: '🦖', stars: 1, weight: 25 },
];

// ユーザーデータ
let historyData = JSON.parse(localStorage.getItem('onesho-v3-history') || '{}');
let gachaData = JSON.parse(localStorage.getItem('onesho-v3-gacha') || '{ "tickets": 0, "collection": [] }');
let currentUser = null;

let editingKey = null;
let editingIndex = null;

// --- Helpers ---
function triggerHaptic(intensity = 15) {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(intensity);
    }
}

function formatDateForInput(date) {
    if (!date) return "";
    const d = new Date(date);
    let m = '' + (d.getMonth() + 1), dy = '' + d.getDate(), y = d.getFullYear();
    if (m.length < 2) m = '0' + m; if (dy.length < 2) dy = '0' + dy;
    return [y, m, dy].join('-');
}

// --- Auth HANDLING ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginOverlay.style.display = 'none';
        appContent.style.display = 'flex';
        userInfoEl.textContent = `${user.email} で ログイン中`;
        await syncDataOnLogin();
        init();
    } else {
        currentUser = null;
        loginOverlay.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

function init() {
    setDefaultDateTime();
    setupToggles();
    renderAll();
}

function renderAll() {
    renderLog();
    renderCalendar();
    updateStats();
    updateStickers();
    renderHeatmap();
    renderCollectionUI();
}

// --- Analysis ---
window.setHeatmapView = (view) => {
    currentHeatmapView = view;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    renderHeatmap();
};

function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const matrix = Array(7).fill(0).map(() => Array(24).fill(0));
    Object.keys(historyData).forEach(dateStr => {
        const date = new Date(dateStr);
        const day = date.getDay();
        historyData[dateStr].forEach(entry => {
            const h = parseInt(entry.time.split(':')[0]);
            if (currentHeatmapView === 'accident') {
                if (entry.type === 'fail') matrix[day][h]++;
            } else { matrix[day][h]++; }
        });
    });
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    for (let day = 0; day < 7; day++) {
        const label = document.createElement('div'); label.className = 'day-label'; label.textContent = dayLabels[day]; grid.appendChild(label);
        for (let hour = 0; hour < 24; hour++) {
            const count = matrix[day][hour]; const cell = document.createElement('div');
            let level = 0; if (count > 0) level = 1; if (count > 2) level = 2; if (count > 4) level = 3;
            cell.className = `heatmap-cell level-${level}`; grid.appendChild(cell);
        }
    }
}

// --- Lottery ---
async function runLottery() {
    gachaOverlay.style.display = 'flex';
    gachaBox.style.display = 'block';
    gachaResult.style.display = 'none';
    gachaLoadingText.textContent = "どうぶつ くじ引き中...";

    await new Promise(r => setTimeout(r, 1500));

    const totalWeight = ANIMAL_POOL.reduce((s, a) => s + a.weight, 0);
    let rand = Math.random() * totalWeight;
    let prize = ANIMAL_POOL[ANIMAL_POOL.length - 1];
    for (const a of ANIMAL_POOL) { if (rand < a.weight) { prize = a; break; } rand -= a.weight; }

    gachaData.collection.unshift(prize.id);
    if (gachaData.collection.length > 50) gachaData.collection.pop();
    saveLocal(); await syncToFirestore();

    gachaBox.style.display = 'none';
    gachaLoadingText.textContent = "おたから どうぶつ ゲット！";
    gachaResult.style.display = 'block';
    prizeStarsEl.textContent = '⭐️'.repeat(prize.stars);
    prizeIconEl.textContent = prize.emoji;
    prizeNameEl.textContent = prize.name;

    // Rarity Guide Visualization
    rarityGuideEl.innerHTML = 'ランキング: ' + ANIMAL_POOL.map(a =>
        `<span style="${a.id === prize.id ? 'font-weight:bold; color:#fbc02d; text-decoration:underline;' : 'opacity:0.4;'}">${a.emoji}</span>`
    ).join(' > ');

    if (prize.stars >= 4) { launchConfetti(); triggerHaptic([100, 50, 100]); } else { triggerHaptic(50); }
}

btnCloseGacha.addEventListener('click', () => {
    gachaOverlay.style.display = 'none';
    renderAll();
});

// --- Actions ---
btnSave.addEventListener('click', async () => {
    triggerHaptic(30);
    const dateStr = inputDate.value;
    const entry = {
        time: inputTime.value,
        type: getActiveToggleValue('status-toggle'),
        amount: getActiveToggleValue('amount-toggle'),
        urge: 'unknown', comment: inputComment.value, timestamp: Date.now()
    };
    if (!dateStr) return;
    if (editingKey !== null && editingIndex !== null) { historyData[editingKey][editingIndex] = entry; editingKey = null; editingIndex = null; }
    else { if (!historyData[dateStr]) historyData[dateStr] = []; historyData[dateStr].push(entry); }
    saveLocal(); await syncToFirestore();
    btnSave.textContent = '✅ きろくしました！';
    setTimeout(() => { btnSave.textContent = 'きろくをのこす！（くじなし）'; }, 1500);
    activeViewDate = dateStr; renderAll();
});

window.quickLog = async function (type) {
    triggerHaptic(40);
    const now = new Date();
    const dateStr = formatDateForInput(now);
    const entry = {
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        type, amount: 'medium', urge: 'unknown', comment: 'クイック！', timestamp: Date.now()
    };
    if (!historyData[dateStr]) historyData[dateStr] = [];
    historyData[dateStr].push(entry);
    saveLocal(); await syncToFirestore();
    setTimeout(runLottery, 500);
    activeViewDate = dateStr; renderAll();
};

// --- Renders ---
function renderLog() {
    const logs = historyData[activeViewDate] || [];
    const todayStr = formatDateForInput(new Date());
    logDateLabel.textContent = (activeViewDate === todayStr) ? 'きょう' : activeViewDate.replace(/-/g, '/');
    logListEl.innerHTML = '';
    if (logs.length === 0) { logListEl.innerHTML = '<p style="color:#ccc;">まだ きろくが ありません</p>'; return; }

    // Recent 3 only
    [...logs].reverse().slice(0, 3).forEach((log) => {
        const div = document.createElement('div'); div.className = 'log-item animate-pop';
        div.innerHTML = `<div class="log-time">${log.time}</div><div class="log-icon">${log.type === 'success' ? '☀️' : '🌈'}</div><div class="log-content"><div class="log-details">${log.type === 'success' ? 'できた' : 'おもらし'} / ${log.amount}</div></div>`;
        logListEl.appendChild(div);
    });
}

function updateStickers() {
    let totalXP = 0;
    Object.values(historyData).forEach(dayLogs => { dayLogs.forEach(e => totalXP += (e.type === 'success' ? 50 : 20)); });
    const level = Math.floor(totalXP / STICKER_THRESHOLD);
    const currentXP = totalXP % STICKER_THRESHOLD;
    if (appLevelEl) appLevelEl.textContent = `Lv.${level + 1}`;
    if (levelNameEl) levelNameEl.textContent = levelNames[Math.min(level, levelNames.length - 1)];
    if (xpBarFill) xpBarFill.style.width = `${(currentXP / STICKER_THRESHOLD) * 100}%`;
    if (xpStatusText) xpStatusText.textContent = `あと ${STICKER_THRESHOLD - currentXP} XP で レベルアップ！`;
}

function renderCollectionUI() {
    collectionCountEl.textContent = gachaData.collection.length;
    prizeCollectionEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const div = document.createElement('div'); div.className = 'prize-slot';
        const animalId = gachaData.collection[i];
        if (animalId) { const animal = ANIMAL_POOL.find(a => a.id === animalId); div.textContent = animal ? animal.emoji : '🐾'; }
        else div.textContent = '？';
        prizeCollectionEl.appendChild(div);
    }
}

async function syncDataOnLogin() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            historyData = { ...data.history, ...historyData };
            if (data.gacha) gachaData = { ...data.gacha, ...gachaData };
        }
        saveLocal();
    } catch (err) { console.error("Sync Error", err); }
}

async function syncToFirestore() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), { history: historyData, gacha: gachaData, updatedAt: Date.now() }, { merge: true });
    } catch (err) { console.error("Cloud Error", err); }
}

function saveLocal() {
    localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
    localStorage.setItem('onesho-v3-gacha', JSON.stringify(gachaData));
}

function setDefaultDateTime() {
    const now = new Date();
    inputDate.value = formatDateForInput(now);
    inputTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function setupToggles() {
    document.querySelectorAll('.btn-toggle-group').forEach(group => {
        group.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    });
}

function getActiveToggleValue(groupId) {
    const activeBtn = document.querySelector(`#${groupId} .toggle-btn.active`);
    return activeBtn ? activeBtn.getAttribute('data-value') : null;
}

function renderCalendar() {
    calendarGridEl.innerHTML = '';
    calendarTitleEl.textContent = `${selectedYear}年 ${selectedMonth + 1}月`;
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    dayNames.forEach(name => { const div = document.createElement('div'); div.className = 'day-name'; div.textContent = name; calendarGridEl.appendChild(div); });
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { calendarGridEl.appendChild(document.createElement('div')); }
    const todayStr = formatDateForInput(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div'); div.className = 'day';
        const dayDate = new Date(selectedYear, selectedMonth, day);
        const key = formatDateForInput(dayDate);
        if (key === todayStr) div.classList.add('today');
        const dayLogs = historyData[key] || [];
        if (dayLogs.length > 0) {
            const hasSuccess = dayLogs.some(l => l.type === 'success');
            const hasFail = dayLogs.some(l => l.type === 'fail');
            if (hasSuccess && !hasFail) div.style.background = '#e1f5fe';
            else if (hasFail && !hasSuccess) div.style.background = '#fff3e0';
            else if (hasSuccess && hasFail) div.style.background = 'linear-gradient(135deg, #e1f5fe 50%, #fff3e0 50%)';
        }
        const span = document.createElement('span'); span.textContent = day; div.appendChild(span);
        div.addEventListener('click', () => { activeViewDate = key; inputDate.value = key; renderAll(); });
        calendarGridEl.appendChild(div);
    }
}

document.getElementById('prev-month').addEventListener('click', () => { selectedMonth--; if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; } renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { selectedMonth++; if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; } renderCalendar(); });

btnLogin.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => { console.error("Login Error", err); });
});

btnGuest.addEventListener('click', () => {
    loginOverlay.style.display = 'none';
    appContent.style.display = 'flex';
    userInfoEl.textContent = "テストモード（保存されません）";
    init();
});

window.generateReport = () => {
    const reportText = ["【おねしょ卒業レポート】"];
    const now = new Date(); const month = now.getMonth() + 1;
    let success = 0, total = 0;
    Object.keys(historyData).forEach(key => {
        if (key.includes(`-${String(month).padStart(2, '0')}-`)) {
            const logs = historyData[key]; total += logs.length; success += logs.filter(e => e.type === 'success').length;
        }
    });
    reportText.push(`${month}月の成績: ${total}回中 ${success}回 成功！`);
    alert(reportText.join('\n'));
};

function launchConfetti() { confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } }); }

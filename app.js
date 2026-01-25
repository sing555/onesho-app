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

// --- Helpers ---
function triggerHaptic(intensity = 15) {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(intensity);
    }
}

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

// Lottery (Animal Kujibiki) Elements
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

let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();
let activeViewDate = formatDateForInput(new Date());

const STICKER_THRESHOLD = 100;
const levelNames = ['トイレの たまご', 'トイレの ひよこ', 'おしっこ ガードマン', 'おしっこ ナイト', 'トイレの 王さま'];

// Animal Prize Pool (Ranking reflected in rarity)
// 1. Lion (⭐️⭐️⭐️⭐️⭐️), 2. Giraffe (⭐️⭐️⭐️⭐️), 3. Dog (⭐️⭐️⭐️), 4. Elephant (⭐️⭐️), 5. Dinosaur (⭐️)
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

// --- Auth Handling ---
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
        if (appContent.style.display !== 'flex') { loginOverlay.style.display = 'flex'; }
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

// --- Data Sync ---
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
        saveLocal(); await syncToFirestore();
    } catch (err) { console.error("Fetch Error:", err); }
}

async function syncToFirestore() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            history: historyData,
            gacha: gachaData,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (err) { console.error("Sync Error:", err); }
}

function saveLocal() {
    localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
    localStorage.setItem('onesho-v3-gacha', JSON.stringify(gachaData));
}

// --- Logic ---
function formatDateForInput(date) {
    const d = new Date(date);
    let m = '' + (d.getMonth() + 1), dy = '' + d.getDate(), y = d.getFullYear();
    if (m.length < 2) m = '0' + m; if (dy.length < 2) dy = '0' + dy;
    return [y, m, dy].join('-');
}

function setDefaultDateTime() {
    const now = new Date();
    inputDate.value = formatDateForInput(now);
    inputTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function setupToggles() {
    document.querySelectorAll('.btn-toggle-group').forEach(group => {
        const newGroup = group.cloneNode(true);
        group.parentNode.replaceChild(newGroup, group);
        newGroup.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                triggerHaptic(10);
                newGroup.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    });
}

function setToggleValue(groupId, value) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === value);
    });
}

function getActiveToggleValue(groupId) {
    const activeBtn = document.querySelector(`#${groupId} .toggle-btn.active`);
    return activeBtn ? activeBtn.getAttribute('data-value') : null;
}

// --- Animal Lottery System ---
function renderCollectionUI() {
    collectionCountEl.textContent = gachaData.collection.length;
    prizeCollectionEl.innerHTML = '';
    // 最大10個のスロットを表示（持っているものを優先）
    for (let i = 0; i < 10; i++) {
        const div = document.createElement('div');
        div.className = 'prize-slot';
        const animalId = gachaData.collection[i];
        if (animalId) {
            const animal = ANIMAL_POOL.find(a => a.id === animalId);
            div.textContent = animal ? animal.emoji : '🐾';
        } else {
            div.textContent = '？';
        }
        prizeCollectionEl.appendChild(div);
    }
}

async function runAnimalLottery() {
    // 演出開始
    gachaOverlay.style.display = 'flex';
    gachaBox.style.display = 'block';
    gachaResult.style.display = 'none';
    gachaLoadingText.textContent = "どうぶつ くじ引き中... 何が出るかな？";

    await new Promise(r => setTimeout(r, 1500)); // 朝の忙しさを考慮し少し短縮

    // 抽選
    const totalWeight = ANIMAL_POOL.reduce((s, a) => s + a.weight, 0);
    let rand = Math.random() * totalWeight;
    let prize = ANIMAL_POOL[ANIMAL_POOL.length - 1];
    for (const a of ANIMAL_POOL) {
        if (rand < a.weight) {
            prize = a;
            break;
        }
        rand -= a.weight;
    }

    // データ保存
    gachaData.collection.unshift(prize.id); // 最新を前に
    if (gachaData.collection.length > 50) gachaData.collection.pop(); // 溢れ防止
    saveLocal();
    await syncToFirestore();

    // 結果表示
    gachaBox.style.display = 'none';
    gachaLoadingText.textContent = "おたから どうぶつ ゲット！";
    gachaResult.style.display = 'block';
    prizeStarsEl.textContent = '⭐️'.repeat(prize.stars);
    prizeIconEl.textContent = prize.emoji;
    prizeNameEl.textContent = prize.name;

    if (prize.stars >= 4) {
        launchConfetti();
        triggerHaptic([100, 50, 100]);
    } else {
        triggerHaptic(50);
    }
}

btnCloseGacha.addEventListener('click', () => {
    gachaOverlay.style.display = 'none';
    renderAll();
});

// --- Recording ---
btnSave.addEventListener('click', async () => {
    triggerHaptic(30);
    const dateStr = inputDate.value;
    const time = inputTime.value;
    const type = getActiveToggleValue('status-toggle');
    const amount = getActiveToggleValue('amount-toggle');
    const urge = getActiveToggleValue('urge-toggle');
    const comment = inputComment.value;

    if (!dateStr) { alert('ひにちを いれてね！'); return; }
    const entry = { time, type, amount, urge, comment, timestamp: Date.now() };

    if (editingKey !== null && editingIndex !== null) {
        historyData[editingKey][editingIndex] = entry;
        editingKey = null; editingIndex = null;
        btnSave.textContent = 'きろくをのこす！'; btnSave.style.background = '';
    } else {
        if (!historyData[dateStr]) historyData[dateStr] = [];
        historyData[dateStr].push(entry);
        // 新規登録なら自動くじ引き
        setTimeout(runAnimalLottery, 800);
    }

    if (historyData[dateStr]) historyData[dateStr].sort((a, b) => a.time.localeCompare(b.time));
    saveLocal(); await syncToFirestore();

    const originalText = btnSave.textContent;
    btnSave.textContent = '✅ きろくしたよ！';
    const originalBg = btnSave.style.background;
    btnSave.style.background = '#81c784';
    setTimeout(() => { btnSave.textContent = originalText; btnSave.style.background = originalBg; }, 1500);

    if (type === 'success') { launchConfetti(); } else { showPuffyToast(); }
    inputComment.value = ''; activeViewDate = dateStr; renderAll();
});

window.quickLog = async function (type) {
    triggerHaptic(40);
    const now = new Date();
    const dateStr = formatDateForInput(now);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (!historyData[dateStr]) historyData[dateStr] = [];
    const entry = { time, type, amount: 'medium', urge: 'unknown', comment: 'クイック！', timestamp: Date.now() };
    historyData[dateStr].push(entry);
    historyData[dateStr].sort((a, b) => a.time.localeCompare(b.time));

    saveLocal(); await syncToFirestore();

    const btn = document.querySelector(`.quick-btn.${type}`);
    if (btn) { const originalText = btn.textContent; btn.textContent = '✨ OK!'; setTimeout(() => btn.textContent = originalText, 1000); }
    if (type === 'success') { launchConfetti(); } else { showPuffyToast(); }

    // 自動くじ引き開始
    setTimeout(runAnimalLottery, 800);

    activeViewDate = dateStr; renderAll();
};

function updateStickers() {
    let totalXP = 0;
    Object.values(historyData).forEach(dayLogs => {
        dayLogs.forEach(e => {
            if (e.type === 'success') totalXP += 50;
            else totalXP += 20;
        });
    });
    const level = Math.floor(totalXP / STICKER_THRESHOLD);
    const currentXP = totalXP % STICKER_THRESHOLD;
    const stickerGrid = document.getElementById('sticker-grid');
    if (appLevelEl) appLevelEl.textContent = `Lv.${level + 1}`;
    if (levelNameEl) levelNameEl.textContent = levelNames[Math.min(level, levelNames.length - 1)];
    if (xpBarFill) xpBarFill.style.width = `${(currentXP / STICKER_THRESHOLD) * 100}%`;
    if (xpStatusText) xpStatusText.textContent = `あと ${STICKER_THRESHOLD - currentXP} XP で レベルアップ！`;
    if (!stickerGrid) return;
    stickerGrid.innerHTML = '';
    // ここではレベルバッジを表示（アイコンは上位4種など）
    const icons = ['🐣', '🐥', '🛡️', '⚔️', '👑'];
    icons.forEach((s, i) => {
        const div = document.createElement('div');
        const isActive = i < level;
        div.className = `sticker-item ${isActive ? 'active animate-pop' : ''}`;
        div.textContent = isActive ? s : '？';
        stickerGrid.appendChild(div);
    });
}

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
            if (entry.type === 'fail') matrix[day][h]++;
        });
    });
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    for (let day = 0; day < 7; day++) {
        const label = document.createElement('div');
        label.className = 'day-label'; label.textContent = dayLabels[day]; grid.appendChild(label);
        for (let hour = 0; hour < 24; hour++) {
            const count = matrix[day][hour]; const cell = document.createElement('div');
            let level = 0; if (count > 0) level = 1; if (count > 2) level = 2; if (count > 4) level = 3;
            cell.className = `heatmap-cell level-${level}`; grid.appendChild(cell);
        }
    }
}

btnLogin.addEventListener('click', () => {
    triggerHaptic(20);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => {
        console.error("Login Error:", err);
        alert("ログインに しっぱいしました。");
    });
});
btnGuest.addEventListener('click', () => {
    triggerHaptic(20); loginOverlay.style.display = 'none'; appContent.style.display = 'flex';
    userInfoEl.textContent = "ゲストモード（クラウド保存されません）"; init();
});
btnLogout.addEventListener('click', () => {
    if (confirm("ログアウトしますか？")) { signOut(auth).then(() => { location.reload(); }); }
});

window.generateReport = function () {
    const reportText = ["【トイレきろく レポート】"];
    const now = new Date(); const month = now.getMonth() + 1;
    let success = 0, total = 0;
    Object.keys(historyData).forEach(key => {
        if (key.includes(`-${String(month).padStart(2, '0')}-`)) {
            const logs = historyData[key]; total += logs.length; success += logs.filter(e => e.type === 'success').length;
        }
    });
    reportText.push(`${month}月のせいせき: ${total}回中 ${success}回 できた！`);
    const allLogs = [];
    Object.keys(historyData).sort().reverse().forEach(date => {
        historyData[date].forEach(l => { const icon = l.type === 'success' ? '☀️' : '🌈'; allLogs.push(`${date} ${l.time}: ${icon}`); });
    });
    reportText.push(...allLogs.slice(0, 5));
    alert(reportText.join('\n'));
};

function launchConfetti() { confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } }); }
function showPuffyToast() {
    const toast = document.createElement('div'); toast.className = 'puffy-toast animate-pop';
    toast.textContent = '🌈 つぎは はれるよ！'; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000);
}

function updateStats() {
    const now = new Date(); const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    let count = 0;
    Object.keys(historyData).forEach(key => { if (key.startsWith(monthPrefix)) count += historyData[key].filter(e => e.type === 'success').length; });
    successCountEl.textContent = count;
}

function renderLog() {
    const logs = historyData[activeViewDate] || [];
    const todayStr = formatDateForInput(new Date());
    logDateLabel.textContent = (activeViewDate === todayStr) ? 'きょう' : activeViewDate.replace(/-/g, '/');
    logListEl.innerHTML = logs.length ? '' : '<p style="color:#cfd8dc; font-size:0.9rem;">まだ きろくが ありません</p>';
    logs.forEach((log, index) => {
        const div = document.createElement('div'); div.className = 'log-item animate-pop';
        const amountJp = { small: 'すくない', medium: 'ふつう', large: 'おおい' }[log.amount];
        const urgeJp = log.urge === 'yes' ? '尿意あり' : '尿意なし';
        const icon = log.type === 'success' ? '☀️' : '🌈';
        const statusText = log.type === 'success' ? 'できた！' : 'おしい！';
        div.innerHTML = `
            <div class="log-time">${log.time}</div><div class="log-icon">${icon}</div>
            <div class="log-content"><div class="log-details">${statusText} / ${amountJp} / ${urgeJp}</div>${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}</div>
            <div style="display:flex; flex-direction:column; gap:5px;"><button class="edit-btn" data-key="${activeViewDate}" data-index="${index}" style="background:none; border:none; color:#72c6ef; font-size:0.8rem; cursor:pointer;">しゅうせい</button><button class="delete-btn" data-key="${activeViewDate}" data-index="${index}" style="background:none; border:none; color:#ff8b8b; font-size:0.8rem; cursor:pointer;">サヨナラ</button></div>
        `;
        logListEl.appendChild(div);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const key = e.target.getAttribute('data-key'); const index = e.target.getAttribute('data-index');
            if (confirm('このきろくを けしても いい？')) { historyData[key].splice(index, 1); if (historyData[key].length === 0) delete historyData[key]; saveLocal(); await syncToFirestore(); renderAll(); }
        });
    });
    document.querySelectorAll('.edit-btn').forEach(btn => { btn.addEventListener('click', (e) => { const key = e.target.getAttribute('data-key'); const index = parseInt(e.target.getAttribute('data-index')); startEdit(key, index); }); });
}

function startEdit(key, index) {
    const log = historyData[key][index]; editingKey = key; editingIndex = index;
    inputDate.value = key; inputTime.value = log.time; inputComment.value = log.comment || '';
    setToggleValue('status-toggle', log.type); setToggleValue('urge-toggle', log.urge); setToggleValue('amount-toggle', log.amount);
    btnSave.textContent = '✨ しゅうせいする！'; btnSave.style.background = '#ffd93d';
    document.querySelector('.today-card').scrollIntoView({ behavior: 'smooth' });
}

function renderCalendar() {
    calendarGridEl.innerHTML = ''; calendarTitleEl.textContent = `${selectedYear}年 ${selectedMonth + 1}月`;
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    dayNames.forEach(name => { const div = document.createElement('div'); div.className = 'day-name'; div.textContent = name; calendarGridEl.appendChild(div); });
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay(); const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { calendarGridEl.appendChild(document.createElement('div')); }
    const todayStr = formatDateForInput(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div'); div.className = 'day';
        const dayDate = new Date(selectedYear, selectedMonth, day); const key = formatDateForInput(dayDate);
        if (key === todayStr) div.classList.add('today'); if (key === activeViewDate) div.style.borderColor = '#ffd93d';
        const dayLogs = historyData[key] || [];
        if (dayLogs.length > 0) {
            const hasSuccess = dayLogs.some(l => l.type === 'success'); const hasFail = dayLogs.some(l => l.type === 'fail');
            if (hasSuccess && !hasFail) div.style.background = '#e1f5fe'; else if (hasFail && !hasSuccess) div.style.background = '#fff3e0'; else if (hasSuccess && hasFail) div.style.background = 'linear-gradient(135deg, #e1f5fe 50%, #fff3e0 50%)';
        }
        const span = document.createElement('span'); span.textContent = day; div.appendChild(span);
        div.addEventListener('click', () => { activeViewDate = key; inputDate.value = key; renderAll(); });
        calendarGridEl.appendChild(div);
    }
}

document.getElementById('prev-month').addEventListener('click', () => { selectedMonth--; if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; } renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { selectedMonth++; if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; } renderCalendar(); });

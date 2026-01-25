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
    getDoc,
    onSnapshot
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
const btnLogout = document.getElementById('btn-logout');

const successCountEl = document.getElementById('success-count');
const calendarTitleEl = document.getElementById('calendar-title');
const calendarGridEl = document.getElementById('calendar-grid');
const logListEl = document.getElementById('log-list');
const logDateLabel = document.getElementById('log-date-label');

const inputDate = document.getElementById('input-date');
const inputTime = document.getElementById('input-time');
const inputComment = document.getElementById('input-comment');
const btnSave = document.getElementById('btn-save');

let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();
let activeViewDate = formatDateForInput(new Date());

const STICKER_THRESHOLD = 5;
const stickers = ['🚒', '🚓', '🦁', '🦖', '🚀'];

// ローカルのデータ（Firestoreと同期する）
let historyData = JSON.parse(localStorage.getItem('onesho-v3-history') || '{}');
let currentUser = null;

// --- Auth Handling ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginOverlay.style.display = 'none';
        appContent.style.display = 'flex'; // blockからflexに変更して中央寄せ

        // ユーザー情報を表示
        const userInfoEl = document.getElementById('user-info');
        if (userInfoEl) {
            userInfoEl.textContent = `${user.email} で ログイン中`;
        }

        // Firestoreからデータ取得
        await syncFromFirestore();
        init();
    } else {
        currentUser = null;
        loginOverlay.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

btnLogin.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => {
        console.error("Login Error:", err);
        alert("ログインに しっぱいしました。");
    });
});

btnLogout.addEventListener('click', () => {
    if (confirm("ログアウトしますか？")) {
        signOut(auth);
    }
});

// --- Data Sync ---
async function syncToFirestore() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            history: historyData,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (err) {
        console.error("Sync Error:", err);
    }
}

async function syncFromFirestore() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // ローカルより新しいデータがあれば上書き、またはマージ（今回は単純上書き）
            historyData = data.history || {};
            localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

// --- App Logic ---
function init() {
    setDefaultDateTime();
    setupToggles();
    renderCalendar();
    updateStats();
    renderLog();
    updateStickers();
    renderChart();
}

function formatDateForInput(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

function setDefaultDateTime() {
    const now = new Date();
    inputDate.value = formatDateForInput(now);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    inputTime.value = `${hours}:${minutes}`;
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

btnSave.addEventListener('click', async () => {
    const dateStr = inputDate.value;
    const time = inputTime.value;
    const type = getActiveToggleValue('status-toggle');
    const amount = getActiveToggleValue('amount-toggle');
    const urge = getActiveToggleValue('urge-toggle');
    const comment = inputComment.value;

    if (!dateStr) { alert('ひにちを いれてね！'); return; }
    if (!historyData[dateStr]) historyData[dateStr] = [];

    const entry = { time, type, amount, urge, comment, timestamp: Date.now() };
    historyData[dateStr].push(entry);
    historyData[dateStr].sort((a, b) => a.time.localeCompare(b.time));

    localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
    await syncToFirestore(); // クラウドに保存

    // フィードバック
    const originalText = btnSave.textContent;
    btnSave.textContent = '✅ きろくしたよ！';
    btnSave.style.background = '#81c784';
    setTimeout(() => {
        btnSave.textContent = originalText;
        btnSave.style.background = '';
    }, 1500);

    if (type === 'success') { launchConfetti(); } else { showPuffyToast(); }

    inputComment.value = '';
    activeViewDate = dateStr;
    renderAll();
});

window.quickLog = async function (type) {
    const now = new Date();
    const dateStr = formatDateForInput(now);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!historyData[dateStr]) historyData[dateStr] = [];
    const entry = { time, type, amount: 'medium', urge: 'unknown', comment: 'クイック！', timestamp: Date.now() };
    historyData[dateStr].push(entry);
    historyData[dateStr].sort((a, b) => a.time.localeCompare(b.time));

    localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
    await syncToFirestore();

    const btn = event?.target || document.querySelector(`.quick-btn.${type}`);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✨ OK!';
        setTimeout(() => btn.textContent = originalText, 1000);
    }

    if (type === 'success') { launchConfetti(); } else { showPuffyToast(); }
    activeViewDate = dateStr;
    renderAll();
};

function renderAll() {
    renderLog();
    renderCalendar();
    updateStats();
    updateStickers();
    renderChart();
}

function updateStickers() {
    let totalSuccess = 0;
    Object.values(historyData).forEach(dayLogs => {
        totalSuccess += dayLogs.filter(e => e.type === 'success').length;
    });
    const stickerGrid = document.getElementById('sticker-grid');
    const statusText = document.getElementById('sticker-status');
    stickerGrid.innerHTML = '';
    const earnedCount = Math.floor(totalSuccess / STICKER_THRESHOLD);
    const progress = totalSuccess % STICKER_THRESHOLD;
    stickers.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = `sticker-item ${i < earnedCount ? 'active animate-pop' : ''}`;
        div.textContent = i < earnedCount ? s : '？';
        stickerGrid.appendChild(div);
    });
    if (earnedCount < stickers.length) {
        statusText.textContent = `あと ${STICKER_THRESHOLD - progress}回で 次のシール！`;
    } else {
        statusText.textContent = `ぜんぶの シールを あつめたよ！すごい！`;
    }
}

function renderChart() {
    const canvas = document.getElementById('timeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const stats = Array(24).fill(0);
    Object.values(historyData).forEach(dayLogs => {
        dayLogs.forEach(entry => {
            const h = parseInt(entry.time.split(':')[0]);
            stats[h]++;
        });
    });
    const maxVal = Math.max(...stats, 1);
    ctx.clearRect(0, 0, width, height);
    const barWidth = width / 24;
    stats.forEach((val, i) => {
        const barHeight = (val / maxVal) * (height - 20);
        ctx.fillStyle = '#72c6ef';
        if (i >= 20 || i <= 6) ctx.fillStyle = '#ffb74d';
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
    });
    ctx.fillStyle = '#999';
    ctx.font = '8px sans-serif';
    ctx.fillText('0じ', 0, height);
    ctx.fillText('12じ', width / 2 - 10, height);
    ctx.fillText('23じ', width - 20, height);
}

window.generateReport = function () {
    const reportText = ["【トイレきろく レポート】"];
    const now = new Date();
    const month = now.getMonth() + 1;
    let success = 0, total = 0;
    Object.keys(historyData).forEach(key => {
        if (key.includes(`-${String(month).padStart(2, '0')}-`)) {
            const logs = historyData[key];
            total += logs.length;
            success += logs.filter(e => e.type === 'success').length;
        }
    });
    reportText.push(`${month}月のせいせき: ${total}回中 ${success}回 できた！`);
    const allLogs = [];
    Object.keys(historyData).sort().reverse().forEach(date => {
        historyData[date].forEach(l => {
            const icon = l.type === 'success' ? '☀️' : '🌈';
            allLogs.push(`${date} ${l.time}: ${icon}`);
        });
    });
    reportText.push(...allLogs.slice(0, 5));
    alert(reportText.join('\n') + '\n\n(このテキストをスクショして先生に見せてね！)');
};

function launchConfetti() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#72c6ef', '#ffd93d', '#ff8b8b', '#ffffff'] });
}

function showPuffyToast() {
    const toast = document.createElement('div');
    toast.className = 'puffy-toast animate-pop';
    toast.textContent = '🌈 つぎは はれるよ！';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function updateStats() {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    let count = 0;
    Object.keys(historyData).forEach(key => {
        if (key.startsWith(monthPrefix)) {
            count += historyData[key].filter(e => e.type === 'success').length;
        }
    });
    successCountEl.textContent = count;
}

function renderLog() {
    const logs = historyData[activeViewDate] || [];
    const todayStr = formatDateForInput(new Date());
    logDateLabel.textContent = (activeViewDate === todayStr) ? 'きょう' : activeViewDate.replace(/-/g, '/');
    logListEl.innerHTML = logs.length ? '' : '<p style="color:#cfd8dc; font-size:0.9rem;">まだ きろくが ありません</p>';
    logs.forEach((log, index) => {
        const div = document.createElement('div');
        div.className = 'log-item animate-pop';
        const amountJp = { small: 'すくない', medium: 'ふつう', large: 'おおい' }[log.amount];
        const urgeJp = log.urge === 'yes' ? '尿意あり' : '尿意なし';
        const icon = log.type === 'success' ? '☀️' : '🌈';
        const statusText = log.type === 'success' ? 'できた！' : 'おしい！';
        div.innerHTML = `
            <div class="log-time">${log.time}</div>
            <div class="log-icon">${icon}</div>
            <div class="log-content">
                <div class="log-details">${statusText} / ${amountJp} / ${urgeJp}</div>
                ${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}
            </div>
            <button class="delete-btn" data-key="${activeViewDate}" data-index="${index}" style="background:none; border:none; color:#ff8b8b; font-size:0.8rem; cursor:pointer;">削除</button>
        `;
        logListEl.appendChild(div);
    });

    // 削除ボタンへのイベント付与
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.target.getAttribute('data-key');
            const index = e.target.getAttribute('data-index');
            deleteLog(key, index);
        });
    });
}

async function deleteLog(key, index) {
    if (confirm('このきろくを けしても いい？')) {
        historyData[key].splice(index, 1);
        if (historyData[key].length === 0) delete historyData[key];
        localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
        await syncToFirestore();
        renderAll();
    }
}

function renderCalendar() {
    calendarGridEl.innerHTML = '';
    calendarTitleEl.textContent = `${selectedYear}年 ${selectedMonth + 1}月`;
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    dayNames.forEach(name => {
        const div = document.createElement('div');
        div.className = 'day-name';
        div.textContent = name;
        calendarGridEl.appendChild(div);
    });
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { calendarGridEl.appendChild(document.createElement('div')); }
    const todayStr = formatDateForInput(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'day';
        const dayDate = new Date(selectedYear, selectedMonth, day);
        const key = formatDateForInput(dayDate);
        if (key === todayStr) div.classList.add('today');
        if (key === activeViewDate) div.style.borderColor = '#ffd93d';
        const dayLogs = historyData[key] || [];
        if (dayLogs.length > 0) {
            const hasSuccess = dayLogs.some(l => l.type === 'success');
            const hasFail = dayLogs.some(l => l.type === 'fail');
            if (hasSuccess && !hasFail) div.style.background = '#e1f5fe';
            else if (hasFail && !hasSuccess) div.style.background = '#fff3e0';
            else if (hasSuccess && hasFail) div.style.background = 'linear-gradient(135deg, #e1f5fe 50%, #fff3e0 50%)';
        }
        const span = document.createElement('span');
        span.textContent = day;
        div.appendChild(span);
        div.addEventListener('click', () => {
            activeViewDate = key;
            inputDate.value = key;
            renderAll();
        });
        calendarGridEl.appendChild(div);
    }
}

document.getElementById('prev-month').addEventListener('click', () => {
    selectedMonth--;
    if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; }
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    selectedMonth++;
    if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; }
    renderCalendar();
});

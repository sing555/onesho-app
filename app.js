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

// --- DOM Elements ---
const loginOverlay = document.getElementById('login-overlay');
const appContent = document.getElementById('app-content');
const btnLogin = document.getElementById('btn-login');
const btnGuest = document.getElementById('btn-guest');
const btnLogout = document.getElementById('btn-logout');
const userInfoEl = document.getElementById('user-info');

const calendarTitleEl = document.getElementById('calendar-title');
const calendarGridEl = document.getElementById('calendar-grid');
const logListEl = document.getElementById('log-list');
const logDateLabel = document.getElementById('log-date-label');

const inputDate = document.getElementById('input-date');
const inputTime = document.getElementById('input-time');
const inputComment = document.getElementById('input-comment');
const btnSave = document.getElementById('btn-save');

// --- State ---
let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();
let activeViewDate = formatDateForInput(new Date());
let currentHeatmapView = 'accident';

let historyData = JSON.parse(localStorage.getItem('onesho-v3-history') || '{}');
let currentUser = null;
let editingKey = null;
let editingIndex = null;

// --- Helpers ---
function formatDateForInput(date) {
    if (!date) return "";
    const d = new Date(date);
    let m = '' + (d.getMonth() + 1), dy = '' + d.getDate(), y = d.getFullYear();
    if (m.length < 2) m = '0' + m; if (dy.length < 2) dy = '0' + dy;
    return [y, m, dy].join('-');
}

function triggerHaptic(intensity = 15) {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(intensity);
    }
}

// --- Auth Handling ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginOverlay.style.display = 'none';
        appContent.style.display = 'flex';
        userInfoEl.textContent = `${user.email}`;
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
    renderHeatmap();
    updateStreak();
}

// --- Analysis View Logic ---
window.setHeatmapView = (view) => {
    currentHeatmapView = view;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    renderHeatmap();
};

window.toggleAnalysis = () => {
    const card = document.getElementById('chart-card');
    card.classList.toggle('active');
};

function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const matrix = Array(7).fill(0).map(() => Array(24).fill(0));

    Object.keys(historyData).forEach(dateStr => {
        const date = new Date(dateStr);
        const day = date.getDay();
        (historyData[dateStr] || []).forEach(entry => {
            const h = parseInt(entry.time.split(':')[0]);
            if (currentHeatmapView === 'accident') {
                if (entry.type === 'fail') matrix[day][h]++;
            } else {
                matrix[day][h]++;
            }
        });
    });

    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

    // Header row for weekdays
    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'hour-label'; // style placeholder
    grid.appendChild(emptyCorner);

    dayLabels.forEach(day => {
        const label = document.createElement('div');
        label.className = 'day-label-header';
        label.textContent = day;
        grid.appendChild(label);
    });

    // Body: Hours rows (4-hour blocks to save significant space)
    for (let hBlock = 0; hBlock < 6; hBlock++) {
        const hourStart = hBlock * 4;

        // Left label for the hour block
        const hLabel = document.createElement('div');
        hLabel.className = 'hour-label';
        hLabel.textContent = `${hourStart}`;
        grid.appendChild(hLabel);

        for (let day = 0; day < 7; day++) {
            // Sum counts for the 4-hour block
            let count = 0;
            for (let i = 0; i < 4; i++) {
                count += matrix[day][hourStart + i];
            }

            const cell = document.createElement('div');
            let level = 0;
            if (count > 0) level = 1;
            if (count > 2) level = 2;
            if (count > 4) level = 3;
            cell.className = `heatmap-cell level-${level}`;
            cell.title = `${dayLabels[day]}曜 ${hourStart}-${hourStart + 3}時: ${count}件`;
            grid.appendChild(cell);
        }
    }
}

// --- Data Operations ---
btnSave.addEventListener('click', async () => {
    triggerHaptic(20);
    const dateStr = inputDate.value;
    const entry = {
        time: inputTime.value,
        type: getActiveToggleValue('status-toggle'),
        amount: getActiveToggleValue('amount-toggle'),
        urge: getActiveToggleValue('urge-toggle'),
        comment: inputComment.value,
        timestamp: Date.now()
    };

    if (!dateStr) { alert("日付を選択してください"); return; }

    if (editingKey !== null && editingIndex !== null) {
        historyData[editingKey][editingIndex] = entry;
        editingKey = null; editingIndex = null;
        btnSave.textContent = '記録を保存する';
    } else {
        if (!historyData[dateStr]) historyData[dateStr] = [];
        historyData[dateStr].push(entry);
    }

    saveLocal(); await syncToFirestore();
    inputComment.value = '';
    renderAll();

    const originalText = btnSave.textContent;
    btnSave.textContent = '✅ 保存しました';
    setTimeout(() => { btnSave.textContent = originalText; }, 1500);
});

window.quickLog = async function (type) {
    triggerHaptic(30);
    const now = new Date();
    const dateStr = formatDateForInput(now);
    const entry = {
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        type,
        amount: 'medium',
        urge: type === 'success' ? 'yes' : 'no',
        comment: 'クイック記録',
        timestamp: Date.now()
    };
    if (!historyData[dateStr]) historyData[dateStr] = [];
    historyData[dateStr].push(entry);
    saveLocal(); await syncToFirestore();
    activeViewDate = dateStr;
    renderAll();
};

function renderLog() {
    const logs = historyData[activeViewDate] || [];
    const todayStr = formatDateForInput(new Date());
    logDateLabel.textContent = (activeViewDate === todayStr) ? 'きょう' : activeViewDate.replace(/-/g, '/');
    logListEl.innerHTML = '';

    if (logs.length === 0) {
        logListEl.innerHTML = '<p style="color:#94a3b8; font-size:0.8rem; text-align:center;">記録がありません</p>';
        return;
    }

    // 時間順に並べ替えて最新3件を表示（UIをスッキリさせるため）
    const sortedLogs = [...logs].sort((a, b) => a.time.localeCompare(b.time));
    const displayLogs = sortedLogs.reverse().slice(0, 3);

    displayLogs.forEach((log) => {
        const realIndex = logs.indexOf(log);
        const div = document.createElement('div');
        div.className = 'log-item';
        const icon = log.type === 'success' ? '☀️' : '🌧️';
        const typeLabel = log.type === 'success' ? '成功' : 'おもらし';
        const amtLabel = { small: '少', medium: '中', large: '多' }[log.amount] || '中';
        const urgeLabel = log.urge === 'yes' ? '尿意あり' : '尿意なし';
        const urgeClass = log.urge === 'yes' ? 'urge-yes' : 'urge-no';

        div.innerHTML = `
            <div class="log-time">${log.time}</div>
            <div class="log-icon">${icon}</div>
            <div class="log-content">
                <div class="log-details">${typeLabel} / 量:${amtLabel} / <span class="${urgeClass}">${urgeLabel}</span></div>
                ${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="startEdit('${activeViewDate}', ${realIndex})" style="background:none; border:none; color:#64b5f6; font-size:0.75rem; cursor:pointer;">編集</button>
                <button onclick="deleteEntry('${activeViewDate}', ${realIndex})" style="background:none; border:none; color:#ef4444; font-size:0.75rem; cursor:pointer;">削除</button>
            </div>
        `;
        logListEl.appendChild(div);
    });
}

window.startEdit = (key, index) => {
    const log = historyData[key][index]; editingKey = key; editingIndex = index;
    inputDate.value = key; inputTime.value = log.time; inputComment.value = log.comment || '';
    setToggleValue('status-toggle', log.type);
    setToggleValue('amount-toggle', log.amount);
    setToggleValue('urge-toggle', log.urge || 'no');
    btnSave.textContent = '✨ 編集を確定する';
    document.querySelector('.today-card').scrollIntoView({ behavior: 'smooth' });
};

window.deleteEntry = async (key, index) => {
    if (!confirm("この記録を削除してもよろしいですか？")) return;
    triggerHaptic(50);
    historyData[key].splice(index, 1);
    if (historyData[key].length === 0) delete historyData[key];
    saveLocal(); await syncToFirestore();
    renderAll();
};

// --- Calendar & Sync ---
function updateStreak() {
    const streakEl = document.getElementById('streak-counter');
    const streakDaysEl = document.getElementById('streak-days');
    if (!streakEl || !streakDaysEl) return;

    let streak = 0;
    const now = new Date();
    // Start checking from yesterday to see the current ongoing streak
    let checkDate = new Date(now);

    // An "all-dry" day is a day that has at least one record and ZERO 'fail' records.
    // If a day has no records, we treat it as unknown and break the streak.

    while (true) {
        const key = formatDateForInput(checkDate);
        const dayLogs = historyData[key];

        if (dayLogs && dayLogs.length > 0) {
            const hasFail = dayLogs.some(l => l.type === 'fail');
            if (!hasFail) {
                streak++;
            } else {
                // If today has a fail, the streak is 0 unless we are looking at a past streak.
                // But usually, streak is "up to yesterday". 
                // Let's count "consecutive dry days up to today".
                break;
            }
        } else {
            // No records for this day. 
            // If it's today and no records yet, we continue checking yesterday.
            const todayStr = formatDateForInput(now);
            if (key !== todayStr) {
                break;
            }
        }
        checkDate.setDate(checkDate.getDate() - 1);
        if (streak > 365) break; // Safety break
    }

    if (streak > 0) {
        streakEl.style.display = 'inline-flex';
        streakDaysEl.textContent = streak;
    } else {
        streakEl.style.display = 'none';
    }
}

function renderCalendar() {
    calendarGridEl.innerHTML = '';
    calendarTitleEl.textContent = `${selectedYear}年 ${selectedMonth + 1}月`;
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    dayNames.forEach(name => {
        const div = document.createElement('div'); div.className = 'day-name'; div.style.fontSize = '0.6rem'; div.textContent = name; calendarGridEl.appendChild(div);
    });
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { calendarGridEl.appendChild(document.createElement('div')); }
    const todayStr = formatDateForInput(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div'); div.className = 'day';
        const d = new Date(selectedYear, selectedMonth, day); const key = formatDateForInput(d);
        if (key === todayStr) div.classList.add('today');
        if (key === activeViewDate) div.style.backgroundColor = '#f1f5f9';
        const dayLogs = historyData[key] || [];
        if (dayLogs.length > 0) {
            const hasFail = dayLogs.some(l => l.type === 'fail');
            div.style.background = hasFail ? '#fee2e2' : '#e0f2fe';
        }
        const span = document.createElement('span'); span.textContent = day; div.appendChild(span);
        div.addEventListener('click', () => { activeViewDate = key; inputDate.value = key; renderAll(); });
        calendarGridEl.appendChild(div);
    }
}

async function syncDataOnLogin() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            historyData = { ...docSnap.data().history, ...historyData };
        }
        saveLocal();
    } catch (err) { console.error("Sync fetch error", err); }
}

async function syncToFirestore() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), { history: historyData, updatedAt: Date.now() }, { merge: true });
    } catch (err) { console.error("Cloud save error", err); }
}

function saveLocal() { localStorage.setItem('onesho-v3-history', JSON.stringify(historyData)); }

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

function setToggleValue(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === value);
    });
}

function getActiveToggleValue(groupId) {
    const activeBtn = document.querySelector(`#${groupId} .toggle-btn.active`);
    return activeBtn ? activeBtn.getAttribute('data-value') : null;
}

document.getElementById('prev-month').addEventListener('click', () => { selectedMonth--; if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; } renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { selectedMonth++; if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; } renderCalendar(); });

btnLogin.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => { console.error("Login fail", err); });
});

btnGuest.addEventListener('click', () => {
    loginOverlay.style.display = 'none'; appContent.style.display = 'flex'; userInfoEl.textContent = "ゲストモード"; init();
});

window.generateReport = () => {
    const reportModal = document.getElementById('report-modal');
    const reportBody = document.getElementById('report-body');
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let totalSuccess = 0, totalFail = 0, withUrge = 0, withoutUrge = 0;
    const dailyLogs = [];

    // Data aggregation for last 30 days
    Object.keys(historyData).sort().reverse().forEach(key => {
        const date = new Date(key);
        if (date >= thirtyDaysAgo) {
            const logs = historyData[key];
            logs.forEach(l => {
                if (l.type === 'success') totalSuccess++;
                else if (l.type === 'fail') totalFail++;

                if (l.urge === 'yes') withUrge++;
                else if (l.urge === 'no') withoutUrge++;

                dailyLogs.push({ date: key, ...l });
            });
        }
    });

    const total = totalSuccess + totalFail;
    const successRate = total > 0 ? Math.round((totalSuccess / total) * 100) : 0;
    const urgeRate = total > 0 ? Math.round((withUrge / total) * 100) : 0;

    reportBody.innerHTML = `
        <div class="report-section">
            <h4>📊 直近30日のまとめ</h4>
            <div class="summary-grid">
                <div class="summary-item"><span class="summary-val">${successRate}%</span><span class="summary-label">トイレ成功率</span></div>
                <div class="summary-item"><span class="summary-val">${urgeRate}%</span><span class="summary-label">尿意の自覚率</span></div>
                <div class="summary-item"><span class="summary-val">${totalSuccess}回</span><span class="summary-label">成功回数</span></div>
                <div class="summary-item"><span class="summary-val">${totalFail}回</span><span class="summary-label">おもらし回数</span></div>
            </div>
        </div>
        <div class="report-section">
            <h4>📝 記録詳細 (最新順)</h4>
            <table class="report-table">
                <thead>
                    <tr><th>日付</th><th>時刻</th><th>結果</th><th>尿意</th></tr>
                </thead>
                <tbody>
                    ${dailyLogs.sort((a, b) => b.timestamp - a.timestamp).map(l => `
                        <tr>
                            <td>${l.date.split('-').slice(1).join('/')}</td>
                            <td>${l.time}</td>
                            <td>${l.type === 'success' ? '☀️' : '🌧️'}</td>
                            <td>${l.urge === 'yes' ? 'あり' : 'なし'}</td>
                        </tr>
                    `).join('')}
                    ${dailyLogs.length === 0 ? '<tr><td colspan="4">期間内の記録がありません</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;

    reportModal.style.display = 'flex';
};

window.closeReport = () => {
    document.getElementById('report-modal').style.display = 'none';
};

window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => console.log('SW Registered'));
    }
});

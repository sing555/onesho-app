const successCountEl = document.getElementById('success-count');
const calendarTitleEl = document.getElementById('calendar-title');
const calendarGridEl = document.getElementById('calendar-grid');
const logListEl = document.getElementById('log-list');

const inputTime = document.getElementById('input-time');
const inputComment = document.getElementById('input-comment');
const btnSave = document.getElementById('btn-save');

let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();

// データ形式: historyData['YYYY-MM-DD'] = [ { time, type, amount, comment }, ... ]
let historyData = JSON.parse(localStorage.getItem('onesho-v2-history') || '{}');

function init() {
    setDefaultTime();
    setupToggles();
    renderCalendar();
    updateStats();
    renderLog();
}

function setDefaultTime() {
    const now = new Date();
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

btnSave.addEventListener('click', () => {
    const time = inputTime.value;
    const type = getActiveToggleValue('status-toggle');
    const amount = getActiveToggleValue('amount-toggle');
    const comment = inputComment.value;

    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    if (!historyData[key]) historyData[key] = [];

    const entry = { time, type, amount, comment, timestamp: Date.now() };
    historyData[key].push(entry);

    // 時間順にソート
    historyData[key].sort((a, b) => a.time.localeCompare(b.time));

    localStorage.setItem('onesho-v2-history', JSON.stringify(historyData));

    if (type === 'success') launchConfetti();

    inputComment.value = '';
    renderLog();
    renderCalendar();
    updateStats();
});

function launchConfetti() {
    confetti({
        particleCount: 100, spread: 70, origin: { y: 0.6 },
        colors: ['#72c6ef', '#ffd93d', '#ff8b8b', '#ffffff']
    });
}

function updateStats() {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${now.getMonth() + 1}-`;
    let count = 0;

    Object.keys(historyData).forEach(key => {
        if (key.startsWith(monthPrefix)) {
            count += historyData[key].filter(e => e.type === 'success').length;
        }
    });
    successCountEl.textContent = count;
}

function renderLog() {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const logs = historyData[key] || [];

    logListEl.innerHTML = logs.length ? '' : '<p style="color:#cfd8dc; font-size:0.9rem;">まだ きろくが ありません</p>';

    logs.forEach((log, index) => {
        const div = document.createElement('div');
        div.className = 'log-item animate-pop';

        const amountJp = { small: 'すくない', medium: 'ふつう', large: 'おおい' }[log.amount];
        const icon = log.type === 'success' ? '☀️' : '☁️';
        const statusText = log.type === 'success' ? '成功！' : 'もれた';

        div.innerHTML = `
            <div class="log-time">${log.time}</div>
            <div class="log-icon">${icon}</div>
            <div class="log-content">
                <div class="log-details">${statusText} / ${amountJp}</div>
                ${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}
            </div>
            <button onclick="deleteLog('${key}', ${index})" style="background:none; border:none; color:#ff8b8b; font-size:0.8rem; cursor:pointer;">削除</button>
        `;
        logListEl.appendChild(div);
    });
}

window.deleteLog = function (key, index) {
    if (confirm('このきろくを けしても いい？')) {
        historyData[key].splice(index, 1);
        if (historyData[key].length === 0) delete historyData[key];
        localStorage.setItem('onesho-v2-history', JSON.stringify(historyData));
        renderLog();
        renderCalendar();
        updateStats();
    }
};

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

    for (let i = 0; i < firstDay; i++) {
        calendarGridEl.appendChild(document.createElement('div'));
    }

    const todayStr = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;

    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'day';
        const key = `${selectedYear}-${selectedMonth + 1}-${day}`;

        if (key === todayStr) div.classList.add('today');

        const dayLogs = historyData[key] || [];
        if (dayLogs.length > 0) {
            const hasSuccess = dayLogs.some(l => l.type === 'success');
            const hasFail = dayLogs.some(l => l.type === 'fail');

            if (hasSuccess && !hasFail) div.classList.add('success');
            else if (hasFail && !hasSuccess) div.classList.add('fail');
            else if (hasSuccess && hasFail) {
                div.style.background = 'linear-gradient(135deg, #e1f5fe 50%, #fff9c4 50%)';
            }
        }

        const span = document.createElement('span');
        span.textContent = day;
        div.appendChild(span);
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

init();

// App Version: 1.0.2
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
let activeViewDate = formatDateForInput(new Date()); // 表示・記録対象の日付

// データ形式: historyData['YYYY-MM-DD'] = [ { time, type, amount, comment, urge, timestamp }, ... ]
let historyData = JSON.parse(localStorage.getItem('onesho-v3-history') || '{}');

function init() {
    setDefaultDateTime();
    setupToggles();
    renderCalendar();
    updateStats();
    renderLog();
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

btnSave.addEventListener('click', () => {
    const dateStr = inputDate.value; // YYYY-MM-DD
    const time = inputTime.value;
    const type = getActiveToggleValue('status-toggle');
    const amount = getActiveToggleValue('amount-toggle');
    const urge = getActiveToggleValue('urge-toggle');
    const comment = inputComment.value;

    if (!dateStr) {
        alert('ひにちを いれてね！');
        return;
    }

    if (!historyData[dateStr]) historyData[dateStr] = [];

    const entry = { time, type, amount, urge, comment, timestamp: Date.now() };
    historyData[dateStr].push(entry);

    // 時間順にソート
    historyData[dateStr].sort((a, b) => a.time.localeCompare(b.time));

    localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));

    if (type === 'success') launchConfetti();

    inputComment.value = '';
    activeViewDate = dateStr; // 記録した日のログを表示
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
        const icon = log.type === 'success' ? '☀️' : '☁️';
        const statusText = log.type === 'success' ? '成功！' : 'もれた';

        div.innerHTML = `
            <div class="log-time">${log.time}</div>
            <div class="log-icon">${icon}</div>
            <div class="log-content">
                <div class="log-details">${statusText} / ${amountJp} / ${urgeJp}</div>
                ${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}
            </div>
            <button onclick="deleteLog('${activeViewDate}', ${index})" style="background:none; border:none; color:#ff8b8b; font-size:0.8rem; cursor:pointer;">削除</button>
        `;
        logListEl.appendChild(div);
    });
}

window.deleteLog = function (key, index) {
    if (confirm('このきろくを けしても いい？')) {
        historyData[key].splice(index, 1);
        if (historyData[key].length === 0) delete historyData[key];
        localStorage.setItem('onesho-v3-history', JSON.stringify(historyData));
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

            if (hasSuccess && !hasFail) div.style.background = '#e1f5fe'; // 成功のみ
            else if (hasFail && !hasSuccess) div.style.background = '#fff9c4'; // 失敗のみ
            else if (hasSuccess && hasFail) {
                div.style.background = 'linear-gradient(135deg, #e1f5fe 50%, #fff9c4 50%)';
            }
        }

        const span = document.createElement('span');
        span.textContent = day;
        div.appendChild(span);

        div.addEventListener('click', () => {
            activeViewDate = key;
            inputDate.value = key;
            renderLog();
            renderCalendar();
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

init();

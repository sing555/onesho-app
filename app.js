const todayDateEl = document.getElementById('today-date');
const successCountEl = document.getElementById('success-count');
const calendarTitleEl = document.getElementById('calendar-title');
const calendarGridEl = document.getElementById('calendar-grid');
const btnSuccess = document.getElementById('btn-success');
const btnFail = document.getElementById('btn-fail');

let currentDate = new Date();
let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();

// データ構造: key = 'YYYY-MM-DD', value = 'success' | 'fail'
let historyData = JSON.parse(localStorage.getItem('onesho-history') || '{}');

function init() {
    updateTodayDate();
    renderCalendar();
    updateStats();
}

function updateTodayDate() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    todayDateEl.textContent = now.toLocaleDateString('ja-JP', options);
}

function saveResult(type) {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    historyData[key] = type;
    localStorage.setItem('onesho-history', JSON.stringify(historyData));
    
    if (type === 'success') {
        launchConfetti();
    }
    
    renderCalendar();
    updateStats();
}

function launchConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#72c6ef', '#ffd93d', '#ff8b8b', '#ffffff']
    });
}

function updateStats() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}-`;
    const count = Object.keys(historyData).filter(key => key.startsWith(monthKey) && historyData[key] === 'success').length;
    successCountEl.textContent = count;
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

    // 空白埋め
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        calendarGridEl.appendChild(div);
    }

    const todayStr = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;

    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'day';
        const key = `${selectedYear}-${selectedMonth + 1}-${day}`;
        
        if (key === todayStr) {
            div.classList.add('today');
        }

        if (historyData[key]) {
            div.classList.add(historyData[key] === 'success' ? 'success' : 'fail');
        }

        const span = document.createElement('span');
        span.textContent = day;
        div.appendChild(span);
        calendarGridEl.appendChild(div);
    }
}

btnSuccess.addEventListener('click', () => saveResult('success'));
btnFail.addEventListener('click', () => saveResult('fail'));

document.getElementById('prev-month').addEventListener('click', () => {
    selectedMonth--;
    if (selectedMonth < 0) {
        selectedMonth = 11;
        selectedYear--;
    }
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    selectedMonth++;
    if (selectedMonth > 11) {
        selectedMonth = 0;
        selectedYear++;
    }
    renderCalendar();
});

init();

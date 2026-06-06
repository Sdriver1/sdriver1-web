let spots  = JSON.parse(localStorage.getItem('shiftSpots')  || '[]');
let config = JSON.parse(localStorage.getItem('shiftConfig') || '{"start":"","end":""}');

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#dc2626', '#2563eb',
];
// Color index only advances for non-break spots
let colorIdx = spots.filter(s => !s.isBreak).length % COLORS.length;
let cachedSchedule = [];

function save() {
  localStorage.setItem('shiftSpots',  JSON.stringify(spots));
  localStorage.setItem('shiftConfig', JSON.stringify(config));
}

function nextColor() { return COLORS[(colorIdx++) % COLORS.length]; }

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToStr(min) {
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtMin(m) {
  if (!m || m <= 0) return '';
  const h = Math.floor(m / 60), min = m % 60;
  if (h && min) return `${h}h ${min}m`;
  return h ? `${h}h` : `${min}m`;
}

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function nowSec() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

// ── Schedule generation ──────────────────────────────────────────────────────
// Breaks are just spots with isBreak=true; the rotation repeats the full
// pattern (including break slices) until the shift ends.

function generateSchedule() {
  if (!spots.length || !config.start || !config.end) return [];
  const endMin = toMin(config.end);
  if (toMin(config.start) >= endMin) return [];

  const schedule = [];
  let t = toMin(config.start);
  let rotNum = 1;

  while (t < endMin) {
    const rotStart = t;
    const rotSpots = [];

    for (const spot of spots) {
      if (t >= endMin) break;
      const sEnd = Math.min(t + spot.duration, endMin);
      rotSpots.push({
        isBreak: !!spot.isBreak,
        name: spot.name,
        color: spot.isBreak ? 'var(--break-border)' : spot.color,
        startMin: t,
        endMin: sEnd,
        rotationNum: rotNum,
      });
      t = sEnd;
    }

    if (!rotSpots.length) break;

    schedule.push({ type: 'rotation', num: rotNum, startMin: rotStart, endMin: t, spots: rotSpots });
    rotNum++;
  }

  return schedule;
}

// All time slices in order (breaks + spots are both inside rotations now)
function flatBlocks(schedule) {
  const out = [];
  for (const rot of schedule) out.push(...rot.spots);
  return out;
}

// ── Render builder spots list ────────────────────────────────────────────────

function renderSpots() {
  const list     = document.getElementById('spotsList');
  const summary  = document.getElementById('rotationSummary');
  const clearBtn = document.getElementById('clearSpots');

  if (!spots.length) {
    list.innerHTML = '<div class="spots-empty">No spots added yet.</div>';
    summary.innerHTML = '';
    clearBtn.style.display = 'none';
    return;
  }

  clearBtn.style.display = '';
  list.innerHTML = '';

  spots.forEach((spot, idx) => {
    const dotColor = spot.isBreak ? '#f59e0b' : spot.color;
    const row = document.createElement('div');
    row.className = `spot-row${spot.isBreak ? ' is-break' : ''}`;
    row.innerHTML = `
      <div class="spot-color-dot" style="background:${dotColor}"></div>
      <div class="spot-row-info">
        <span class="spot-row-name">${spot.isBreak ? '☕ ' : ''}${spot.name}</span>
        <span class="spot-row-dur">${spot.duration} min</span>
      </div>
      <div class="spot-row-actions">
        <button class="spot-action-btn" data-action="up"   data-idx="${idx}" ${idx === 0                ? 'disabled' : ''}>▲</button>
        <button class="spot-action-btn" data-action="down" data-idx="${idx}" ${idx === spots.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="spot-action-btn spot-del" data-action="del" data-idx="${idx}">×</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.spot-action-btn').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.idx);
      if      (btn.dataset.action === 'up'   && i > 0)                [spots[i - 1], spots[i]] = [spots[i], spots[i - 1]];
      else if (btn.dataset.action === 'down' && i < spots.length - 1) [spots[i], spots[i + 1]] = [spots[i + 1], spots[i]];
      else if (btn.dataset.action === 'del')                           spots.splice(i, 1);
      save();
      renderAll();
    };
  });

  const total = spots.reduce((s, sp) => s + sp.duration, 0);
  const parts = spots.map(s => {
    const c = s.isBreak ? '#f59e0b' : s.color;
    return `<span style="color:${c};font-weight:500">${s.duration}m</span>`;
  }).join(' + ');
  summary.innerHTML = `${parts} = <strong>${total} min per cycle</strong>`;
}

// ── Render schedule timeline ─────────────────────────────────────────────────

function renderSchedule(schedule) {
  const output = document.getElementById('scheduleOutput');
  const empty  = document.getElementById('scheduleEmpty');
  const meta   = document.getElementById('scheduleMeta');

  if (!schedule.length) {
    output.innerHTML = '';
    empty.style.display = '';
    meta.textContent = '';
    return;
  }

  empty.style.display = 'none';
  meta.textContent = `${schedule.length} rotation${schedule.length !== 1 ? 's' : ''} · ${fmt12(config.start)} – ${fmt12(config.end)}`;

  const curMin = nowMin();
  const curSec = nowSec();
  output.innerHTML = '';

  schedule.forEach(rot => {
    const isRotActive = curMin >= rot.startMin && curMin < rot.endMin;
    const isRotPast   = curMin >= rot.endMin;

    const el = document.createElement('div');
    el.className = `rot-block${isRotActive ? ' is-active-rot' : ''}${isRotPast ? ' is-past' : ''}`;
    el.innerHTML = `
      <div class="rot-header">
        <span class="rot-label">Rotation ${rot.num}</span>
        <span class="rot-time">${fmt12(minToStr(rot.startMin))} – ${fmt12(minToStr(rot.endMin))}</span>
      </div>
      <div class="rot-spots"></div>
    `;
    output.appendChild(el);

    const container = el.querySelector('.rot-spots');
    rot.spots.forEach(spot => {
      const isActive = curMin >= spot.startMin && curMin < spot.endMin;
      const isPast   = curMin >= spot.endMin;
      const durSec   = (spot.endMin - spot.startMin) * 60;
      const elapsed  = isActive ? curSec - spot.startMin * 60 : (isPast ? durSec : 0);
      const pct      = durSec > 0 ? Math.min(100, Math.max(0, (elapsed / durSec) * 100)) : 0;
      const dotColor = spot.isBreak ? '#f59e0b' : spot.color;
      const barColor = spot.isBreak ? '#f59e0b' : spot.color;
      const label    = spot.isBreak ? `☕ ${spot.name}` : spot.name;

      const spotEl = document.createElement('div');
      spotEl.className = [
        'spot-row-tl',
        spot.isBreak ? 'is-break' : '',
        isActive     ? 'is-active' : '',
        isPast       ? 'is-past'   : '',
      ].filter(Boolean).join(' ');

      spotEl.innerHTML = `
        <div class="spot-dot-tl" style="background:${dotColor}"></div>
        <div class="spot-name-tl">${label}</div>
        <div class="spot-time-tl">${fmt12(minToStr(spot.startMin))} – ${fmt12(minToStr(spot.endMin))}</div>
        <div class="spot-bar-wrap">
          <div class="spot-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      `;
      container.appendChild(spotEl);
    });
  });
}

// ── Live tracker ─────────────────────────────────────────────────────────────

function updateTracker(schedule) {
  const clockEl      = document.getElementById('trackerClock');
  const statusEl     = document.getElementById('trackerStatus');
  const detailEl     = document.getElementById('trackerDetail');
  const nextEl       = document.getElementById('trackerNext');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar  = document.getElementById('progressBar');
  const card         = document.getElementById('trackerCard');

  const now = new Date();
  clockEl.textContent = fmt12(minToStr(now.getHours() * 60 + now.getMinutes()));

  if (!schedule.length) {
    card.className = 'tracker-card';
    statusEl.textContent = 'No shift loaded';
    detailEl.textContent = 'Configure your shift below to get started';
    nextEl.textContent = '';
    progressWrap.style.display = 'none';
    return;
  }

  const curMin  = nowMin();
  const curSec  = nowSec();
  const blocks  = flatBlocks(schedule);
  const shiftStart = blocks[0].startMin;
  const shiftEnd   = blocks[blocks.length - 1].endMin;
  const totalRot   = schedule.length;

  if (curMin < shiftStart) {
    card.className = 'tracker-card';
    statusEl.textContent = `Shift starts at ${fmt12(config.start)}`;
    detailEl.textContent = `In ${fmtMin(shiftStart - curMin)} · First: ${blocks[0].name}`;
    nextEl.textContent = '';
    progressWrap.style.display = 'none';
    return;
  }

  if (curMin >= shiftEnd) {
    card.className = 'tracker-card';
    statusEl.textContent = 'Shift complete';
    detailEl.textContent = `Ended at ${fmt12(config.end)}`;
    nextEl.textContent = '';
    progressWrap.style.display = 'none';
    return;
  }

  let activeIdx = -1;
  const active = blocks.find((b, i) => {
    if (curMin >= b.startMin && curMin < b.endMin) { activeIdx = i; return true; }
    return false;
  });

  if (!active) {
    card.className = 'tracker-card';
    statusEl.textContent = 'Between blocks';
    detailEl.textContent = '';
    nextEl.textContent = '';
    progressWrap.style.display = 'none';
    return;
  }

  const durSec     = (active.endMin - active.startMin) * 60;
  const elapsedSec = curSec - active.startMin * 60;
  const remMin     = active.endMin - curMin;
  const pct        = durSec > 0 ? Math.min(100, Math.max(0, (elapsedSec / durSec) * 100)) : 0;
  const remLabel   = remMin <= 1 ? 'ending soon' : `${remMin} min remaining`;

  progressWrap.style.display = '';
  progressBar.style.width = pct + '%';

  const nextBlock = activeIdx < blocks.length - 1 ? blocks[activeIdx + 1] : null;

  if (active.isBreak) {
    card.className = 'tracker-card on-break';
    statusEl.textContent = `☕ ${active.name}`;
    detailEl.textContent = `${fmt12(minToStr(active.startMin))} – ${fmt12(minToStr(active.endMin))} · ${remLabel}`;
    progressBar.style.background = '#f59e0b';

    // Find next non-break spot so the user knows where they're headed
    const nextWork = blocks.slice(activeIdx + 1).find(b => !b.isBreak);
    if (nextWork) {
      nextEl.innerHTML = `Next up: <strong>${nextWork.name}</strong> at ${fmt12(minToStr(nextWork.startMin))} · Rotation ${nextWork.rotationNum}`;
    } else if (nextBlock) {
      nextEl.innerHTML = `Next: <strong>☕ ${nextBlock.name}</strong> at ${fmt12(minToStr(nextBlock.startMin))}`;
    } else {
      nextEl.textContent = '';
    }
  } else {
    card.className = 'tracker-card active-shift';
    statusEl.textContent = active.name;
    detailEl.textContent = `Rotation ${active.rotationNum} of ${totalRot} · ${fmt12(minToStr(active.startMin))} – ${fmt12(minToStr(active.endMin))} · ${remLabel}`;
    progressBar.style.background = active.color;

    if (nextBlock) {
      nextEl.innerHTML = nextBlock.isBreak
        ? `Break at <strong>${fmt12(minToStr(nextBlock.startMin))}</strong> · ${fmtMin(nextBlock.endMin - nextBlock.startMin)}`
        : `Next: <strong>${nextBlock.name}</strong> at ${fmt12(minToStr(nextBlock.startMin))}`;
    } else {
      nextEl.textContent = 'Last spot of your shift';
    }
  }
}

// ── Wire up ──────────────────────────────────────────────────────────────────

function renderAll() {
  cachedSchedule = generateSchedule();
  renderSpots();
  renderSchedule(cachedSchedule);
  updateTracker(cachedSchedule);
}

document.getElementById('addSpotForm').onsubmit = function (e) {
  e.preventDefault();
  const name     = document.getElementById('spotName').value.trim();
  const duration = parseInt(document.getElementById('spotDuration').value);
  const isBreak  = document.getElementById('spotIsBreak').checked;
  if (!name || !duration || duration < 1) return;

  spots.push({
    id: Date.now().toString(),
    name,
    duration,
    isBreak,
    color: isBreak ? '#f59e0b' : nextColor(),
  });
  save();
  renderAll();

  document.getElementById('spotName').value = '';
  document.getElementById('spotDuration').value = '';
  document.getElementById('spotIsBreak').checked = false;
  document.getElementById('spotName').focus();
};

document.getElementById('shiftStart').addEventListener('change', function () {
  config.start = this.value; save(); renderAll();
});
document.getElementById('shiftEnd').addEventListener('change', function () {
  config.end = this.value; save(); renderAll();
});

document.getElementById('clearSpots').onclick = function () {
  if (confirm('Remove all spots and clear the schedule?')) {
    spots = []; colorIdx = 0; save(); renderAll();
  }
};

// ── Theme (matches main site) ─────────────────────────────────────────────────

const svgSun  = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2"  x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4"  y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>`;
const svgMoon = `<svg viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" fill="currentColor"/></svg>`;

function setThemeIcon(theme) {
  const span = document.getElementById('theme-icon');
  if (span) span.innerHTML = theme === 'dark' ? svgSun : svgMoon;
}

function updateFooterIcons(theme) {
  const isDark = theme === 'dark';
  const base   = '../assets/svg/';
  const email  = document.getElementById('icon-email');
  const github = document.getElementById('icon-github');
  const x      = document.getElementById('icon-x');
  if (email)  email.src  = base + (isDark ? 'email-darkmode.svg'  : 'email-lightmode.svg');
  if (github) github.src = base + (isDark ? 'github-darkmode.svg' : 'github-lightmode.svg');
  if (x)      x.src      = base + (isDark ? 'x-darkmode.svg'      : 'x-lightmode.svg');
}

function setupTheme() {
  const toggle = document.getElementById('theme-toggle');
  const mq     = window.matchMedia('(prefers-color-scheme: dark)');
  const stored = localStorage.getItem('theme');
  let theme    = stored || (mq.matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  setThemeIcon(theme);
  updateFooterIcons(theme);
  toggle.addEventListener('click', () => {
    theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    setThemeIcon(theme);
    updateFooterIcons(theme);
  });
}

setupTheme();

// Init
document.getElementById('shiftStart').value = config.start || '';
document.getElementById('shiftEnd').value   = config.end   || '';

renderAll();

setInterval(() => {
  updateTracker(cachedSchedule);
  if (new Date().getSeconds() === 0) renderSchedule(cachedSchedule);
}, 1000);

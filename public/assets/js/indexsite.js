// --- Typewriter Animation ---
const primaryText = "Welcome, I'm Steven Driver";
const subtitleText = "Better known as Sdriver1";
const speed = 120;
let idx = 0;

function typePrimary() {
  if (idx < primaryText.length) {
    document.getElementById("typewriter").textContent += primaryText[idx++];
    setTimeout(typePrimary, speed);
  } else {
    document.getElementById("cursor-primary").style.display = "none";
    idx = 0;
    setTimeout(typeSubtitle, 500);
  }
}

function typeSubtitle() {
  if (idx < subtitleText.length) {
    document.getElementById("subtitle").textContent += subtitleText[idx++];
    setTimeout(typeSubtitle, speed);
  } else {
    document.getElementById("cursor-sub").style.display = "none";
  }
}

// --- Theme Toggle ---
function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  const stored = localStorage.getItem("theme");
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  let theme = stored || (mq.matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  toggle.textContent = theme === "dark" ? "☀️" : "🌙";
  toggle.addEventListener("click", () => {
    theme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    toggle.textContent = theme === "dark" ? "☀️" : "🌙";
  });
}

// --- Smooth Scroll & Mobile Nav ---
function setupNavigation() {
  document.getElementById("mobile-toggle").addEventListener("click", () => {
    document.getElementById("nav-links").classList.toggle("open");
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth" });
      document.getElementById("nav-links").classList.remove("open");
    });
  });
}

// --- Dynamic Age Calculation ---
function updateAge() {
  function calculateAge(birth) {
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }
  const birthDate = new Date("2007-08-04");
  const el = document.getElementById("age");
  if (el) el.textContent = calculateAge(birthDate);
}

// --- Fetch and Update Stats ---
function fetchStats() {
  fetch("https://api.pridebot.xyz/stats")
    .then((res) => res.json())
    .then((data) => {
      const serverEl = document.getElementById("server-count");
      const userEl = document.getElementById("user-count");
      if (serverEl)
        serverEl.textContent =
          data.currentGuildCount >= 1000
            ? (data.currentGuildCount / 1000).toFixed(1) + "k+"
            : data.currentGuildCount;
      if (userEl)
        userEl.textContent =
          data.totalUserCount >= 1000
            ? (data.totalUserCount / 1000).toFixed(1) + "k+"
            : data.totalUserCount;
    })
    .catch((err) => console.error("Stats fetch error:", err));
}

// --- Fetch and Update Discord Status ---
function fetchDiscordStatus() {
  fetch("https://sbot1.api.sdriver1.me/status")
    .then((res) => res.json())
    .then((data) => {
      const statusEl = document.getElementById("discord-status");
      if (!statusEl) return;
      const statusVisualMap = {
        online: {
          svg: `<svg width="30" height="30" viewBox="5 3 20 33" fill="none" style="vertical-align:middle;margin-right:0.3em;"><path d="M25.3932 16.8283C25.3932 22.1303 21.0951 26.4283 15.7932 26.4283C10.4912 26.4283 6.19316 22.1303 6.19316 16.8283C6.19316 11.5264 10.4912 7.22833 15.7932 7.22833C21.0951 7.22833 25.3932 11.5264 25.3932 16.8283Z" fill="#23A55A"/></svg>`,
          label: "Online",
        },
        idle: {
          svg: `<svg width="30" height="30" viewBox="5 3 20 33" fill="none" style="vertical-align:middle;margin-right:0.3em;"><path fill-rule="evenodd" clip-rule="evenodd" d="M16.1174 26.2872C21.4244 26.2872 25.7265 21.985 25.7265 16.6781C25.7265 11.9854 22.3628 8.07843 17.9149 7.23679C17.4878 7.15596 17.2249 7.67232 17.4658 8.03416C18.2265 9.17648 18.6699 10.5483 18.6699 12.0236C18.6699 16.0039 15.4433 19.2305 11.463 19.2305C9.98768 19.2305 8.61587 18.7871 7.47355 18.0264C7.11171 17.7855 6.59535 18.0484 6.67618 18.4755C7.51783 22.9234 11.4248 26.2872 16.1174 26.2872Z" fill="#F0B232"/></svg>`,
          label: "Idle",
        },
        dnd: {
          svg: `<svg width="30" height="30" viewBox="5 3 20 33" fill="none" style="vertical-align:middle;margin-right:0.3em;"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.7931 26.4283C21.0951 26.4283 25.3931 22.1303 25.3931 16.8283C25.3931 11.5264 21.0951 7.22833 15.7931 7.22833C10.4912 7.22833 6.19315 11.5264 6.19315 16.8283C6.19315 22.1303 10.4912 26.4283 15.7931 26.4283ZM12.1008 14.6129C10.8773 14.6129 9.88545 15.6048 9.88545 16.8283C9.88545 18.0519 10.8773 19.0437 12.1008 19.0437H19.4855C20.709 19.0437 21.7008 18.0519 21.7008 16.8283C21.7008 15.6048 20.709 14.6129 19.4855 14.6129H12.1008Z" fill="#F23F43"/></svg>`,
          label: "Do Not Disturb",
        },
        offline: {
          svg: `<svg width="30" height="30" viewBox="5 3 20 33" fill="none" style="vertical-align:middle;margin-right:0.3em;"><path fill-rule="evenodd" clip-rule="evenodd" d="M16.2678 26.4283C21.5697 26.4283 25.8678 22.1303 25.8678 16.8283C25.8678 11.5264 21.5697 7.22833 16.2678 7.22833C10.9658 7.22833 6.66776 11.5264 6.66776 16.8283C6.66776 22.1303 10.9658 26.4283 16.2678 26.4283ZM16.2678 12.3976C13.8207 12.3976 11.837 14.3813 11.837 16.8283C11.837 19.2754 13.8207 21.2591 16.2678 21.2591C18.7148 21.2591 20.6985 19.2754 20.6985 16.8283C20.6985 14.3813 18.7148 12.3976 16.2678 12.3976Z" fill="#80848E"/></svg>`,
          label: "Offline",
        },
      };
      // (SVGs omitted here for brevity, use your originals)
      const visual = statusVisualMap[data.status];
      if (visual) statusEl.innerHTML = `${visual.svg}${visual.label}`;
      else statusEl.textContent = data.status || "Unavailable";
    })
    .catch(() => {
      const statusEl = document.getElementById("discord-status");
      if (statusEl) statusEl.textContent = "Unavailable";
    });
}

// --- Activity Fetch & Dynamic Updater ---
const activityIcons = {
  coding: `<svg width="25" height="25" viewBox="0 0 32 32" fill="none" style="vertical-align:middle;"><path d="M20.6875 5.20021C20.3749 4.88428 19.8647 4.88372 19.5514 5.19895L18.5194 6.23728C18.2098 6.54885 18.2093 7.05183 18.5183 7.36402L26.5096 15.4373C26.8183 15.749 26.8183 16.2511 26.5096 16.5628L18.5183 24.6361C18.2093 24.9484 18.2098 25.4513 18.5194 25.7628L19.5514 26.8012C19.8647 27.1164 20.3749 27.1159 20.6875 26.7999L30.8167 16.5628C31.1251 16.251 31.1251 15.7491 30.8167 15.4374L20.6875 5.20021Z" fill="#C7C8CE"/><path d="M13.4819 7.36402C13.7909 7.05183 13.7904 6.54885 13.4807 6.23728L12.4488 5.19895C12.1355 4.88372 11.6252 4.88428 11.3127 5.20021L1.18347 15.4374C0.87504 15.7491 0.875042 16.251 1.18347 16.5628L11.3127 26.7999C11.6252 27.1159 12.1354 27.1164 12.4488 26.8012L13.4807 25.7628C13.7904 25.4513 13.7909 24.9484 13.4819 24.6361L5.49048 16.5628C5.1819 16.2511 5.1819 15.749 5.49048 15.4373L13.4819 7.36402Z" fill="#C7C8CE"/></svg>`,
  "listening to music": `<svg width="25" height="25" viewBox="0 0 32 32" fill="none" style="vertical-align:middle;"><path d="M16 2.66663C8.63622 2.66663 2.66669 8.63616 2.66669 16C2.66669 23.3637 8.63622 29.3333 16 29.3333C23.3638 29.3333 29.3334 23.3637 29.3334 16C29.3334 12.4637 27.9286 9.07236 25.4282 6.57187C22.9276 4.07139 19.5363 2.66663 16 2.66663ZM22.0834 21.9166C21.8388 22.2881 21.3527 22.4142 20.9584 22.2082C17.8334 20.2917 13.875 19.8749 9.25002 20.9166C8.95974 20.9836 8.65578 20.8906 8.45262 20.6728C8.24947 20.4549 8.17799 20.1452 8.26513 19.8602C8.35225 19.5754 8.58474 19.3586 8.87502 19.2917C13.9584 18.125 18.2918 18.625 21.8334 20.7917C22.0199 20.9041 22.1522 21.088 22.1994 21.3006C22.2467 21.5132 22.2047 21.7358 22.0834 21.9166ZM23.75 18.25C23.6071 18.4829 23.3771 18.6492 23.1111 18.7117C22.8451 18.7742 22.5651 18.7281 22.3334 18.5833C18.75 16.3749 13.2917 15.75 9.04169 17.0416C8.68442 17.1458 8.2987 17.0516 8.02983 16.7942C7.76095 16.5369 7.64977 16.1557 7.73817 15.7942C7.82655 15.4328 8.10109 15.1458 8.45835 15.0416C13.2917 13.5833 19.3334 14.2917 23.4167 16.8333C23.8846 17.1433 24.0306 17.7638 23.75 18.25ZM23.875 14.5C19.5834 11.9583 12.5 11.7083 8.37502 12.9583C7.7559 13.0571 7.15938 12.682 6.98019 12.0812C6.80101 11.4804 7.09459 10.8398 7.66669 10.5833C12.375 9.16663 20.2083 9.41663 25.1667 12.375C25.4524 12.5427 25.6579 12.8191 25.7364 13.141C25.815 13.4629 25.7598 13.8028 25.5834 14.0833C25.2072 14.6429 24.4666 14.8236 23.875 14.5Z" fill="#1ED760"/></svg>`,
  playing: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2" stroke="#f59e42" stroke-width="2"/><circle cx="8" cy="12" r="2" stroke="#f59e42" stroke-width="2"/><circle cx="16" cy="12" r="2" stroke="#f59e42" stroke-width="2"/></svg>`,
};

let lastActivityHtml = "";

function renderActivities(data) {
  const acts = (data.activities || [])
    .map((a) => {
      if (a.name === "Spotify" && a.details && a.state) {
        return `<div class="activity-item">${activityIcons["listening to music"]}<span>Listening to: ${a.details} by ${a.state}</span></div>`;
      }
      if (a.name === "Visual Studio Code" && a.details) {
        let file = a.details.replace(/^Editing\s+/, "");
        let workspace =
          a.state && a.state.startsWith("Workspace: ")
            ? a.state.replace("Workspace: ", "")
            : "";
        return `<div class="activity-item">${
          activityIcons.coding
        }<span>Coding: ${file}${
          workspace ? " in " + workspace : ""
        }</span></div>`;
      }
      if (a.type === 0 && a.name && a.name !== "Visual Studio Code") {
        return `<div class="activity-item">${activityIcons.playing}<span>Playing: ${a.name}</span></div>`;
      }
      return null;
    })
    .filter(Boolean);

  return acts.join("");
}

function updateActivities() {
  fetch("https://sbot1.api.sdriver1.me/rich-current")
    .then((res) => res.json())
    .then((data) => {
      const doingCard = document.getElementById("doing-card");
      const activityEl = document.getElementById("discord-activity");
      const aboutGrid = document.querySelector(".about-grid");
      if (!doingCard || !activityEl || !aboutGrid) return;

      const html = renderActivities(data);
      if (html && html.trim() !== "") {
        activityEl.innerHTML = html;
        doingCard.style.display = "block";
        aboutGrid.style.width = "67%";
        doingCard.style.width = "33%";
      } else {
        activityEl.innerHTML = "";
        doingCard.style.display = "none";
        aboutGrid.style.width = "100%";
      }
      lastActivityHtml = html;
    })
    .catch(() => {
      const doingCard = document.getElementById("doing-card");
      const activityEl = document.getElementById("discord-activity");
      const aboutGrid = document.querySelector(".about-grid");
      if (activityEl) activityEl.innerHTML = "";
      if (doingCard) doingCard.style.display = "none";
      if (aboutGrid) aboutGrid.style.width = "100%";
      lastActivityHtml = "";
    });
}

// --- Contact Form Handler ---
function setupContactForm() {
  const form = document.querySelector(".contact-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: form.name.value,
      email: form.email.value,
      message: form.message.value,
    };
    const url = form.getAttribute("action") || "/api/contact";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        alert("Message sent successfully!");
        form.reset();
      } else {
        throw new Error("Server responded with " + res.status);
      }
    } catch (err) {
      alert("Error sending message. Please check console and try again.");
    }
  });
}

function setupTimelineToggle() {
  const btns = document.querySelectorAll(".toggle-btn");
  const groups = document.querySelectorAll(".timeline-group");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const type = btn.getAttribute("data-type");
      groups.forEach((group) => {
        let showGroup = false;
        const items = group.querySelectorAll(".timeline-item");
        items.forEach((item) => {
          item.classList.remove("hide");
          if (type === "all") {
            if (item.classList.contains("irl")) {
              item.querySelector(".timeline-content").style.borderColor =
                "#58c990";
              item.querySelector(".timeline-content").style.boxShadow =
                "0 4px 16px #58c99026";
            } else if (item.classList.contains("discord")) {
              item.querySelector(".timeline-content").style.borderColor =
                "#6b7bfa";
              item.querySelector(".timeline-content").style.boxShadow =
                "0 4px 16px #6b7bfa26";
            }
            showGroup = true;
          } else if (type === "irl") {
            if (item.classList.contains("discord")) {
              item.classList.add("hide");
            } else {
              item.querySelector(".timeline-content").style.borderColor =
                "#58c990";
              item.querySelector(".timeline-content").style.boxShadow =
                "0 4px 16px #58c99026";
              showGroup = true;
            }
          } else if (type === "discord") {
            if (item.classList.contains("irl")) {
              item.classList.add("hide");
            } else {
              item.querySelector(".timeline-content").style.borderColor =
                "var(--primary)";
              item.querySelector(".timeline-content").style.boxShadow =
                "0 4px 16px #4f46e526";
              showGroup = true;
            }
          }
        });
        // Hide the group if all its items are hidden
        if (!showGroup) group.style.display = "none";
        else group.style.display = "";
      });
    });
  });
}

function handleTimelineScroll() {
  const items = document.querySelectorAll(".timeline-item");
  const windowHeight = window.innerHeight;
  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.top < windowHeight - 60) {
      item.classList.add("active");
    }
  });
}

function pluralize(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

function getMonthsBetween(start, end) {
  // start and end: JS Date objects
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let totalMonths = years * 12 + months;
  // If end day is before start day, subtract one month
  if (end.getDate() < start.getDate()) totalMonths--;
  return totalMonths;
}

function formatDuration(months) {
  if (months < 1) return "";
  if (months < 12) return `(${pluralize(months, "mo")})`;
  const years = Math.floor(months / 12);
  const mos = months % 12;
  if (mos === 0) return `(${pluralize(years, "yr")})`;
  return `(${pluralize(years, "yr")}, ${pluralize(mos, "mo")})`;
}

function updateJobDurations() {
  const jobs = document.querySelectorAll(".job-dates[data-start]");
  jobs.forEach((el) => {
    const startStr = el.getAttribute("data-start");
    const endStr = el.getAttribute("data-end");
    if (!startStr) return;
    const start = new Date(startStr);
    const end = endStr && endStr !== "" ? new Date(endStr) : new Date();
    const months = getMonthsBetween(start, end) + 1; // include current month
    const span = el.querySelector(".job-duration");
    if (span) span.textContent = formatDuration(months);
  });
}

// Run when DOM loads (after timeline code)
window.addEventListener("DOMContentLoaded", () => {
  updateJobDurations();
});
window.addEventListener("scroll", handleTimelineScroll);
window.addEventListener("DOMContentLoaded", () => {
  setupTimelineToggle();
  handleTimelineScroll();
});

window.addEventListener("DOMContentLoaded", () => {
  typePrimary();
  setupThemeToggle();
  setupNavigation();
  updateAge();
  fetchStats();
  fetchDiscordStatus();
  setupContactForm();
  updateActivities();
  setInterval(updateActivities, 10 * 1000);
});

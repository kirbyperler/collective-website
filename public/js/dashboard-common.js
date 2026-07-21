// Shared utilities used by both the admin and player dashboards.

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, function(character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[character];
  });
}

function showPage(pageName, options = {}) {
  document.querySelectorAll(".page").forEach(function(page) {
    page.classList.remove("active");
  });

  document.getElementById(`${pageName}Page`)?.classList.add("active");

  document.querySelectorAll(".side-link").forEach(function(link) {
    link.classList.toggle("active", link.dataset.page === pageName);
  });

  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) {
    topbarTitle.textContent = pageName.charAt(0).toUpperCase() + pageName.slice(1);
  }

  document.getElementById("sidebar")?.classList.remove("open");

  if (!options.skipHistory) {
    pushNavState({ page: pageName, modal: null }, { replace: Boolean(options.replaceHistory) });
  }
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
}

// --- Browser back/forward support -----------------------------------------
// Tracks which page/user/profile-panel/modal is showing in `?page=&user=&
// panel=&modal=` query params (hash is already used as a no-op anchor by the
// nav links, so query params avoid colliding with that). pushState/
// replaceState never reload the page; a `popstate` listener re-renders from
// in-memory data instead of re-fetching.
let navState = { page: null, user: null, panel: null, modal: null };

function readLocationNavState() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: params.get("page") || null,
    user: params.get("user") || null,
    panel: params.get("panel") || null,
    modal: params.get("modal") || null
  };
}

function buildNavUrl(state) {
  const params = new URLSearchParams();
  if (state.page) params.set("page", state.page);
  if (state.user) params.set("user", state.user);
  if (state.panel) params.set("panel", state.panel);
  if (state.modal) params.set("modal", state.modal);
  const query = params.toString();
  return query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

// Updates in-memory nav state only — used by an "inner" step of a compound
// action (e.g. selecting a user right before switching pages) so the final
// step's pushNavState commits one combined history entry instead of two.
function setNavState(patch) {
  navState = { ...navState, ...patch };
}

function pushNavState(patch, { replace = false } = {}) {
  navState = { ...navState, ...patch };
  history[replace ? "replaceState" : "pushState"]({ ...navState }, "", buildNavUrl(navState));
}

// Called once after each dashboard's initial data load. Restores whatever
// page/user/panel/modal the URL encodes (covers direct loads and refreshes),
// then listens for Back/Forward. `window.applyNavState`, implemented per
// dashboard (admin.js / player.js), knows how to re-render from state using
// data already in memory.
function initNavHistory() {
  const initial = readLocationNavState();
  navState = {
    page: initial.page || "overview",
    user: initial.user || null,
    panel: initial.panel || null,
    modal: initial.modal || null
  };
  history.replaceState({ ...navState }, "", buildNavUrl(navState));
  window.applyNavState?.(navState, { isInitial: true });

  window.addEventListener("popstate", function(event) {
    const state = event.state || readLocationNavState();
    navState = {
      page: state.page || "overview",
      user: state.user || null,
      panel: state.panel || null,
      modal: state.modal || null
    };
    window.applyNavState?.(navState, { isInitial: false });
  });
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map(function(part) {
      return part[0];
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Generic modal: relocates an existing (normally hidden) DOM node into the
// shared modal frame, then returns it to its original spot on close. This
// lets every "Edit"/"Upload"/"Manage" panel reuse one modal shell without
// duplicating any markup or breaking existing getElementById references.
function openModalWithNode(title, nodeId, options = {}) {
  const overlay = document.getElementById("modalOverlay");
  const titleEl = document.getElementById("modalTitle");
  const bodyEl = document.getElementById("modalBody");
  const panel = document.getElementById("modalPanel");
  const node = document.getElementById(nodeId);

  if (!overlay || !titleEl || !bodyEl || !node) return;

  if (!node.__modalHome) {
    node.__modalHome = { parent: node.parentElement, next: node.nextSibling };
  }

  bodyEl.innerHTML = "";
  bodyEl.appendChild(node);
  node.classList.remove("hidden");

  titleEl.textContent = title;
  panel?.classList.toggle("modal-wide", Boolean(options.wide));
  overlay.classList.add("open");
  document.body.classList.add("modal-open");

  if (!options.skipHistory) {
    pushNavState({ modal: nodeId });
  } else {
    setNavState({ modal: nodeId });
  }
}

function closeModal(options = {}) {
  const overlay = document.getElementById("modalOverlay");
  const bodyEl = document.getElementById("modalBody");
  if (!overlay || !bodyEl) return;

  // A dashboard (e.g. the admin progress editor) can register a guard here
  // to confirm before an explicit close discards unsaved edits. Back/
  // Forward navigation (skipHistory) never blocks — the URL has already
  // changed by the time this runs.
  if (!options.skipHistory && !options.force && typeof window.confirmModalClose === "function" && !window.confirmModalClose()) {
    return;
  }

  const wasOpen = overlay.classList.contains("open");

  const node = bodyEl.firstElementChild;
  if (node && node.__modalHome) {
    node.classList.add("hidden");
    node.__modalHome.parent.insertBefore(node, node.__modalHome.next);
  }

  overlay.classList.remove("open");
  document.body.classList.remove("modal-open");

  if (!options.skipHistory && wasOpen && navState.modal) {
    pushNavState({ modal: null });
  } else if (options.skipHistory) {
    setNavState({ modal: null });
  }
}

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") closeModal();
});

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Renders a small circular avatar: the uploaded photo when one exists,
// otherwise initials on a solid background so every sender/uploader still
// reads as a distinct person.
function avatarHtml(name, avatarUrl, sizeClass = "") {
  const classes = ["avatar", sizeClass].filter(Boolean).join(" ");

  if (avatarUrl) {
    return `<img class="${classes} avatar-photo" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name || "Avatar")}" />`;
  }

  return `<div class="${classes}">${escapeHtml(initials(name) || "?")}</div>`;
}

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

function showPage(pageName) {
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
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
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
}

function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  const bodyEl = document.getElementById("modalBody");
  if (!overlay || !bodyEl) return;

  const node = bodyEl.firstElementChild;
  if (node && node.__modalHome) {
    node.classList.add("hidden");
    node.__modalHome.parent.insertBefore(node, node.__modalHome.next);
  }

  overlay.classList.remove("open");
  document.body.classList.remove("modal-open");
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

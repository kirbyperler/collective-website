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

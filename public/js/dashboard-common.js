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

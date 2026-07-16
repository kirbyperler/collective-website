const API = {
  me: "/api/player?action=me",
  messages: "/api/player?action=messages",
  programs: "/api/player?action=programs",
  files: "/api/files?action=files",
  progress: "/api/player?action=progress",
  contacts: "/api/player?action=contacts",
  avatar: "/api/files?action=avatar"
};

let player = null;
let messages = [];
let programs = { interestedInPlayer: [], playerInterested: [] };
let files = [];
let progressRatings = [];
let contacts = [];

const emptyPlayer = {
  id: "",
  firstName: "",
  lastName: "",
  birthYear: "",
  email: "",
  phone: "",
  position: "",
  currentTeam: "",
  shoots: "",
  height: "",
  weight: "",
  careerStatus: "Youth",
  bio: "",
  avatarUrl: ""
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Your session has expired.");
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Request failed.");
  }

  return data;
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  document.getElementById(`${pageName}Page`)?.classList.add("active");
  document.querySelectorAll(".side-link").forEach(link => link.classList.toggle("active", link.dataset.page === pageName));
  document.getElementById("topbarTitle").textContent = pageName[0].toUpperCase() + pageName.slice(1);
  document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }

function setProfilePanel(panel) {
  document.querySelectorAll(".profile-panel").forEach(item => item.classList.remove("active"));
  document.getElementById(`profile${panel[0].toUpperCase() + panel.slice(1)}Panel`)?.classList.add("active");
  document.querySelectorAll(".segment").forEach(button => button.classList.toggle("active", button.dataset.profilePanel === panel));
}

function allowedRecruitingLevels(status) {
  const map = {
    Youth: ["Prep", "Juniors", "College"],
    Prep: ["Juniors", "College"],
    Juniors: ["College"],
    College: ["Pro"],
    Pro: ["Pro"]
  };
  return map[status] || [];
}

async function loadDashboard() {
  try {
    const [meData, messageData, programData, fileData, progressData, contactData] = await Promise.all([
      apiRequest(API.me),
      apiRequest(API.messages),
      apiRequest(API.programs),
      apiRequest(API.files),
      apiRequest(API.progress),
      apiRequest(API.contacts)
    ]);

    player = { ...emptyPlayer, ...(meData?.player || {}) };
    messages = messageData?.messages || [];
    programs = {
      interestedInPlayer: programData?.interestedInPlayer || [],
      playerInterested: programData?.playerInterested || []
    };
    files = fileData?.files || [];
    progressRatings = progressData?.ratings || [];
    contacts = contactData?.contacts || [];

    fillProfileForm();
    fillContacts();
    fillRecruitingLevels();
    renderEverything();
  } catch (error) {
    console.error("Dashboard load error:", error);
    alert(error.message);
  }
}
function fullName() { return `${player?.firstName || ""} ${player?.lastName || ""}`.trim() || "Player"; }

function fillProfileForm() {
  ["firstName","lastName","birthYear","position","currentTeam","shoots","height","weight","email","phone","careerStatus","bio"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = player?.[id] || "";
  });
}

function fillContacts() {
  const select = document.getElementById("messageRecipient");
  const list = contacts;
  select.innerHTML = list.length
    ? list.map(contact => `<option value="${escapeHtml(contact.id || contact._id)}">${escapeHtml(contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim())} · ${escapeHtml(contact.role || contact.type || "Staff")}</option>`).join("")
    : `<option value="">No staff contacts available</option>`;
}

function fillRecruitingLevels() {
  const levels = allowedRecruitingLevels(player?.careerStatus || "Youth");
  ["interestedInPlayerLevel", "playerInterestedLevel"].forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = levels.map(level => `<option value="${level}">${level}</option>`).join("") || `<option value="Pro">Pro</option>`;
  });
}

function setAvatar(url) {
  ["overviewAvatar", "profileAvatar"].forEach(id => {
    const image = document.getElementById(id);
    image.src = url || "";
    image.hidden = !url;
  });
  document.getElementById("overviewAvatarPlaceholder").hidden = Boolean(url);
  document.getElementById("profileAvatarPlaceholder").hidden = Boolean(url);
}

function renderOverview() {
  document.getElementById("welcomeName").textContent = `Welcome back, ${player.firstName || "Player"}`;
  document.getElementById("welcomeMeta").textContent = [player.position, player.currentTeam, player.birthYear].filter(Boolean).join(" · ") || "Your development dashboard is ready.";
  document.getElementById("overviewCareerStatus").textContent = player.careerStatus || "Youth";
  document.getElementById("overviewPosition").textContent = player.position || "Player";
  setAvatar(player.avatarUrl || "");

  document.getElementById("overviewProfile").innerHTML = `<div class="profile-facts">
    <div class="fact-box"><span>Team</span><strong>${escapeHtml(player.currentTeam || "Not set")}</strong></div>
    <div class="fact-box"><span>Birth Year</span><strong>${escapeHtml(player.birthYear || "—")}</strong></div>
    <div class="fact-box"><span>Height</span><strong>${escapeHtml(player.height || "—")}</strong></div>
    <div class="fact-box"><span>Weight</span><strong>${escapeHtml(player.weight || "—")}</strong></div>
  </div>`;

  const unread = messages.filter(message => message.direction !== "sent" && !message.read).length;
  document.getElementById("overviewUnreadCount").textContent = unread;
  document.getElementById("overviewMessageList").innerHTML = messages.slice(0,3).map(message => `<div class="preview-row"><div><strong>${escapeHtml(message.fromName || message.toName || message.senderName || "Collective")}</strong><p class="muted small">${escapeHtml(message.subject || message.text || "Message")}</p></div></div>`).join("") || `<p class="muted small">No messages yet.</p>`;

  document.getElementById("overviewInterestedCount").textContent = programs.interestedInPlayer.length;
  document.getElementById("overviewInterestedList").innerHTML = programs.interestedInPlayer.slice(0,4).map(program => `<div class="preview-row"><div><strong>${escapeHtml(program.name)}</strong><p class="muted small">${escapeHtml(program.level || "Program")}</p></div></div>`).join("") || `<p class="muted small">No programs added.</p>`;

  document.getElementById("overviewProgress").innerHTML = progressRatings.slice(0,4).map(item => `<div class="progress-row"><span class="small">${escapeHtml(item.category)}</span><div class="progress-track"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,Number(item.rating)||0))}%"></div></div><strong>${Number(item.rating)||0}</strong></div>`).join("") || `<p class="muted small">No progress ratings yet.</p>`;

  document.getElementById("overviewFileCount").textContent = files.length;
  document.getElementById("overviewFileList").innerHTML = files.slice(0,3).map(file => `<div class="preview-row"><div><strong>${escapeHtml(file.name || file.fileName)}</strong><p class="muted small">${escapeHtml(file.category || file.type || "File")}</p></div></div>`).join("") || `<p class="muted small">No files uploaded.</p>`;
}

function renderProfile() {
  document.getElementById("profileStatusPill").textContent = player.careerStatus || "Player";
  document.getElementById("recruitingStatusPill").textContent = player.careerStatus || "Career Status";
  setAvatar(player.avatarUrl || "");
}

function renderProgress() {
  document.getElementById("progressRatings").innerHTML = progressRatings.map(item => `<article class="rating-card"><div class="rating-head"><strong>${escapeHtml(item.category)}</strong><span class="pill">${Number(item.rating)||0}/100</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,Number(item.rating)||0))}%"></div></div><p class="muted small" style="margin-top:9px">${escapeHtml(item.note || "No note provided.")}</p></article>`).join("");
  document.getElementById("progressHistory").innerHTML = `<p class="eyebrow">Recent Evaluations</p>${progressRatings.map(item => `<div class="history-item"><strong>${escapeHtml(item.evaluator || "Collective Staff")}</strong><p class="muted small">${escapeHtml(item.category)} · ${new Date(item.createdAt || Date.now()).toLocaleDateString()}</p><p class="muted small">${escapeHtml(item.note || "")}</p></div>`).join("")}`;
}

function renderPrograms() {
  const renderList = (type, elementId, countId) => {
    const list = programs[type] || [];
    document.getElementById(countId).textContent = `${list.length} programs`;
    document.getElementById(elementId).innerHTML = list.map(program => `<div class="program-item"><div class="program-head"><div><strong>${escapeHtml(program.name)}</strong><p class="muted small">${escapeHtml(program.level || "Program")}</p></div><button class="text-button" onclick="deleteProgram('${type}','${escapeHtml(program.id || program._id)}')">Delete</button></div><p class="muted small">${escapeHtml(program.contact || program.note || "No contact information")}</p></div>`).join("") || `<p class="muted small">No programs added.</p>`;
  };
  renderList("interestedInPlayer", "programsInterestedList", "programsInterestedCount");
  renderList("playerInterested", "playerInterestedList", "playerInterestedCount");
}

function renderMessages() {
  const query = document.getElementById("messageSearch")?.value.toLowerCase().trim() || "";
  const filtered = messages.filter(message => `${message.subject || ""} ${message.text || ""} ${message.fromName || ""} ${message.toName || ""}`.toLowerCase().includes(query));
  document.getElementById("messageCountPill").textContent = `${filtered.length} messages`;
  document.getElementById("messageList").innerHTML = filtered.map(message => `<div class="message-item"><div class="message-head"><div><strong>${escapeHtml(message.subject || "Message")}</strong><p class="muted small">${escapeHtml(message.direction === "sent" ? `To ${message.toName || "Staff"}` : `From ${message.fromName || "Collective"}`)} · ${new Date(message.createdAt || Date.now()).toLocaleString()}</p></div><button class="text-button" onclick="deleteMessage('${escapeHtml(message.id || message._id)}')">Delete</button></div><p class="muted small">${escapeHtml(message.text || "")}</p></div>`).join("") || `<p class="muted small">No messages found.</p>`;
}

function renderFiles() {
  const query = document.getElementById("fileSearch")?.value.toLowerCase().trim() || "";
  const filtered = files.filter(file => `${file.name || file.fileName || ""} ${file.category || ""}`.toLowerCase().includes(query));
  document.getElementById("fileCountPill").textContent = `${filtered.length} files`;
  document.getElementById("fileList").innerHTML = filtered.map(file => {
    const url = file.url || file.fileUrl || "";
    const type = file.mimeType || file.type || "";
    let preview = `<span>${escapeHtml(file.category || "File")}</span>`;
    if (url && type.startsWith("image")) preview = `<img src="${escapeHtml(url)}" alt="${escapeHtml(file.name || "File")}">`;
    if (url && type.startsWith("video")) preview = `<video src="${escapeHtml(url)}" muted></video>`;
    return `<div class="file-item"><div class="file-thumb">${preview}</div><div class="file-head"><div><strong>${escapeHtml(file.name || file.fileName || "Untitled file")}</strong><p class="muted small">${escapeHtml(file.category || "File")}</p></div><button class="text-button" onclick="deleteFile('${escapeHtml(file.id || file._id)}')">Delete</button></div>${url ? `<a class="text-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">View File</a>` : ""}<p class="muted small">${escapeHtml(file.note || "")}</p></div>`;
  }).join("") || `<p class="muted small">No files found.</p>`;
}

function renderEverything() { renderOverview(); renderProfile(); renderProgress(); renderPrograms(); renderMessages(); renderFiles(); }

async function saveProfile(event) {
  event.preventDefault();
  const payload = {};
  ["firstName","lastName","birthYear","position","currentTeam","shoots","height","weight","email","phone","careerStatus","bio"].forEach(id => payload[id] = document.getElementById(id).value.trim());
  const data = await apiRequest(API.me, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  player = { ...player, ...(data?.player || payload) };
  fillRecruitingLevels();
  renderEverything();
  alert("Profile saved.");
}

async function uploadAvatar() {
  const input = document.getElementById("avatarInput");
  const file = input.files[0];
  if (!file) return alert("Choose a photo first.");
  const formData = new FormData();
  formData.append("file", file);
  const data = await apiRequest(API.avatar, { method: "POST", body: formData });
  player.avatarUrl = data?.avatarUrl || data?.url || "";
  input.value = "";
  renderEverything();
}

async function deleteAvatar() {
  if (!player.avatarUrl || !confirm("Remove your profile photo?")) return;
  await apiRequest(API.avatar, { method: "DELETE" });
  player.avatarUrl = "";
  renderEverything();
}

async function addProgram(event, type) {
  event.preventDefault();
  const prefix = type === "interestedInPlayer" ? "interestedInPlayer" : "playerInterested";
  const payload = { type, name: document.getElementById(`${prefix}Name`).value.trim(), level: document.getElementById(`${prefix}Level`).value, contact: document.getElementById(`${prefix}Contact`).value.trim() };
  const data = await apiRequest(API.programs, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  programs[type].unshift(data.program);
  event.target.reset();
  fillRecruitingLevels();
  renderEverything();
}

async function deleteProgram(type, id) {
  if (!confirm("Delete this program?")) return;
  await apiRequest(API.programs, { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id, type }) });
  programs[type] = programs[type].filter(program => String(program.id || program._id) !== String(id));
  renderEverything();
}

async function sendMessage(event) {
  event.preventDefault();
  const recipientSelect = document.getElementById("messageRecipient");
  const payload = { recipientId: recipientSelect.value, toName: recipientSelect.options[recipientSelect.selectedIndex]?.text.split(" · ")[0], subject: document.getElementById("messageSubject").value.trim(), text: document.getElementById("messageText").value.trim() };
  const data = await apiRequest(API.messages, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  messages.unshift(data.message);
  event.target.reset();
  renderEverything();
}

async function deleteMessage(id) {
  if (!confirm("Delete this message?")) return;
  await apiRequest(API.messages, { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id }) });
  messages = messages.filter(message => String(message.id || message._id) !== String(id));
  renderEverything();
}

async function uploadFile(event) {
  event.preventDefault();
  const input = document.getElementById("fileInput");
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", document.getElementById("fileCategory").value);
  formData.append("note", document.getElementById("fileNote").value.trim());
  const data = await apiRequest(API.files, { method: "POST", body: formData });
  files.unshift(data.file);
  event.target.reset();
  renderEverything();
}

async function deleteFile(id) {
  if (!confirm("Delete this file?")) return;
  await apiRequest(API.files, { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id }) });
  files = files.filter(file => String(file.id || file._id) !== String(id));
  renderEverything();
}

async function logout() {
  try {
    const response = await fetch(
      "/api/auth?action=logout",
      {
        method: "POST",
        credentials: "same-origin"
      }
    );

    const contentType =
      response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
      ? await response.json()
      : {
          error: await response.text()
        };

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Unable to log out."
      );
    }

    window.location.replace("/login");
  } catch (error) {
    console.error("Logout error:", error);
    alert(error.message);
  }
}
const ADMIN_API = {
  users: "/api/admin?action=users",
  messages: "/api/admin?action=messages",
  acceptInquiry: "/api/admin?action=accept-inquiry",
  sendSetupEmail: "/api/admin?action=send-setup-email",
  sendSetupEmailsBulk: "/api/admin?action=send-setup-emails-bulk",
  progress: "/api/admin?action=progress",
  programs: "/api/admin?action=programs",
  refreshEliteProspects: "/api/admin?action=refreshEliteProspects",
  inquiries: "/api/inquiries",
  files: "/api/files?action=files",
  logout: "/api/auth?action=logout"
};

let users = [];
let selectedUserId = null;

let progressCategories = [];
let playerProgressRatings = [];

let inquiries = [];
let messages = [];
let files = [];

let activeDatabaseFilter = "Users";

async function readApiResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const responseText = await response.text();

  throw new Error(
    `API returned ${response.status}: ` +
    responseText.slice(0, 200)
  );
}

function fullName(user) {
  return `${user.firstName || ""} ${user.lastName || ""}`.trim();
}

function accountStatusBadgeHtml(user) {
  const status = user.setupStatus || "Pending Setup";
  return `<span class="badge badge-status-${status.toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(status)}</span>`;
}

function setupEmailButtonHtml(user) {
  const status = user.setupStatus || "Pending Setup";
  if (status === "Active") return "";
  const label = status === "Pending Setup" ? "Send Setup Email" : "Resend Setup Email";
  return `<button class="text-button" type="button" onclick="sendSetupEmail('${escapeHtml(user.id)}')">${label}</button>`;
}

async function sendSetupEmail(userId) {
  const user = users.find(function(item) { return item.id === userId; });
  if (!user) {
    alert("User not found.");
    return;
  }

  const status = user.setupStatus || "Pending Setup";
  const verb = status === "Pending Setup" ? "Send" : "Resend";
  if (!confirm(`${verb} the setup email to ${fullName(user)}?`)) return;

  try {
    const response = await fetch(ADMIN_API.sendSetupEmail, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to send the setup email.");
    }

    await loadUsers();
    renderDatabase();
    if (selectedUserId === userId) {
      const refreshed = users.find(function(item) { return item.id === userId; });
      renderUserSummary(refreshed);
    }

    alert(data.message || "Setup email sent.");
  } catch (error) {
    console.error("Send setup email error:", error);
    alert(error.message);
  }
}

async function sendBulkSetupEmails() {
  if (!confirm("Send setup emails to all pending users? This may take a moment.")) return;

  try {
    const response = await fetch(ADMIN_API.sendSetupEmailsBulk, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to send setup emails.");
    }

    await loadUsers();
    renderDatabase();

    alert(`Sent: ${data.sent}. Failed: ${data.failed}. Skipped: ${data.skipped}.`);
  } catch (error) {
    console.error("Bulk send setup emails error:", error);
    alert(error.message);
  }
}

async function loadUsers() {
  try {
    const response = await fetch(
      ADMIN_API.users,
      {
        method: "GET",
        credentials: "same-origin"
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to load users."
      );
    }

    const userRecords = Array.isArray(data)
      ? data
      : Array.isArray(data.users)
        ? data.users
        : [];

    users = userRecords.map(function(user) {
      return {
        ...user,
        id: String(user._id || user.id),
        type: user.type || "Player",
        birthYear: user.birthYear || "",
        position: user.position || "",
        eliteProspects:
          user.eliteProspects || "",
        phone: user.phone || ""
      };
    });

    const selectedUserStillExists =
      users.some(function(user) {
        return user.id === selectedUserId;
      });

    if (!selectedUserStillExists) {
      selectedUserId = null;
    }

    renderEverything();
  } catch (error) {
    console.error(
      "Load users error:",
      error
    );

    alert(error.message);
  }
}

async function loadInquiries() {
  try {
    const response = await fetch(
      ADMIN_API.inquiries,
      {
        method: "GET",
        credentials: "same-origin"
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to load inquiries."
      );
    }

    const inquiryRecords =
      Array.isArray(data)
        ? data
        : Array.isArray(data.inquiries)
          ? data.inquiries
          : [];

    inquiries =
      inquiryRecords.map(function(inquiry) {
        return {
          ...inquiry,
          id: String(
            inquiry._id || inquiry.id
          )
        };
      });

    renderEverything();
  } catch (error) {
    console.error(
      "Load inquiries error:",
      error
    );

    alert(error.message);
  }
}

async function loadMessages() {
  try {
    const response = await fetch(
      ADMIN_API.messages,
      {
        method: "GET",
        credentials: "same-origin"
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to load messages."
      );
    }

    const messageRecords =
      Array.isArray(data)
        ? data
        : Array.isArray(data.messages)
          ? data.messages
          : [];

    messages =
      messageRecords.map(function(message) {
        return {
          ...message,
          id: String(
            message._id || message.id
          ),
          userId: String(
            message.userId || ""
          ),
          time: message.createdAt
            ? new Date(
                message.createdAt
              ).toLocaleString()
            : ""
        };
      });

    renderEverything();
  } catch (error) {
    console.error(
      "Load messages error:",
      error
    );

    alert(error.message);
  }
}

async function loadFiles() {
  try {
    const response = await fetch(
      ADMIN_API.files,
      {
        method: "GET",
        credentials: "same-origin"
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to load files."
      );
    }

    files =
      Array.isArray(data.files)
        ? data.files
        : [];

    renderEverything();
  } catch (error) {
    console.error(
      "Load files error:",
      error
    );

    alert(error.message);
  }
}

function filteredUsers(inputId) {
  const value =
    document
      .getElementById(inputId)
      ?.value
      .toLowerCase()
      .trim() || "";

  return users.filter(function(user) {
    const searchableText = [
      fullName(user),
      user.type,
      user.email,
      user.phone,
      user.position,
      user.birthYear
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(value);
  });
}

function renderOverviewUsers() {
  const totalElement =
    document.getElementById(
      "overviewUserTotal"
    );

  const listElement =
    document.getElementById(
      "overviewUserList"
    );

  if (!totalElement || !listElement) {
    return;
  }

  const list =
    filteredUsers(
      "overviewUserSearch"
    ).slice(0, 3);

  totalElement.textContent =
    users.length;

  listElement.innerHTML =
    list.length
      ? list
          .map(function(user) {
            return `
              <div class="preview-row">
                <div>
                  <strong>
                    ${escapeHtml(fullName(user))}
                  </strong>

                  <p class="muted small">
                    ${escapeHtml(user.type)}
                    ${
                      user.position
                        ? ` · ${escapeHtml(user.position)}`
                        : ""
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onclick="openUser('${user.id}')"
                >
                  View
                </button>
              </div>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No users found.
        </p>
      `;
}

function renderOverviewInquiries() {
  const totalElement =
    document.getElementById(
      "overviewInquiryTotal"
    );

  const listElement =
    document.getElementById(
      "overviewInquiryList"
    );

  if (!totalElement || !listElement) {
    return;
  }

  totalElement.textContent =
    inquiries.length;

  listElement.innerHTML =
    inquiries.length
      ? inquiries
          .slice(0, 2)
          .map(function(inquiry) {
            return `
              <div class="preview-row">
                <div>
                  <strong>
                    ${escapeHtml(inquiry.firstName || "")}
                    ${escapeHtml(inquiry.lastName || "")}
                  </strong>

                  <p class="muted small">
                    ${escapeHtml(inquiry.role || "")}
                    ${
                      inquiry.position
                        ? ` · ${escapeHtml(inquiry.position)}`
                        : ""
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onclick="showPage('inquiries')"
                >
                  Review
                </button>
              </div>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No open inquiries.
        </p>
      `;
}

function renderMetrics() {
  const players =
    users.filter(function(user) {
      return user.type === "Player";
    }).length;

  const coaches =
    users.filter(function(user) {
      return user.type === "Coach";
    }).length;

  const advisors =
    users.filter(function(user) {
      return user.type === "Advisor";
    }).length;

  const fileTotal = files.length;

  const metrics = [
    ["Users", users.length],
    ["Players", players],
    ["Coaches", coaches],
    ["Advisors", advisors],
    ["Inquiries", inquiries.length],
    ["Files", fileTotal],
    ["Messages", messages.length],
    ["Needs Action", inquiries.length]
  ];

  const metricsGrid =
    document.getElementById(
      "metricsGrid"
    );

  if (metricsGrid) {
    metricsGrid.innerHTML =
      metrics
        .map(function(metric) {
          const label = metric[0];
          const value = metric[1];

          return `
            <button
              class="metric-box"
              type="button"
              onclick="openDatabase('${label}')"
            >
              <span>${label}</span>
              <strong>${value}</strong>
            </button>
          `;
        })
        .join("");
  }

  const overviewFileTotal =
    document.getElementById(
      "overviewFileTotal"
    );

  if (overviewFileTotal) {
    overviewFileTotal.textContent =
      fileTotal;
  }

  const overviewMessageTotal =
    document.getElementById(
      "overviewMessageTotal"
    );

  if (overviewMessageTotal) {
    overviewMessageTotal.textContent =
      messages.length;
  }
}

function renderUserWorkspace() {
  const countElement =
    document.getElementById(
      "userWorkspaceCount"
    );

  const listElement =
    document.getElementById(
      "userWorkspaceList"
    );

  if (!countElement || !listElement) {
    return;
  }

  const list =
    filteredUsers(
      "userWorkspaceSearch"
    );

  countElement.textContent =
    `${list.length} users`;

  listElement.innerHTML =
    list.length
      ? list
          .map(function(user) {
            return `
              <button
                class="user-button ${
                  user.id === selectedUserId
                    ? "active"
                    : ""
                }"
                type="button"
                onclick="selectUser('${user.id}')"
              >
                <div class="avatar">
                  ${escapeHtml(initials(fullName(user)))}
                </div>

                <div>
                  <strong>
                    ${escapeHtml(fullName(user))}
                  </strong>

                  <p class="muted small">
                    ${escapeHtml(user.type)} ·
                    ${escapeHtml(user.email || "")}
                  </p>
                </div>

                <span class="pill">
                  Edit
                </span>
              </button>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No users found.
        </p>
      `;
}

function openUser(id) {
  selectUser(id, { skipHistory: true });
  showPage("users");
}

function selectUser(id, options = {}) {
  selectedUserId = id;

  const user =
    users.find(function(item) {
      return item.id === id;
    });

  if (!user) {
    console.error(
      "User not found:",
      id
    );

    return;
  }

  document.getElementById(
    "userFormTitle"
  ).textContent =
    `Update ${fullName(user)}`;

  document.getElementById(
    "userId"
  ).value = user.id;

  document.getElementById(
    "firstName"
  ).value = user.firstName || "";

  document.getElementById(
    "lastName"
  ).value = user.lastName || "";

  document.getElementById(
    "email"
  ).value = user.email || "";

  document.getElementById(
    "phone"
  ).value = user.phone || "";

  document.getElementById(
    "type"
  ).value = user.type || "Player";

  document.getElementById(
    "birthYear"
  ).value = user.birthYear || "";

  document.getElementById(
    "position"
  ).value = user.position || "";

  document.getElementById(
    "eliteProspects"
  ).value =
    user.eliteProspects || "";

  renderEliteProspectsAdminSection(user);
  renderProgressAdminSection(user);
  renderUserSummary(user);

  renderUserWorkspace();

  if (!options.skipHistory) {
    pushNavState({ user: id });
  } else {
    setNavState({ user: id });
  }
}

function renderUserSummary(user) {
  const empty = document.getElementById("userSummaryEmpty");
  const content = document.getElementById("userSummaryContent");
  const title = document.getElementById("userSummaryTitle");
  const body = document.getElementById("userSummaryBody");

  if (!empty || !content || !title || !body) return;

  if (!user) {
    empty.classList.remove("hidden");
    content.classList.add("hidden");
    title.textContent = "No User Selected";
    return;
  }

  empty.classList.add("hidden");
  content.classList.remove("hidden");
  title.textContent = fullName(user);

  const isPlayer = user.type === "Player";

  document.getElementById("manageCategoriesButton")?.classList.toggle("hidden", !isPlayer);
  document.getElementById("updateProgressButton")?.classList.toggle("hidden", !isPlayer);
  document.getElementById("manageRecruitingButton")?.classList.toggle("hidden", !isPlayer);

  body.innerHTML = `
    <div class="message-head-info" style="margin-bottom: 14px;">
      ${avatarHtml(fullName(user), user.avatarUrl, "avatar-sm")}
      <div>
        <strong>${escapeHtml(fullName(user))}</strong>
        <span class="badge badge-role">${escapeHtml(user.type || "")}</span>
      </div>
    </div>

    <p class="section-header">Account Status</p>
    <div class="info-grid">
      <div class="info-row"><span>Status</span>${accountStatusBadgeHtml(user)}</div>
    </div>
    ${setupEmailButtonHtml(user)}

    <p class="section-header">Contact</p>
    <div class="info-grid">
      <div class="info-row"><span>Email</span><strong>${escapeHtml(user.email || "—")}</strong></div>
      <div class="info-row"><span>Phone</span><strong>${escapeHtml(user.phone || "—")}</strong></div>
    </div>

    ${
      isPlayer
        ? `
          <p class="section-header">Hockey Profile</p>
          <div class="info-grid">
            <div class="info-row"><span>Birth Year</span><strong>${escapeHtml(user.birthYear || "—")}</strong></div>
            <div class="info-row"><span>Position</span><strong>${escapeHtml(user.position || "—")}</strong></div>
          </div>
        `
        : ""
    }
  `;
}

function startNewUser() {
  resetUserForm();
  setNavState({ user: null });
  openEditUserModal();
}

function openEditUserModal(options = {}) {
  const title = document.getElementById("userFormTitle");
  if (title) {
    title.textContent = selectedUserId ? "Edit User" : "Add User";
  }
  openModalWithNode(selectedUserId ? "Edit User" : "Add User", "userFormCard", options);
}

function openManageCategoriesModal(options = {}) {
  renderProgressCategoryManager();
  openModalWithNode("Manage Categories", "categoryManagerSection", { wide: true, ...options });
}

function openUpdateProgressModal(options = {}) {
  renderProgressRatingEditor();
  openModalWithNode("Update Player Progress", "playerRatingSection", { wide: true, ...options });
}

function openFilesForSelectedUser() {
  if (!selectedUserId) return;

  showPage("files");

  const select = document.getElementById("fileWorkspaceUser");
  if (select) {
    select.value = selectedUserId;
  }
}

function openMessagesForSelectedUser() {
  if (!selectedUserId) return;

  showPage("messages", { skipHistory: true });

  const select = document.getElementById("messageRecipient");
  if (select) {
    select.value = selectedUserId;
    select.dispatchEvent(new Event("change"));
  }

  openModalWithNode("New Message", "sendMessageCard");
}

let recruitingPrograms = { interestedInPlayer: [], playerInterested: [] };

function recruitingLevelOptions(careerStatus) {
  const map = {
    Youth: ["Prep", "Juniors", "College"],
    Prep: ["Juniors", "College"],
    Juniors: ["College"],
    College: ["Pro"],
    Pro: ["Pro"]
  };
  return map[careerStatus] || ["Pro"];
}

function renderProgramList(elementId, list, { editable }) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.innerHTML = list.length
    ? list.map(function(program) {
        const id = program.id || program._id || "";
        return `
          <div class="program-item">
            <div class="program-head">
              <div>
                <strong>${escapeHtml(program.name || "Program")}</strong>
                <p class="muted small">${escapeHtml(program.level || "Program")}</p>
              </div>
              ${editable ? `<button class="text-button" type="button" onclick="deleteAdminProgram('${escapeHtml(id)}')">Delete</button>` : ""}
            </div>
            <p class="muted small">${escapeHtml(program.contact || program.note || "No contact information")}</p>
          </div>
        `;
      }).join("")
    : `<p class="muted small">No programs added.</p>`;
}

async function loadRecruitingPrograms(playerId) {
  try {
    const response = await fetch(`${ADMIN_API.programs}&playerId=${encodeURIComponent(playerId)}`, { credentials: "same-origin" });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to load recruiting programs.");
    recruitingPrograms = {
      interestedInPlayer: Array.isArray(data.interestedInPlayer) ? data.interestedInPlayer : [],
      playerInterested: Array.isArray(data.playerInterested) ? data.playerInterested : []
    };
  } catch (error) {
    console.error("Load recruiting programs error:", error);
    recruitingPrograms = { interestedInPlayer: [], playerInterested: [] };
  }
}

async function renderRecruitingAdminSection() {
  if (!selectedUserId) return;
  const user = users.find(function(item) { return item.id === selectedUserId; });

  const levelSelect = document.getElementById("adminProgramLevel");
  if (levelSelect) {
    const levels = recruitingLevelOptions(user?.careerStatus || "Youth");
    levelSelect.innerHTML = levels.map(function(level) {
      return `<option value="${escapeHtml(level)}">${escapeHtml(level)}</option>`;
    }).join("");
  }

  await loadRecruitingPrograms(selectedUserId);
  renderProgramList("adminInterestedInPlayerList", recruitingPrograms.interestedInPlayer, { editable: true });
  renderProgramList("adminPlayerInterestedList", recruitingPrograms.playerInterested, { editable: false });
}

function openManageRecruitingModal(options = {}) {
  if (!selectedUserId) return;
  renderRecruitingAdminSection();
  openModalWithNode("Manage Recruiting", "recruitingAdminSection", { wide: true, ...options });
}

async function addAdminProgram(event) {
  event.preventDefault();
  if (!selectedUserId) return;

  const name = document.getElementById("adminProgramName")?.value.trim() || "";
  const level = document.getElementById("adminProgramLevel")?.value || "";
  const contact = document.getElementById("adminProgramContact")?.value.trim() || "";

  try {
    const response = await fetch(ADMIN_API.programs, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: selectedUserId, name, level, contact })
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to add program.");

    event.target.reset();
    await renderRecruitingAdminSection();
  } catch (error) {
    console.error("Add admin program error:", error);
    alert(error.message);
  }
}

async function deleteAdminProgram(id) {
  if (!selectedUserId) return;
  if (!confirm("Delete this program?")) return;

  try {
    const response = await fetch(ADMIN_API.programs, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: selectedUserId, id })
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to delete program.");

    await renderRecruitingAdminSection();
  } catch (error) {
    console.error("Delete admin program error:", error);
    alert(error.message);
  }
}

const ADMIN_MODAL_OPENERS = {
  userFormCard: function(state) {
    if (state.user) openEditUserModal({ skipHistory: true });
    else startNewUserSilently();
  },
  categoryManagerSection: function() { openManageCategoriesModal({ skipHistory: true }); },
  playerRatingSection: function() { openUpdateProgressModal({ skipHistory: true }); },
  sendMessageCard: function() { openModalWithNode("New Message", "sendMessageCard", { skipHistory: true }); },
  recruitingAdminSection: function() { openManageRecruitingModal({ skipHistory: true }); }
};

function startNewUserSilently() {
  resetUserForm();
  openEditUserModal({ skipHistory: true });
}

function reopenAdminModal(nodeId, state) {
  const opener = ADMIN_MODAL_OPENERS[nodeId];
  if (!opener || !document.getElementById(nodeId)) {
    closeModal({ skipHistory: true });
    return;
  }
  opener(state);
}

window.applyNavState = function(state) {
  showPage(state.page || "overview", { skipHistory: true });
  if (state.user && state.user !== selectedUserId) {
    selectUser(state.user, { skipHistory: true });
  }
  if (state.modal) {
    reopenAdminModal(state.modal, state);
  } else {
    closeModal({ skipHistory: true });
  }
};

function renderEliteProspectsAdminSection(user) {
  const section =
    document.getElementById(
      "eliteProspectsAdminSection"
    );

  const body =
    document.getElementById(
      "eliteProspectsAdminBody"
    );

  if (!section || !body) {
    return;
  }

  if (!user || user.type !== "Player") {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  const syncBadge = document.getElementById("eliteProspectsSyncBadge");
  if (syncBadge) {
    const status = user.epSync?.status === "success" ? "Synced" : user.epSync?.status === "error" ? "Sync failed" : "Not synced";
    syncBadge.textContent = status;
    syncBadge.classList.toggle("badge-synced", status === "Synced");
    syncBadge.classList.toggle("badge-manual", status === "Sync failed");
  }

  if (!user.eliteProspects) {
    body.innerHTML = `<p class="muted small ep-empty">No Elite Prospects profile linked.</p>`;
    return;
  }

  const epData = user.epData || null;
  const epSync = user.epSync || null;
  const bio = epData?.bio || {};
  const season = epData?.latestSeason || {};
  const recentForm = epData?.recentForm || {};
  const context = epData?.currentContext || {};

  const contextFacts = [
    ["Team", context.team],
    ["League", context.league],
    ["Season", context.season],
    ["Position", bio.position]
  ].filter(fact => fact[1] != null && fact[1] !== "");

  const hasFullSeason = season.gp != null;

  const infoFacts = [
    ["DOB", bio.dateOfBirth],
    ["Age", bio.age],
    ["Height", bio.height],
    ["Weight", bio.weight],
    ["Shoots", bio.shoots],
    ["Birthplace", bio.placeOfBirth],
    ["Nationality", bio.nationality]
  ].filter(fact => fact[1] != null && fact[1] !== "");

  const factGrid = facts => `<div class="ep-fact-grid">${facts.map(fact =>
    `<div class="ep-fact"><span>${escapeHtml(fact[0])}</span><strong>${escapeHtml(String(fact[1]))}</strong></div>`
  ).join("")}</div>`;

  const statBoxes = boxes => `<div class="stat-box-grid">${boxes.map(box =>
    `<div class="stat-box"><strong>${box[1] != null ? escapeHtml(String(box[1])) : "—"}</strong><span>${escapeHtml(box[0])}</span></div>`
  ).join("")}</div>`;

  const lastUpdated =
    epSync?.lastSuccessfulAt
      ? new Date(epSync.lastSuccessfulAt).toLocaleString()
      : "Never";

  body.innerHTML = `
    <div class="ep-layout">
      <div class="ep-subcard">
        <h4 class="ep-subcard-title">Current Context</h4>
        ${contextFacts.length ? factGrid(contextFacts) : `<p class="muted small ep-empty">No current team on file.</p>`}
      </div>
      ${hasFullSeason ? `
        <div class="ep-subcard">
          <h4 class="ep-subcard-title">Latest Full Season${season.season ? ` <span class="ep-subcard-sub">${escapeHtml(String(season.season))}</span>` : ""}</h4>
          ${statBoxes([
            ["GP", season.gp], ["G", season.goals], ["A", season.assists],
            ["PTS", season.points], ["PIM", season.pim],
            ["+/-", season.plusMinus != null ? `${season.plusMinus > 0 ? "+" : ""}${season.plusMinus}` : null]
          ])}
        </div>
      ` : ""}
      ${recentForm.gp != null ? `
        <div class="ep-subcard">
          <h4 class="ep-subcard-title">Recent Form <span class="ep-subcard-sub">Last ${escapeHtml(String(recentForm.spanGames))} Games</span></h4>
          ${statBoxes([
            ["GP", recentForm.gp], ["G", recentForm.goals], ["A", recentForm.assists], ["PTS", recentForm.points],
            ["+/-", recentForm.plusMinus != null ? `${recentForm.plusMinus > 0 ? "+" : ""}${recentForm.plusMinus}` : null]
          ])}
        </div>
      ` : ""}
      <div class="ep-subcard">
        <h4 class="ep-subcard-title">Player Information</h4>
        ${infoFacts.length ? factGrid(infoFacts) : `<p class="muted small ep-empty">No player information on file.</p>`}
      </div>
      <div class="ep-footer">
        <span class="muted small">Synced from Elite Prospects · Last updated ${escapeHtml(lastUpdated)}</span>
        <a class="button secondary" href="${escapeHtml(user.eliteProspects)}" target="_blank" rel="noopener noreferrer">View Elite Prospects Profile</a>
      </div>
    </div>
  `;
}

async function loadProgressCategories() {
  try {
    const response = await fetch(
      `${ADMIN_API.progress}&resource=categories`,
      { method: "GET", credentials: "same-origin" }
    );

    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to load progress categories.");
    }

    progressCategories = Array.isArray(data.categories) ? data.categories : [];
  } catch (error) {
    console.error("Load progress categories error:", error);
    progressCategories = [];
  }
}

async function loadPlayerProgress(playerId) {
  try {
    const response = await fetch(
      `${ADMIN_API.progress}&playerId=${encodeURIComponent(playerId)}`,
      { method: "GET", credentials: "same-origin" }
    );

    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to load player progress.");
    }

    playerProgressRatings = Array.isArray(data.ratings) ? data.ratings : [];
  } catch (error) {
    console.error("Load player progress error:", error);
    playerProgressRatings = [];
  }
}

function latestRatingForCategory(categoryName) {
  return playerProgressRatings
    .filter(function(item) {
      return item.category === categoryName;
    })
    .sort(function(a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    })[0] || null;
}

async function renderProgressAdminSection(user) {
  if (!user || user.type !== "Player") {
    playerProgressRatings = [];
    return;
  }

  await Promise.all([
    loadProgressCategories(),
    loadPlayerProgress(user.id)
  ]);
}

function renderProgressCategoryManager() {
  const manager = document.getElementById("progressCategoryManager");
  if (!manager) return;

  const sorted = [...progressCategories].sort(function(a, b) {
    return (a.order ?? 0) - (b.order ?? 0);
  });

  manager.innerHTML =
    sorted.length
      ? sorted
          .map(function(category, index) {
            const id = category.id || category._id || "";

            return `
              <div class="category-row">
                <span>${escapeHtml(category.name)}</span>
                <div class="action-row">
                  <button class="text-button" type="button" ${index === 0 ? "disabled" : ""} onclick="moveProgressCategory('${escapeHtml(id)}', -1)">Up</button>
                  <button class="text-button" type="button" ${index === sorted.length - 1 ? "disabled" : ""} onclick="moveProgressCategory('${escapeHtml(id)}', 1)">Down</button>
                  <button class="text-button" type="button" onclick="renameProgressCategory('${escapeHtml(id)}', '${escapeHtml(category.name).replaceAll("'", "\\'")}')">Rename</button>
                  <button class="text-button" type="button" onclick="deleteProgressCategory('${escapeHtml(id)}')">Delete</button>
                </div>
              </div>
            `;
          })
          .join("")
      : `<p class="muted small">No categories yet. Add one below.</p>`;
}

let progressEditorDirty = new Set();
let progressEditorOriginals = {};

function renderProgressRatingEditor() {
  const editor = document.getElementById("progressRatingEditor");
  if (!editor || !selectedUserId) return;

  const sorted = [...progressCategories].sort(function(a, b) {
    return (a.order ?? 0) - (b.order ?? 0);
  });

  progressEditorDirty = new Set();
  progressEditorOriginals = {};

  editor.innerHTML =
    sorted.length
      ? sorted
          .map(function(category) {
            const id = escapeHtml(category.id || category._id);
            const latest = latestRatingForCategory(category.name);
            const ratingValue = latest ? String(Math.round(latest.rating)) : "";
            const noteValue = latest?.note || "";

            progressEditorOriginals[id] = { rating: ratingValue, note: noteValue, categoryName: category.name };

            return `
              <div class="form-group progress-rating-row" id="rating-row-${id}">
                <label class="field-label">${escapeHtml(category.name)} <span class="badge hidden" id="dirty-${id}">Unsaved</span></label>
                <div class="form-row">
                  <input class="field" type="number" min="0" max="100" id="rating-${id}" value="${ratingValue}" placeholder="0-100" oninput="markRatingDirty('${id}')" />
                </div>
                <textarea class="field" id="note-${id}" placeholder="Optional note..." oninput="markRatingDirty('${id}')">${escapeHtml(noteValue)}</textarea>
                ${latest ? `<p class="muted small">Last updated ${escapeHtml(new Date(latest.createdAt).toLocaleDateString())} by ${escapeHtml(latest.evaluator || "Staff")}</p>` : ""}
              </div>
            `;
          })
          .join("")
      : "";

  updateSaveAllRatingsState();
  setProgressSaveStatus("");
}

function markRatingDirty(id) {
  const original = progressEditorOriginals[id];
  if (!original) return;

  const ratingInput = document.getElementById(`rating-${id}`);
  const noteInput = document.getElementById(`note-${id}`);
  const isDirty = (ratingInput?.value || "") !== original.rating || (noteInput?.value || "") !== original.note;

  if (isDirty) progressEditorDirty.add(id);
  else progressEditorDirty.delete(id);

  document.getElementById(`dirty-${id}`)?.classList.toggle("hidden", !isDirty);
  updateSaveAllRatingsState();
}

function updateSaveAllRatingsState() {
  const button = document.getElementById("saveAllRatingsButton");
  if (button) {
    button.disabled = progressEditorDirty.size === 0;
    button.textContent = "Save All Changes";
  }

  if (progressEditorDirty.size) {
    setProgressSaveStatus(`${progressEditorDirty.size} unsaved change${progressEditorDirty.size === 1 ? "" : "s"}.`);
  }
}

function setProgressSaveStatus(message, isError = false) {
  const status = document.getElementById("progressSaveStatus");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#f0a09d" : "";
}

function hasUnsavedRatingChanges() {
  return progressEditorDirty.size > 0;
}

window.confirmModalClose = function() {
  const bodyEl = document.getElementById("modalBody");
  if (bodyEl?.firstElementChild?.id === "playerRatingSection" && hasUnsavedRatingChanges()) {
    return confirm("You have unsaved rating changes. Close without saving?");
  }
  return true;
};

function resetProgressRatingEditor() {
  if (progressEditorDirty.size && !confirm("Discard unsaved rating changes?")) return;
  renderProgressRatingEditor();
}

async function saveAllPlayerRatings() {
  if (!selectedUserId || !progressEditorDirty.size) return;

  const ratings = [];
  for (const id of progressEditorDirty) {
    const original = progressEditorOriginals[id];
    const ratingInput = document.getElementById(`rating-${id}`);
    const noteInput = document.getElementById(`note-${id}`);
    const rating = Number(ratingInput?.value);

    if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
      setProgressSaveStatus(`Enter a rating between 0 and 100 for "${original.categoryName}".`, true);
      return;
    }

    ratings.push({ category: original.categoryName, rating, note: noteInput?.value.trim() || "" });
  }

  const button = document.getElementById("saveAllRatingsButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }
  setProgressSaveStatus("Saving...");

  try {
    const response = await fetch(ADMIN_API.progress, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: selectedUserId, ratings })
    });

    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to save ratings.");

    await loadPlayerProgress(selectedUserId);

    if (data.errors?.length) {
      renderProgressRatingEditor();
      setProgressSaveStatus(`Saved ${data.saved?.length || 0}, but failed: ${data.errors.map(function(item) { return item.category; }).join(", ")}.`, true);
      return;
    }

    renderProgressRatingEditor();
    setProgressSaveStatus("All changes saved.");
  } catch (error) {
    console.error("Save all ratings error:", error);
    setProgressSaveStatus(error.message, true);
    if (button) {
      button.disabled = false;
      button.textContent = "Save All Changes";
    }
  }
}

async function addProgressCategory() {
  const input = document.getElementById("newProgressCategoryName");
  const name = input?.value.trim();
  if (!name) {
    alert("Enter a category name first.");
    return;
  }

  try {
    const response = await fetch(ADMIN_API.progress, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "categories", name })
    });

    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to add category.");

    input.value = "";
    await loadProgressCategories();
    renderProgressCategoryManager();
    renderProgressRatingEditor();
  } catch (error) {
    console.error("Add progress category error:", error);
    alert(error.message);
  }
}

async function renameProgressCategory(id, currentName) {
  const name = prompt("Rename category:", currentName);
  if (!name || !name.trim() || name.trim() === currentName) return;

  try {
    const response = await fetch(ADMIN_API.progress, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "categories", id, name: name.trim() })
    });

    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to rename category.");

    await loadProgressCategories();
    if (selectedUserId) await loadPlayerProgress(selectedUserId);
    renderProgressCategoryManager();
    renderProgressRatingEditor();
  } catch (error) {
    console.error("Rename progress category error:", error);
    alert(error.message);
  }
}

async function deleteProgressCategory(id) {
  if (!confirm("Delete this category? Past ratings in this category are kept but it will no longer be offered.")) return;

  try {
    const response = await fetch(ADMIN_API.progress, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "categories", id })
    });

    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || data.message || "Failed to delete category.");

    await loadProgressCategories();
    renderProgressCategoryManager();
    renderProgressRatingEditor();
  } catch (error) {
    console.error("Delete progress category error:", error);
    alert(error.message);
  }
}

async function moveProgressCategory(id, direction) {
  const sorted = [...progressCategories].sort(function(a, b) {
    return (a.order ?? 0) - (b.order ?? 0);
  });

  const index = sorted.findIndex(function(category) {
    return (category.id || category._id) === id;
  });

  const swapIndex = index + direction;
  if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return;

  const current = sorted[index];
  const swap = sorted[swapIndex];

  try {
    await Promise.all([
      fetch(ADMIN_API.progress, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "categories", id: current.id || current._id, order: swap.order })
      }),
      fetch(ADMIN_API.progress, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "categories", id: swap.id || swap._id, order: current.order })
      })
    ]);

    await loadProgressCategories();
    renderProgressCategoryManager();
    renderProgressRatingEditor();
  } catch (error) {
    console.error("Reorder progress category error:", error);
    alert("Failed to reorder categories.");
  }
}

async function refreshEliteProspects() {
  if (!selectedUserId) {
    alert("Select a player first.");
    return;
  }

  try {
    const response = await fetch(
      ADMIN_API.refreshEliteProspects,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: selectedUserId
        })
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to refresh Elite Prospects data."
      );
    }

    await loadUsers();
    selectUser(selectedUserId, { skipHistory: true });

    alert("Elite Prospects data refreshed.");
  } catch (error) {
    console.error(
      "Refresh Elite Prospects error:",
      error
    );

    alert(error.message);
  }
}

function resetUserForm() {
  selectedUserId = null;

  document
    .getElementById("userForm")
    .reset();

  document.getElementById(
    "userId"
  ).value = "";

  document.getElementById(
    "userFormTitle"
  ).textContent = "Add User";

  renderEliteProspectsAdminSection(null);
  renderProgressAdminSection(null);
  renderUserSummary(null);

  renderUserWorkspace();
}

async function saveUser(event) {
  event.preventDefault();

  const id =
    document
      .getElementById("userId")
      .value;

  const userData = {
    firstName:
      document
        .getElementById("firstName")
        .value
        .trim(),

    lastName:
      document
        .getElementById("lastName")
        .value
        .trim(),

    email:
      document
        .getElementById("email")
        .value
        .trim(),

    phone:
      document
        .getElementById("phone")
        .value
        .trim(),

    type:
      document
        .getElementById("type")
        .value,

    birthYear:
      document
        .getElementById("birthYear")
        .value
        .trim(),

    position:
      document
        .getElementById("position")
        .value
        .trim(),

    eliteProspects:
      document
        .getElementById(
          "eliteProspects"
        )
        .value
        .trim()
  };

  if (
    !userData.firstName ||
    !userData.lastName ||
    !userData.email ||
    !userData.type
  ) {
    alert(
      "First name, last name, email, and type are required."
    );

    return;
  }

  try {
    const method =
      id ? "PATCH" : "POST";

    const requestBody =
      id
        ? {
            id,
            ...userData
          }
        : userData;

    const response = await fetch(
      ADMIN_API.users,
      {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(
          requestBody
        )
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to save user."
      );
    }

    if (id) {
      selectedUserId = id;
    } else {
      selectedUserId = String(
        data.user?._id ||
        data.user?.id ||
        data.id ||
        ""
      );
    }

    await loadUsers();
    selectUser(selectedUserId, { skipHistory: true });
    closeModal();

    alert(
      id
        ? "User updated successfully."
        : "User created successfully."
    );
  } catch (error) {
    console.error(
      "Save user error:",
      error
    );

    alert(error.message);
  }
}

async function deleteSelectedUser() {
  if (!selectedUserId) {
    alert("Select a user first.");
    return;
  }

  const user =
    users.find(function(item) {
      return item.id === selectedUserId;
    });

  if (!user) {
    alert("User not found.");
    return;
  }

  const confirmed =
    confirm(
      `Delete ${fullName(user)}? This cannot be undone.`
    );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      ADMIN_API.users,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          id: selectedUserId
        })
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to delete user."
      );
    }

    selectedUserId = null;

    resetUserForm();

    await loadUsers();

    alert(
      "User deleted successfully."
    );
  } catch (error) {
    console.error(
      "Delete user error:",
      error
    );

    alert(error.message);
  }
}

function renderInquiryWorkspace() {
  const listElement =
    document.getElementById(
      "inquiryWorkspaceList"
    );

  if (!listElement) {
    return;
  }

  const value =
    document
      .getElementById(
        "inquirySearch"
      )
      ?.value
      .toLowerCase()
      .trim() || "";

  const list =
    inquiries.filter(function(inquiry) {
      const searchableText = [
        inquiry.firstName,
        inquiry.lastName,
        inquiry.email,
        inquiry.role,
        inquiry.position
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(value);
    });

  listElement.innerHTML =
    list.length
      ? list
          .map(function(inquiry) {
            const name =
              `${inquiry.firstName || ""} ${inquiry.lastName || ""}`.trim() ||
              "Unnamed applicant";

            return `
              <article class="card inquiry-item">
                <div class="message-head-info">
                  ${avatarHtml(name, "", "avatar-sm")}

                  <div>
                    <strong>${escapeHtml(name)}</strong>
                    <span class="badge badge-role">${escapeHtml(inquiry.role || "Applicant")}</span>
                  </div>
                </div>

                <div class="info-grid">
                  <div class="info-row">
                    <span>Email</span>
                    <strong>${escapeHtml(inquiry.email || "—")}</strong>
                  </div>

                  <div class="info-row">
                    <span>Phone</span>
                    <strong>${escapeHtml(inquiry.phoneNumber || "—")}</strong>
                  </div>

                  ${
                    inquiry.position
                      ? `<div class="info-row"><span>Position</span><strong>${escapeHtml(inquiry.position)}</strong></div>`
                      : ""
                  }

                  ${
                    inquiry.birthYear
                      ? `<div class="info-row"><span>Birth Year</span><strong>${escapeHtml(inquiry.birthYear)}</strong></div>`
                      : ""
                  }

                  <div class="info-row">
                    <span>Submitted</span>
                    <strong>${escapeHtml(formatShortDate(inquiry.createdAt) || "—")}</strong>
                  </div>
                </div>

                ${
                  inquiry.eliteProspects
                    ? `<a class="text-button" href="${escapeHtml(inquiry.eliteProspects)}" target="_blank" rel="noopener noreferrer">View Elite Prospects Profile</a>`
                    : ""
                }

                <div>
                  <p class="field-hint">Goals</p>
                  <p class="muted small">${escapeHtml(inquiry.goals || "No goals provided.")}</p>
                </div>

                <div class="action-row">
                  <button
                    class="button"
                    type="button"
                    onclick="acceptInquiry('${inquiry.id}')"
                  >
                    Accept
                  </button>

                  <button
                    class="button danger"
                    type="button"
                    onclick="deleteInquiry('${inquiry.id}')"
                  >
                    Reject
                  </button>
                </div>
              </article>
            `;
          })
          .join("")
      : `
        <p class="empty-state">
          No inquiries found.
        </p>
      `;
}

async function acceptInquiry(id) {
  const inquiry =
    inquiries.find(function(item) {
      return item.id === id;
    });

  if (!inquiry) {
    alert("Inquiry not found.");
    return;
  }

  const confirmed =
    confirm(
      `Accept ${inquiry.firstName} ${inquiry.lastName} and create a user?`
    );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      ADMIN_API.acceptInquiry,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          inquiryId: id
        })
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to accept inquiry."
      );
    }

    await Promise.all([
      loadUsers(),
      loadInquiries()
    ]);

    alert(
      data.message ||
      "Inquiry accepted and user created."
    );
  } catch (error) {
    console.error(
      "Accept inquiry error:",
      error
    );

    alert(error.message);
  }
}

async function deleteInquiry(id) {
  const inquiry =
    inquiries.find(function(item) {
      return item.id === id;
    });

  if (!inquiry) {
    alert("Inquiry not found.");
    return;
  }

  const confirmed =
    confirm(
      `Delete the inquiry from ${inquiry.firstName} ${inquiry.lastName}?`
    );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      ADMIN_API.inquiries,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          id
        })
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to delete inquiry."
      );
    }

    await loadInquiries();

    alert(
      "Inquiry deleted successfully."
    );
  } catch (error) {
    console.error(
      "Delete inquiry error:",
      error
    );

    alert(error.message);
  }
}

function fillSelects() {
  const options =
    users
      .map(function(user) {
        return `
          <option value="${user.id}">
            ${escapeHtml(fullName(user))} · ${escapeHtml(user.type)}
          </option>
        `;
      })
      .join("");

  [
    "overviewMessageRecipient",
    "messageRecipient"
  ].forEach(function(id) {
    const element =
      document.getElementById(id);

    if (element) {
      element.innerHTML =
        options ||
        `
          <option value="">
            No users available
          </option>
        `;
    }
  });

  // File uploads only support player accounts (see api/files.js).
  const playerOptions =
    users
      .filter(function(user) {
        return user.type === "Player";
      })
      .map(function(user) {
        return `
          <option value="${user.id}">
            ${escapeHtml(fullName(user))}
          </option>
        `;
      })
      .join("");

  [
    "overviewFileUser",
    "fileWorkspaceUser"
  ].forEach(function(id) {
    const element =
      document.getElementById(id);

    if (element) {
      element.innerHTML =
        playerOptions ||
        `
          <option value="">
            No players available
          </option>
        `;
    }
  });
}

function updateRecipientPreview(selectId, previewId) {
  const select = document.getElementById(selectId);
  const preview = document.getElementById(previewId);
  if (!select || !preview) return;

  const user = users.find(function(item) {
    return item.id === select.value;
  });

  preview.innerHTML = user
    ? `Sending to <strong>${escapeHtml(fullName(user))}</strong> (${escapeHtml(user.type)})`
    : `<span class="muted">Choose a recipient above.</span>`;
}

function renderFiles() {
  const fileCountPill =
    document.getElementById(
      "fileCountPill"
    );

  const fileList =
    document.getElementById(
      "fileList"
    );

  if (!fileCountPill || !fileList) {
    return;
  }

  fileCountPill.textContent =
    `${files.length} files`;

  fileList.innerHTML =
    files.length
      ? files
          .map(function(file) {
            const id =
              file.id ||
              file._id ||
              "";

            const owner =
              users.find(function(user) {
                return (
                  user.id ===
                  String(
                    file.playerId ||
                    file.ownerId ||
                    ""
                  )
                );
              });

            return `
              <div class="file-item">
                <div class="file-head-info">
                  ${avatarHtml(
                    file.uploaderName ||
                    file.uploadedByRole ||
                    "Staff",
                    file.uploaderAvatarUrl,
                    "avatar-sm"
                  )}

                  <div>
                    <strong>
                      ${escapeHtml(
                        file.name ||
                        file.fileName ||
                        "File"
                      )}
                    </strong>

                    <p class="muted small">
                      Assigned to <strong>${escapeHtml(
                        owner
                          ? fullName(owner)
                          : "Unknown player"
                      )}</strong>
                    </p>

                    <p class="muted small">
                      Uploaded by ${escapeHtml(
                        file.uploaderName ||
                        file.uploadedByRole ||
                        "Staff"
                      )}
                      ${
                        formatShortDate(file.createdAt)
                          ? ` · ${escapeHtml(formatShortDate(file.createdAt))}`
                          : ""
                      }
                      ${
                        formatFileSize(file.size)
                          ? ` · ${escapeHtml(formatFileSize(file.size))}`
                          : ""
                      }
                    </p>
                  </div>
                </div>

                <div class="action-row">
                  ${
                    file.url
                      ? `<a class="text-button" href="${escapeHtml(file.url)}" target="_blank" rel="noopener">Open</a>`
                      : ""
                  }

                  <button
                    class="text-button"
                    type="button"
                    onclick="removeFile('${escapeHtml(id)}')"
                  >
                    Remove
                  </button>
                </div>
              </div>
            `;
          })
          .join("")
      : `
        <p class="empty-state">
          No files uploaded yet.
        </p>
      `;
}

async function uploadFileForUser(
  fileInputId,
  userSelectId,
  options = {}
) {
  const input =
    document.getElementById(fileInputId);

  const userSelect =
    document.getElementById(userSelectId);

  const file = input?.files?.[0];
  const playerId = userSelect?.value;

  if (!file || !playerId) {
    alert("Choose a player and a file first.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("playerId", playerId);

    const noteInput =
      options.noteInputId
        ? document.getElementById(options.noteInputId)
        : null;

    if (noteInput?.value.trim()) {
      formData.append("note", noteInput.value.trim());
    }

    const response = await fetch(
      ADMIN_API.files,
      {
        method: "POST",
        credentials: "same-origin",
        body: formData
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to upload file."
      );
    }

    input.value = "";

    if (noteInput) {
      noteInput.value = "";
    }

    if (options.onSuccess) {
      options.onSuccess();
    }

    await loadFiles();
  } catch (error) {
    console.error(
      "Upload file error:",
      error
    );

    alert(error.message);
  }
}

function uploadOverviewFile() {
  uploadFileForUser(
    "overviewFileInput",
    "overviewFileUser"
  );
}

function uploadWorkspaceFile(event) {
  event.preventDefault();

  uploadFileForUser(
    "fileWorkspaceInput",
    "fileWorkspaceUser",
    {
      noteInputId: "fileNote",
      onSuccess: function() {
        event.target.reset();
        closeModal();
      }
    }
  );
}

async function removeFile(id) {
  if (!confirm("Remove this file?")) {
    return;
  }

  try {
    const response = await fetch(
      ADMIN_API.files,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to remove file."
      );
    }

    await loadFiles();
  } catch (error) {
    console.error(
      "Remove file error:",
      error
    );

    alert(error.message);
  }
}

async function addMessage(
  userId,
  type,
  text
) {
  if (
    !userId ||
    !text ||
    !text.trim()
  ) {
    return false;
  }

  try {
    const response = await fetch(
      ADMIN_API.messages,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          userId,
          type,
          text: text.trim()
        })
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Failed to send message."
      );
    }

    await loadMessages();

    return true;
  } catch (error) {
    console.error(
      "Send message error:",
      error
    );

    alert(error.message);

    return false;
  }
}

async function sendOverviewMessage() {
  const input =
    document.getElementById(
      "overviewMessageText"
    );

  const recipient =
    document.getElementById(
      "overviewMessageRecipient"
    );

  const sent =
    await addMessage(
      recipient?.value,
      "Admin Notice",
      input?.value || ""
    );

  if (sent && input) {
    input.value = "";
  }
}

async function sendWorkspaceMessage(
  event
) {
  event.preventDefault();

  const input =
    document.getElementById(
      "messageText"
    );

  const recipient =
    document.getElementById(
      "messageRecipient"
    );

  const messageType =
    document.getElementById(
      "messageType"
    );

  const sent =
    await addMessage(
      recipient?.value,
      messageType?.value ||
        "Admin Notice",
      input?.value || ""
    );

  if (sent) {
    event.target.reset();
    closeModal();
  }
}

function databaseMetrics() {
  return [
    ["Users", users.length],

    [
      "Players",
      users.filter(function(user) {
        return user.type === "Player";
      }).length
    ],

    [
      "Coaches",
      users.filter(function(user) {
        return user.type === "Coach";
      }).length
    ],

    [
      "Advisors",
      users.filter(function(user) {
        return user.type === "Advisor";
      }).length
    ],

    ["Inquiries", inquiries.length],

    ["Files", files.length],

    ["Messages", messages.length],

    ["Needs Action", inquiries.length]
  ];
}

function openDatabase(filter) {
  activeDatabaseFilter =
    filter || "Users";

  renderDatabase();
  showPage("database");
}

function renderDatabase() {
  const metricList =
    document.getElementById(
      "databaseMetricList"
    );

  const results =
    document.getElementById(
      "databaseResults"
    );

  if (!metricList || !results) {
    return;
  }

  const metrics =
    databaseMetrics();

  metricList.innerHTML =
    metrics
      .map(function(metric) {
        const label = metric[0];
        const value = metric[1];

        return `
          <button
            class="database-filter-button ${
              activeDatabaseFilter === label
                ? "active"
                : ""
            }"
            type="button"
            onclick="openDatabase('${label}')"
          >
            <span>${label}</span>
            <strong>${value}</strong>
          </button>
        `;
      })
      .join("");

  let records = [];

  if (
    activeDatabaseFilter === "Users"
  ) {
    records = users;
  }

  if (
    activeDatabaseFilter === "Players"
  ) {
    records =
      users.filter(function(user) {
        return user.type === "Player";
      });
  }

  if (
    activeDatabaseFilter === "Coaches"
  ) {
    records =
      users.filter(function(user) {
        return user.type === "Coach";
      });
  }

  if (
    activeDatabaseFilter === "Advisors"
  ) {
    records =
      users.filter(function(user) {
        return user.type === "Advisor";
      });
  }

  if (
    activeDatabaseFilter === "Inquiries" ||
    activeDatabaseFilter ===
      "Needs Action"
  ) {
    records = inquiries;
  }

  if (
    activeDatabaseFilter === "Files"
  ) {
    records = files;
  }

  if (
    activeDatabaseFilter === "Messages"
  ) {
    records = messages;
  }

  const resultTitle =
    document.getElementById(
      "databaseResultTitle"
    );

  const resultCount =
    document.getElementById(
      "databaseResultCount"
    );

  const subtitle =
    document.getElementById(
      "databaseSubtitle"
    );

  if (resultTitle) {
    resultTitle.textContent =
      activeDatabaseFilter;
  }

  if (resultCount) {
    resultCount.textContent =
      `${records.length} records`;
  }

  if (subtitle) {
    subtitle.textContent =
      `Showing all ${activeDatabaseFilter.toLowerCase()} records.`;
  }

  const bulkButton =
    document.getElementById(
      "bulkSendSetupEmailsButton"
    );

  if (bulkButton) {
    bulkButton.classList.toggle(
      "hidden",
      activeDatabaseFilter !== "Users"
    );
  }

  if (
    [
      "Users",
      "Players",
      "Coaches",
      "Advisors"
    ].includes(activeDatabaseFilter)
  ) {
    results.innerHTML =
      records
        .map(function(user) {
          return `
            <div class="database-record">
              <strong>
                ${escapeHtml(fullName(user))}
              </strong>

              <p class="muted small">
                ${escapeHtml(user.type)}
                ${
                  user.position
                    ? ` · ${escapeHtml(user.position)}`
                    : ""
                }
                ${
                  user.birthYear
                    ? ` · ${escapeHtml(user.birthYear)}`
                    : ""
                }
              </p>

              <p class="muted small">
                ${escapeHtml(user.email || "")}
                ·
                ${escapeHtml(user.phone || "No phone")}
              </p>

              <p class="muted small">
                ${accountStatusBadgeHtml(user)}
              </p>

              <button
                class="text-button"
                type="button"
                onclick="openUser('${user.id}')"
              >
                Open user
              </button>

              ${setupEmailButtonHtml(user)}
            </div>
          `;
        })
        .join("");
  } else if (
    [
      "Inquiries",
      "Needs Action"
    ].includes(activeDatabaseFilter)
  ) {
    results.innerHTML =
      records
        .map(function(inquiry) {
          return `
            <div class="database-record">
              <strong>
                ${escapeHtml(inquiry.firstName || "")}
                ${escapeHtml(inquiry.lastName || "")}
              </strong>

              <p class="muted small">
                ${escapeHtml(inquiry.role || "")}
                ${
                  inquiry.position
                    ? ` · ${escapeHtml(inquiry.position)}`
                    : ""
                }
              </p>

              <p class="muted small">
                ${escapeHtml(inquiry.email || "")}
              </p>

              <button
                class="text-button"
                type="button"
                onclick="showPage('inquiries')"
              >
                Review inquiry
              </button>
            </div>
          `;
        })
        .join("");
  } else if (
    activeDatabaseFilter === "Files"
  ) {
    results.innerHTML =
      records
        .map(function(file) {
          const owner =
            users.find(function(user) {
              return (
                user.id ===
                String(
                  file.playerId ||
                  file.ownerId ||
                  ""
                )
              );
            });

          return `
            <div class="database-record">
              <strong>
                ${escapeHtml(
                  file.name ||
                  file.fileName ||
                  "File"
                )}
              </strong>

              <p class="muted small">
                Assigned to ${escapeHtml(
                  owner
                    ? fullName(owner)
                    : "Unknown player"
                )}
              </p>

              <button
                class="text-button"
                type="button"
                onclick="openUser('${escapeHtml(owner ? owner.id : "")}')"
              >
                Open user
              </button>
            </div>
          `;
        })
        .join("");
  } else if (
    activeDatabaseFilter === "Messages"
  ) {
    results.innerHTML =
      records
        .map(function(message) {
          const owner =
            users.find(function(user) {
              return user.id === String(message.userId || "");
            });

          const playerName =
            owner
              ? fullName(owner)
              : message.to || "Unknown player";

          return `
            <div class="database-record">
              <div class="message-head-info">
                ${avatarHtml(
                  playerName,
                  message.avatarUrl,
                  "avatar-sm"
                )}

                <strong>
                  ${escapeHtml(playerName)}
                </strong>
              </div>

              <p class="muted small">
                ${escapeHtml(message.type || "Message")}
                ·
                ${escapeHtml(message.time || "")}
              </p>

              <p class="muted small">
                ${escapeHtml(message.text || "")}
              </p>
            </div>
          `;
        })
        .join("");
  }

  if (!records.length) {
    results.innerHTML = `
      <p class="muted small">
        No records found.
      </p>
    `;
  }
}

function renderMessages() {
  const countPill =
    document.getElementById(
      "messageCountPill"
    );

  const messageList =
    document.getElementById(
      "messageWorkspaceList"
    );

  if (!countPill || !messageList) {
    return;
  }

  countPill.textContent =
    `${messages.length} messages`;

  messageList.innerHTML =
    messages.length
      ? messages
          .map(function(message) {
            const owner =
              users.find(function(user) {
                return user.id === String(message.userId || "");
              });

            const playerName =
              owner
                ? fullName(owner)
                : message.to || "Unknown player";

            const senderIsPlayer =
              message.senderId
                ? String(message.senderId) === String(message.userId)
                : false;

            const directionLabel =
              senderIsPlayer
                ? `From ${playerName}`
                : `To ${playerName}`;

            return `
              <div class="message-item">
                <div class="message-head-info">
                  ${avatarHtml(
                    playerName,
                    message.avatarUrl,
                    "avatar-sm"
                  )}

                  <div>
                    <strong>
                      ${escapeHtml(playerName)}
                    </strong>

                    <span class="badge badge-role">Player</span>

                    <p class="muted small">
                      ${escapeHtml(directionLabel)}
                      ·
                      ${escapeHtml(message.type || "Message")}
                      ·
                      ${escapeHtml(message.time || "")}
                    </p>
                  </div>
                </div>

                <p class="muted small">
                  ${escapeHtml(message.text || "")}
                </p>
              </div>
            `;
          })
          .join("")
      : `
        <p class="empty-state">
          No messages yet. Send one using the form on the left.
        </p>
      `;
}

function renderEverything() {
  renderOverviewUsers();
  renderOverviewInquiries();
  renderMetrics();
  renderUserWorkspace();
  renderInquiryWorkspace();
  fillSelects();
  updateRecipientPreview("overviewMessageRecipient", "overviewMessageRecipientPreview");
  updateRecipientPreview("messageRecipient", "messageRecipientPreview");
  renderFiles();
  renderMessages();
  renderDatabase();
}

async function logout() {
  try {
    const response = await fetch(
      ADMIN_API.logout,
      {
        method: "POST",
        credentials: "same-origin"
      }
    );

    const data =
      await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        "Unable to log out."
      );
    }

    window.location.replace(
      "/login"
    );
  } catch (error) {
    console.error(
      "Logout error:",
      error
    );

    alert(error.message);
  }
}

async function initializeAdminDashboard() {
  await Promise.allSettled([
    loadUsers(),
    loadInquiries(),
    loadMessages(),
    loadFiles()
  ]);

  renderEverything();
  initNavHistory();
}

initializeAdminDashboard();
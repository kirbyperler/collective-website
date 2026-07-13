let users = [];

async function loadUsers() {
    const response = await fetch("/api/users");
    users = await response.json();

    renderEverything();
}

loadUsers();

const inquiries = [
  { id: "i1", firstName: "Evan", lastName: "Brooks", role: "player", position: "Forward", birthYear: "2010", email: "evan@example.com", phoneNumber: "(203) 555-0160", goals: "Looking for development help before next season." },
  { id: "i2", firstName: "Cole", lastName: "Anderson", role: "player", position: "Defense", birthYear: "2009", email: "cole@example.com", phoneNumber: "(203) 555-0181", goals: "Interested in video review and recruiting guidance." },
  { id: "i3", firstName: "Matt", lastName: "Harris", role: "coach", position: "", birthYear: "", email: "matt@example.com", phoneNumber: "(203) 555-0109", goals: "Wants to discuss camp partnership opportunities." }
];

let messages = [
  { id: "m1", userId: "u1", to: "Owen Schwarz", type: "Advisor Message", text: "Great session today. Focus on your gap control.", time: "2h ago" },
  { id: "m2", userId: "u2", to: "Ryan Carter", type: "Admin Notice", text: "Your new video review has been added.", time: "1d ago" }
];

let selectedUserId = users[0]?.id || null;
let activeDatabaseFilter = "Users";

function fullName(user) { return `${user.firstName} ${user.lastName}`.trim(); }
function initials(name) { return name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase(); }
function makeId(prefix) { return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`; }

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  document.getElementById(`${pageName}Page`)?.classList.add("active");
  document.querySelectorAll(".side-link").forEach(link => link.classList.toggle("active", link.dataset.page === pageName));
  document.getElementById("topbarTitle").textContent = pageName[0].toUpperCase() + pageName.slice(1);
  document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }

function filteredUsers(inputId) {
  const value = document.getElementById(inputId)?.value.toLowerCase().trim() || "";
  return users.filter(user => `${fullName(user)} ${user.type} ${user.email} ${user.phone} ${user.position} ${user.birthYear}`.toLowerCase().includes(value));
}

function renderOverviewUsers() {
  const list = filteredUsers("overviewUserSearch").slice(0, 3);
  document.getElementById("overviewUserTotal").textContent = users.length;
  document.getElementById("overviewUserList").innerHTML = list.length ? list.map(user => `
    <div class="preview-row">
      <div><strong>${fullName(user)}</strong><p class="muted small">${user.type}${user.position ? ` · ${user.position}` : ""}</p></div>
      <button onclick="openUser('${user.id}')">View</button>
    </div>`).join("") : `<p class="muted small">No users found.</p>`;
}

function renderOverviewInquiries() {
  document.getElementById("overviewInquiryTotal").textContent = inquiries.length;
  document.getElementById("overviewInquiryList").innerHTML = inquiries.slice(0, 2).map(inquiry => `
    <div class="preview-row">
      <div><strong>${inquiry.firstName} ${inquiry.lastName}</strong><p class="muted small">${inquiry.role}${inquiry.position ? ` · ${inquiry.position}` : ""}</p></div>
      <button onclick="showPage('inquiries')">Review</button>
    </div>`).join("") || `<p class="muted small">No open inquiries.</p>`;
}

function renderMetrics() {
  const players = users.filter(user => user.type === "Player").length;
  const coaches = users.filter(user => user.type === "Coach").length;
  const advisors = users.filter(user => user.type === "Advisor").length;
  const files = users.reduce(
    (total, user) => total + (user.files?.length || 0),
    0
  );
  const metrics = [["Users", users.length], ["Players", players], ["Coaches", coaches], ["Advisors", advisors], ["Inquiries", inquiries.length], ["Files", files], ["Messages", messages.length], ["Needs Action", inquiries.length]];
  document.getElementById("metricsGrid").innerHTML = metrics.map(([label, value]) => `<button class="metric-box" onclick="openDatabase('${label}')"><span>${label}</span><strong>${value}</strong></button>`).join("");
  document.getElementById("overviewFileTotal").textContent = files;
  document.getElementById("overviewMessageTotal").textContent = messages.length;
}

function renderUserWorkspace() {
  const list = filteredUsers("userWorkspaceSearch");
  document.getElementById("userWorkspaceCount").textContent = `${list.length} users`;
  document.getElementById("userWorkspaceList").innerHTML = list.map(user => `
    <button class="user-button ${user.id === selectedUserId ? "active" : ""}" onclick="selectUser('${user.id}')">
      <div class="avatar">${initials(fullName(user))}</div>
      <div><strong>${fullName(user)}</strong><p class="muted small">${user.type} · ${user.email}</p></div>
      <span class="pill">Edit</span>
    </button>`).join("") || `<p class="muted small">No users found.</p>`;
}

function openUser(id) { selectUser(id); showPage("users"); }

function selectUser(id) {
  selectedUserId = id;
  const user = users.find(item => item.id === id);
  if (!user) return;
  document.getElementById("userFormTitle").textContent = `Update ${fullName(user)}`;
  document.getElementById("userId").value = user.id;
  document.getElementById("firstName").value = user.firstName;
  document.getElementById("lastName").value = user.lastName;
  document.getElementById("email").value = user.email;
  document.getElementById("phone").value = user.phone;
  document.getElementById("type").value = user.type;
  document.getElementById("birthYear").value = user.birthYear;
  document.getElementById("position").value = user.position;
  document.getElementById("eliteProspects").value = user.eliteProspects;
  document.getElementById("deleteUserButton").classList.remove("hidden");
  renderUserWorkspace();
}

function resetUserForm() {
  selectedUserId = null;
  document.getElementById("userForm").reset();
  document.getElementById("userId").value = "";
  document.getElementById("userFormTitle").textContent = "Add User";
  document.getElementById("deleteUserButton").classList.add("hidden");
  renderUserWorkspace();
}

async function saveUser(event) {
  event.preventDefault();

  const id = document.getElementById("userId").value;

  const userData = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    type: document.getElementById("type").value,
    birthYear: document.getElementById("birthYear").value.trim(),
    position: document.getElementById("position").value.trim(),
    eliteProspects: document
      .getElementById("eliteProspects")
      .value.trim()
  };

  if (
    !userData.firstName ||
    !userData.lastName ||
    !userData.email ||
    !userData.type
  ) {
    alert("First name, last name, email, and type are required.");
    return;
  }

  try {
    const method = id ? "PATCH" : "POST";

    const body = id
      ? {
          id,
          ...userData
        }
      : userData;

    const response = await fetch("/api/users", {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to save user.");
    }

    if (id) {
      selectedUserId = id;
    } else {
      selectedUserId = String(
        data.user?._id ||
        data.id ||
        ""
      );
    }

    await loadUsers();

    alert(id ? "User updated successfully." : "User created successfully.");
  } catch (error) {
    console.error("Save user error:", error);
    alert(error.message);
  }
}

async function deleteSelectedUser() {
  if (!selectedUserId) {
    alert("Select a user first.");
    return;
  }

  const user = users.find(function(item) {
    return item.id === selectedUserId;
  });

  if (!user) {
    alert("User not found.");
    return;
  }

  const confirmed = confirm(
    `Delete ${fullName(user)}? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch("/api/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: selectedUserId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to delete user.");
    }

    selectedUserId = null;

    await loadUsers();

    alert("User deleted successfully.");
  } catch (error) {
    console.error("Delete user error:", error);
    alert(error.message);
  }
}

function renderInquiryWorkspace() {
  const value = document.getElementById("inquirySearch")?.value.toLowerCase().trim() || "";
  const list = inquiries.filter(inquiry => `${inquiry.firstName} ${inquiry.lastName} ${inquiry.email} ${inquiry.role} ${inquiry.position}`.toLowerCase().includes(value));
  document.getElementById("inquiryWorkspaceList").innerHTML = list.map(inquiry => `
    <article class="card inquiry-item">
      <strong>${inquiry.firstName} ${inquiry.lastName}</strong>
      <p class="muted small">${inquiry.role}${inquiry.position ? ` · ${inquiry.position}` : ""}${inquiry.birthYear ? ` · ${inquiry.birthYear}` : ""}</p>
      <p class="muted small">${inquiry.email} · ${inquiry.phoneNumber}</p>
      <p class="muted small">${inquiry.goals}</p>
      <div class="action-row"><button class="button" onclick="acceptInquiry('${inquiry.id}')">Accept</button><button class="button secondary" onclick="deleteInquiry('${inquiry.id}')">Delete</button></div>
    </article>`).join("") || `<p class="muted">No inquiries found.</p>`;
}

function acceptInquiry(id) {
  const inquiry = inquiries.find(item => item.id === id);
  if (!inquiry || !confirm("Accept this inquiry and create a user?")) return;
  const user = { id: makeId("u"), type: inquiry.role[0].toUpperCase() + inquiry.role.slice(1), firstName: inquiry.firstName, lastName: inquiry.lastName, birthYear: inquiry.birthYear, email: inquiry.email, phone: inquiry.phoneNumber, position: inquiry.position, eliteProspects: "", files: [] };
  users.unshift(user);
  inquiries.splice(inquiries.findIndex(item => item.id === id), 1);
  selectedUserId = user.id;
  renderEverything();
}

function deleteInquiry(id) {
  const index = inquiries.findIndex(item => item.id === id);
  if (index < 0 || !confirm("Delete this inquiry?")) return;
  inquiries.splice(index, 1);
  renderEverything();
}

function fillSelects() {
  const options = users.map(user => `<option value="${user.id}">${fullName(user)} · ${user.type}</option>`).join("");
  ["overviewFileUser", "fileWorkspaceUser", "overviewMessageRecipient", "messageRecipient"].forEach(id => { const element = document.getElementById(id); if (element) element.innerHTML = options; });
}

function renderFiles() {
  const files = users.flatMap(function(user) {
    return (user.files || []).map(function(file) {
      return {
        file,
        user: fullName(user),
        userId: user.id
      };
    });
  });
  document.getElementById("fileCountPill").textContent = `${files.length} files`;
  document.getElementById("fileList").innerHTML = files.map(item => `<div class="file-item"><strong>${item.file}</strong><p class="muted small">Assigned to ${item.user}</p><button class="text-button" onclick="removeFile('${item.userId}', '${item.file.replaceAll("'", "\\'")}')">Remove</button></div>`).join("") || `<p class="muted small">No files uploaded.</p>`;
}

function addFileToUser(userId, fileName) {
  const user = users.find(item => item.id === userId);
  if (!user || !fileName) return false;
  user.files.unshift(fileName);
  renderEverything();
  return true;
}

function uploadOverviewFile() {
  const input = document.getElementById("overviewFileInput");
  if (addFileToUser(document.getElementById("overviewFileUser").value, input.files[0]?.name)) input.value = "";
}

function uploadWorkspaceFile(event) {
  event.preventDefault();
  const input = document.getElementById("fileWorkspaceInput");
  if (addFileToUser(document.getElementById("fileWorkspaceUser").value, input.files[0]?.name)) event.target.reset();
}

function removeFile(userId, fileName) {
  const user = users.find(item => item.id === userId);
  if (!user || !confirm("Remove this file?")) return;
  user.files = user.files.filter(file => file !== fileName);
  renderEverything();
}

function addMessage(userId, type, text) {
  const user = users.find(item => item.id === userId);
  if (!user || !text.trim()) return false;
  messages.unshift({ id: makeId("m"), userId, to: fullName(user), type, text: text.trim(), time: "Just now" });
  renderEverything();
  return true;
}

function sendOverviewMessage() {
  const input = document.getElementById("overviewMessageText");
  if (addMessage(document.getElementById("overviewMessageRecipient").value, "Admin Notice", input.value)) input.value = "";
}

function sendWorkspaceMessage(event) {
  event.preventDefault();
  const input = document.getElementById("messageText");
  if (addMessage(document.getElementById("messageRecipient").value, document.getElementById("messageType").value, input.value)) event.target.reset();
}

function renderMessages() {
  document.getElementById("messageCountPill").textContent = `${messages.length} messages`;
  document.getElementById("messageWorkspaceList").innerHTML = messages.map(message => `<div class="message-item"><strong>${message.to}</strong><p class="muted small">${message.type} · ${message.time}</p><p class="muted small">${message.text}</p></div>`).join("") || `<p class="muted small">No messages yet.</p>`;
}


function databaseMetrics() {
  return [
    ["Users", users.length],
    ["Players", users.filter(user => user.type === "Player").length],
    ["Coaches", users.filter(user => user.type === "Coach").length],
    ["Advisors", users.filter(user => user.type === "Advisor").length],
    ["Inquiries", inquiries.length],
    [
      "Files",
      users.reduce(
        (total, user) => total + (user.files?.length || 0),
        0
      )
    ],    
    ["Messages", messages.length],
    ["Needs Action", inquiries.length]
  ];
}

function openDatabase(filter) {
  activeDatabaseFilter = filter || "Users";
  renderDatabase();
  showPage("database");
}

function renderDatabase() {
  const metricList = document.getElementById("databaseMetricList");
  const results = document.getElementById("databaseResults");
  if (!metricList || !results) return;

  const metrics = databaseMetrics();
  metricList.innerHTML = metrics.map(([label, value]) => `
    <button class="database-filter-button ${activeDatabaseFilter === label ? "active" : ""}" onclick="openDatabase('${label}')">
      <span>${label}</span><strong>${value}</strong>
    </button>`).join("");

  let records = [];
  if (activeDatabaseFilter === "Users") records = users;
  if (activeDatabaseFilter === "Players") records = users.filter(user => user.type === "Player");
  if (activeDatabaseFilter === "Coaches") records = users.filter(user => user.type === "Coach");
  if (activeDatabaseFilter === "Advisors") records = users.filter(user => user.type === "Advisor");
  if (activeDatabaseFilter === "Inquiries" || activeDatabaseFilter === "Needs Action") records = inquiries;
  if (activeDatabaseFilter === "Files") records = users.flatMap(user => user.files.map(file => ({ file, user: fullName(user), userId: user.id })));
  if (activeDatabaseFilter === "Messages") records = messages;

  document.getElementById("databaseResultTitle").textContent = activeDatabaseFilter;
  document.getElementById("databaseResultCount").textContent = `${records.length} records`;
  document.getElementById("databaseSubtitle").textContent = `Showing all ${activeDatabaseFilter.toLowerCase()} records.`;

  if (["Users", "Players", "Coaches", "Advisors"].includes(activeDatabaseFilter)) {
    results.innerHTML = records.map(user => `<div class="database-record"><strong>${fullName(user)}</strong><p class="muted small">${user.type}${user.position ? ` · ${user.position}` : ""}${user.birthYear ? ` · ${user.birthYear}` : ""}</p><p class="muted small">${user.email} · ${user.phone || "No phone"}</p><button class="text-button" onclick="openUser('${user.id}')">Open user</button></div>`).join("");
  } else if (["Inquiries", "Needs Action"].includes(activeDatabaseFilter)) {
    results.innerHTML = records.map(inquiry => `<div class="database-record"><strong>${inquiry.firstName} ${inquiry.lastName}</strong><p class="muted small">${inquiry.role}${inquiry.position ? ` · ${inquiry.position}` : ""}</p><p class="muted small">${inquiry.email}</p><button class="text-button" onclick="showPage('inquiries')">Review inquiry</button></div>`).join("");
  } else if (activeDatabaseFilter === "Files") {
    results.innerHTML = records.map(item => `<div class="database-record"><strong>${item.file}</strong><p class="muted small">Assigned to ${item.user}</p><button class="text-button" onclick="openUser('${item.userId}')">Open user</button></div>`).join("");
  } else if (activeDatabaseFilter === "Messages") {
    results.innerHTML = records.map(message => `<div class="database-record"><strong>${message.to}</strong><p class="muted small">${message.type} · ${message.time}</p><p class="muted small">${message.text}</p></div>`).join("");
  }

  if (!records.length) results.innerHTML = `<p class="muted small">No records found.</p>`;
}

function renderEverything() {
  renderOverviewUsers();
  renderOverviewInquiries();
  renderMetrics();
  renderUserWorkspace();
  renderInquiryWorkspace();
  fillSelects();
  renderFiles();
  renderMessages();
  renderDatabase();
}

loadUsers();
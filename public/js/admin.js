let users = [];
let selectedUserId = null;

async function loadUsers() {
  try {
    const response = await fetch("/api/users");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load users.");
    }

    users = data.map(function(user) {
      return {
        ...user,
        id: String(user._id),
        type: user.type || "Player",
        birthYear: user.birthYear || "",
        position: user.position || "",
        eliteProspects: user.eliteProspects || "",
        phone: user.phone || "",
        files: Array.isArray(user.files) ? user.files : []
      };
    });

    if (
      !selectedUserId ||
      !users.some(function(user) {
        return user.id === selectedUserId;
      })
    ) {
      selectedUserId = null;
    }

    renderEverything();
  } catch (error) {
    console.error("Load users error:", error);
    alert(error.message);
  }
}

let inquiries = [];

async function loadInquiries() {
  try {
    const response = await fetch("/api/inquiries");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load inquiries.");
    }

    inquiries = data.map(function(inquiry) {
      return {
        ...inquiry,
        id: String(inquiry._id)
      };
    });

    renderEverything();
  } catch (error) {
    console.error("Load inquiries error:", error);
    alert(error.message);
  }
}

let messages = [];

async function loadMessages() {
  try {
    const response = await fetch("/api/messages");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load messages.");
    }

    messages = data.map(function(message) {
      return {
        ...message,
        id: String(message._id),
        userId: String(message.userId),
        time: new Date(message.createdAt).toLocaleString()
      };
    });

    renderEverything();
  } catch (error) {
    console.error("Load messages error:", error);
  }
}

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

  const user = users.find(function(item) {
    return item.id === id;
  });

  if (!user) {
    console.error("User not found:", id);
    return;
  }

  document.getElementById("userFormTitle").textContent =
    `Update ${fullName(user)}`;

  document.getElementById("userId").value = user.id;
  document.getElementById("firstName").value = user.firstName || "";
  document.getElementById("lastName").value = user.lastName || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("phone").value = user.phone || "";
  document.getElementById("type").value = user.type || "Player";
  document.getElementById("birthYear").value = user.birthYear || "";
  document.getElementById("position").value = user.position || "";
  document.getElementById("eliteProspects").value =
    user.eliteProspects || "";

  document
    .getElementById("deleteUserButton")
    .classList.remove("hidden");

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

async function acceptInquiry(id) {
  const inquiry = inquiries.find(function(item) {
    return item.id === id;
  });

  if (!inquiry) {
    alert("Inquiry not found.");
    return;
  }

  const confirmed = confirm(
    `Accept ${inquiry.firstName} ${inquiry.lastName} and create a user?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch("/api/accept-inquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inquiryId: id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to accept inquiry.");
    }

    await Promise.all([
      loadUsers(),
      loadInquiries()
    ]);

    alert("Inquiry accepted and user created.");
  } catch (error) {
    console.error("Accept inquiry error:", error);
    alert(error.message);
  }
}

async function deleteInquiry(id) {
  const inquiry = inquiries.find(function(item) {
    return item.id === id;
  });

  if (!inquiry) {
    alert("Inquiry not found.");
    return;
  }

  const confirmed = confirm(
    `Delete the inquiry from ${inquiry.firstName} ${inquiry.lastName}?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch("/api/inquiries", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to delete inquiry.");
    }

    await loadInquiries();

    alert("Inquiry deleted successfully.");
  } catch (error) {
    console.error("Delete inquiry error:", error);
    alert(error.message);
  }
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

async function addMessage(userId, type, text) {
  if (!userId || !text.trim()) {
    return false;
  }

  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        type,
        text: text.trim()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send message.");
    }

    await loadMessages();

    return true;
  } catch (error) {
    console.error("Send message error:", error);
    alert(error.message);
    return false;
  }
}

async function sendOverviewMessage() {
  const input = document.getElementById("overviewMessageText");

  const sent = await addMessage(
    document.getElementById("overviewMessageRecipient").value,
    "Admin Notice",
    input.value
  );

  if (sent) {
    input.value = "";
  }
}

async function sendWorkspaceMessage(event) {
  event.preventDefault();

  const input = document.getElementById("messageText");

  const sent = await addMessage(
    document.getElementById("messageRecipient").value,
    document.getElementById("messageType").value,
    input.value
  );

  if (sent) {
    event.target.reset();
  }
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
loadInquiries();
loadMessages();
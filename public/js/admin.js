const ADMIN_API = {
  users: "/api/admin?action=users",
  messages: "/api/admin?action=messages",
  acceptInquiry: "/api/admin?action=accept-inquiry",
  progress: "/api/admin?action=progress",
  inquiries: "/api/inquiries",
  files: "/api/files?action=files",
  logout: "/api/auth?action=logout"
};

let users = [];
let selectedUserId = null;

let inquiries = [];
let messages = [];

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

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map(function(part) {
      return part[0];
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function showPage(pageName) {
  document
    .querySelectorAll(".page")
    .forEach(function(page) {
      page.classList.remove("active");
    });

  document
    .getElementById(`${pageName}Page`)
    ?.classList.add("active");

  document
    .querySelectorAll(".side-link")
    .forEach(function(link) {
      link.classList.toggle(
        "active",
        link.dataset.page === pageName
      );
    });

  const topbarTitle =
    document.getElementById("topbarTitle");

  if (topbarTitle) {
    topbarTitle.textContent =
      pageName.charAt(0).toUpperCase() +
      pageName.slice(1);
  }

  document
    .getElementById("sidebar")
    ?.classList.remove("open");
}

function toggleSidebar() {
  document
    .getElementById("sidebar")
    ?.classList.toggle("open");
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
        phone: user.phone || "",
        files: Array.isArray(user.files)
          ? user.files
          : []
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
                    ${fullName(user)}
                  </strong>

                  <p class="muted small">
                    ${user.type}
                    ${
                      user.position
                        ? ` · ${user.position}`
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
                    ${inquiry.firstName || ""}
                    ${inquiry.lastName || ""}
                  </strong>

                  <p class="muted small">
                    ${inquiry.role || ""}
                    ${
                      inquiry.position
                        ? ` · ${inquiry.position}`
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

  const fileTotal =
    users.reduce(
      function(total, user) {
        return (
          total +
          (Array.isArray(user.files)
            ? user.files.length
            : 0)
        );
      },
      0
    );

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
                  ${initials(fullName(user))}
                </div>

                <div>
                  <strong>
                    ${fullName(user)}
                  </strong>

                  <p class="muted small">
                    ${user.type} ·
                    ${user.email || ""}
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
  selectUser(id);
  showPage("users");
}

function selectUser(id) {
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

  document
    .getElementById(
      "deleteUserButton"
    )
    .classList.remove("hidden");

  renderUserWorkspace();
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

  document
    .getElementById(
      "deleteUserButton"
    )
    .classList.add("hidden");

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
            return `
              <article class="card inquiry-item">
                <strong>
                  ${inquiry.firstName || ""}
                  ${inquiry.lastName || ""}
                </strong>

                <p class="muted small">
                  ${inquiry.role || ""}
                  ${
                    inquiry.position
                      ? ` · ${inquiry.position}`
                      : ""
                  }
                  ${
                    inquiry.birthYear
                      ? ` · ${inquiry.birthYear}`
                      : ""
                  }
                </p>

                <p class="muted small">
                  ${inquiry.email || ""}
                  ${
                    inquiry.phoneNumber
                      ? ` · ${inquiry.phoneNumber}`
                      : ""
                  }
                </p>

                <p class="muted small">
                  ${inquiry.goals || ""}
                </p>

                <div class="action-row">
                  <button
                    class="button"
                    type="button"
                    onclick="acceptInquiry('${inquiry.id}')"
                  >
                    Accept
                  </button>

                  <button
                    class="button secondary"
                    type="button"
                    onclick="deleteInquiry('${inquiry.id}')"
                  >
                    Delete
                  </button>
                </div>
              </article>
            `;
          })
          .join("")
      : `
        <p class="muted">
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
            ${fullName(user)} · ${user.type}
          </option>
        `;
      })
      .join("");

  [
    "overviewFileUser",
    "fileWorkspaceUser",
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

  const allFiles =
    users.flatMap(function(user) {
      return (
        Array.isArray(user.files)
          ? user.files
          : []
      ).map(function(file) {
        return {
          file,
          user: fullName(user),
          userId: user.id
        };
      });
    });

  fileCountPill.textContent =
    `${allFiles.length} files`;

  fileList.innerHTML =
    allFiles.length
      ? allFiles
          .map(function(item) {
            const fileName =
              typeof item.file === "string"
                ? item.file
                : item.file.fileName ||
                  item.file.name ||
                  "File";

            return `
              <div class="file-item">
                <strong>
                  ${fileName}
                </strong>

                <p class="muted small">
                  Assigned to ${item.user}
                </p>

                <button
                  class="text-button"
                  type="button"
                  onclick="removeFile('${item.userId}', '${String(fileName).replaceAll("'", "\\'")}')"
                >
                  Remove
                </button>
              </div>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No files uploaded.
        </p>
      `;
}

function addFileToUser(
  userId,
  fileName
) {
  const user =
    users.find(function(item) {
      return item.id === userId;
    });

  if (!user || !fileName) {
    return false;
  }

  if (!Array.isArray(user.files)) {
    user.files = [];
  }

  user.files.unshift(fileName);

  renderEverything();

  return true;
}

function uploadOverviewFile() {
  const input =
    document.getElementById(
      "overviewFileInput"
    );

  const userSelect =
    document.getElementById(
      "overviewFileUser"
    );

  const fileName =
    input?.files?.[0]?.name;

  if (
    addFileToUser(
      userSelect?.value,
      fileName
    )
  ) {
    input.value = "";
  }
}

function uploadWorkspaceFile(event) {
  event.preventDefault();

  const input =
    document.getElementById(
      "fileWorkspaceInput"
    );

  const userSelect =
    document.getElementById(
      "fileWorkspaceUser"
    );

  const fileName =
    input?.files?.[0]?.name;

  if (
    addFileToUser(
      userSelect?.value,
      fileName
    )
  ) {
    event.target.reset();
  }
}

function removeFile(
  userId,
  fileName
) {
  const user =
    users.find(function(item) {
      return item.id === userId;
    });

  if (
    !user ||
    !confirm("Remove this file?")
  ) {
    return;
  }

  user.files =
    user.files.filter(function(file) {
      const currentName =
        typeof file === "string"
          ? file
          : file.fileName ||
            file.name;

      return currentName !== fileName;
    });

  renderEverything();
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

    [
      "Files",
      users.reduce(
        function(total, user) {
          return (
            total +
            (
              Array.isArray(user.files)
                ? user.files.length
                : 0
            )
          );
        },
        0
      )
    ],

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
    records =
      users.flatMap(function(user) {
        return (
          Array.isArray(user.files)
            ? user.files
            : []
        ).map(function(file) {
          return {
            file,
            user: fullName(user),
            userId: user.id
          };
        });
      });
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
                ${fullName(user)}
              </strong>

              <p class="muted small">
                ${user.type}
                ${
                  user.position
                    ? ` · ${user.position}`
                    : ""
                }
                ${
                  user.birthYear
                    ? ` · ${user.birthYear}`
                    : ""
                }
              </p>

              <p class="muted small">
                ${user.email || ""}
                ·
                ${user.phone || "No phone"}
              </p>

              <button
                class="text-button"
                type="button"
                onclick="openUser('${user.id}')"
              >
                Open user
              </button>
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
                ${inquiry.firstName || ""}
                ${inquiry.lastName || ""}
              </strong>

              <p class="muted small">
                ${inquiry.role || ""}
                ${
                  inquiry.position
                    ? ` · ${inquiry.position}`
                    : ""
                }
              </p>

              <p class="muted small">
                ${inquiry.email || ""}
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
        .map(function(item) {
          const fileName =
            typeof item.file === "string"
              ? item.file
              : item.file.fileName ||
                item.file.name ||
                "File";

          return `
            <div class="database-record">
              <strong>
                ${fileName}
              </strong>

              <p class="muted small">
                Assigned to ${item.user}
              </p>

              <button
                class="text-button"
                type="button"
                onclick="openUser('${item.userId}')"
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
          return `
            <div class="database-record">
              <strong>
                ${message.to || "Unknown user"}
              </strong>

              <p class="muted small">
                ${message.type || "Message"}
                ·
                ${message.time || ""}
              </p>

              <p class="muted small">
                ${message.text || ""}
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
            return `
              <div class="message-item">
                <strong>
                  ${message.to || "Unknown user"}
                </strong>

                <p class="muted small">
                  ${message.type || "Message"}
                  ·
                  ${message.time || ""}
                </p>

                <p class="muted small">
                  ${message.text || ""}
                </p>
              </div>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No messages yet.
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
    loadMessages()
  ]);

  renderEverything();
}

initializeAdminDashboard();
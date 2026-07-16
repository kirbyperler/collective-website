const API = {
  me: "/api/player?action=me",
  messages: "/api/player?action=messages",
  programs: "/api/player?action=programs",
  files: "/api/files?action=files",
  progress: "/api/player?action=progress",
  contacts: "/api/player?action=contacts",
  avatar: "/api/files?action=avatar",
  logout: "/api/auth?action=logout"
};

let player = null;
let messages = [];

let programs = {
  interestedInPlayer: [],
  playerInterested: []
};

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
  return String(value).replace(
    /[&<>'"]/g,
    function(character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      }[character];
    }
  );
}

async function apiRequest(
  url,
  options = {}
) {
  const response = await fetch(
    url,
    {
      credentials: "same-origin",
      ...options
    }
  );

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  let data;

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    data = await response.json();
  } else {
    data = {
      error: await response.text()
    };
  }

  if (response.status === 401) {
    window.location.replace(
      "/login"
    );

    throw new Error(
      "Your session has expired."
    );
  }

  if (!response.ok) {
    console.error(
      "Failed API request:",
      url,
      response.status,
      data
    );

    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed: ${url}`
    );
  }

  return data;
}

function showPage(pageName) {
  document
    .querySelectorAll(".page")
    .forEach(function(page) {
      page.classList.remove(
        "active"
      );
    });

  const selectedPage =
    document.getElementById(
      `${pageName}Page`
    );

  if (selectedPage) {
    selectedPage.classList.add(
      "active"
    );
  }

  document
    .querySelectorAll(
      ".side-link"
    )
    .forEach(function(link) {
      link.classList.toggle(
        "active",
        link.dataset.page ===
          pageName
      );
    });

  const title =
    document.getElementById(
      "topbarTitle"
    );

  if (title) {
    title.textContent =
      pageName
        .charAt(0)
        .toUpperCase() +
      pageName.slice(1);
  }

  document
    .getElementById(
      "sidebar"
    )
    ?.classList.remove("open");
}

function toggleSidebar() {
  document
    .getElementById(
      "sidebar"
    )
    ?.classList.toggle("open");
}

function setProfilePanel(panel) {
  document
    .querySelectorAll(
      ".profile-panel"
    )
    .forEach(function(item) {
      item.classList.remove(
        "active"
      );
    });

  const panelName =
    panel.charAt(0).toUpperCase() +
    panel.slice(1);

  document
    .getElementById(
      `profile${panelName}Panel`
    )
    ?.classList.add("active");

  document
    .querySelectorAll(".segment")
    .forEach(function(button) {
      button.classList.toggle(
        "active",
        button.dataset.profilePanel ===
          panel
      );
    });
}

function allowedRecruitingLevels(
  status
) {
  const map = {
    Youth: [
      "Prep",
      "Juniors",
      "College"
    ],

    Prep: [
      "Juniors",
      "College"
    ],

    Juniors: [
      "College"
    ],

    College: [
      "Pro"
    ],

    Pro: [
      "Pro"
    ]
  };

  return map[status] || [];
}

async function loadDashboard() {
  try {
    /*
     * Load the logged-in player first.
     * This request is required.
     */
    const meData =
      await apiRequest(API.me);

    if (!meData?.player) {
      throw new Error(
        "The player API did not return player information."
      );
    }

    player = {
      ...emptyPlayer,
      ...meData.player
    };

    console.log(
      "Logged-in player:",
      player
    );

    /*
     * Display the player immediately.
     * Other API requests cannot prevent
     * the name and profile from showing.
     */
    fillProfileForm();
    fillRecruitingLevels();
    renderOverview();
    renderProfile();

    /*
     * Load optional dashboard sections.
     */
    const results =
      await Promise.allSettled([
        apiRequest(API.messages),
        apiRequest(API.programs),
        apiRequest(API.files),
        apiRequest(API.progress),
        apiRequest(API.contacts)
      ]);

    const messageResult =
      results[0];

    const programResult =
      results[1];

    const fileResult =
      results[2];

    const progressResult =
      results[3];

    const contactResult =
      results[4];

    if (
      messageResult.status ===
      "fulfilled"
    ) {
      messages =
        Array.isArray(
          messageResult.value
            ?.messages
        )
          ? messageResult.value
              .messages
          : [];
    } else {
      messages = [];

      console.error(
        "Messages failed:",
        messageResult.reason
      );
    }

    if (
      programResult.status ===
      "fulfilled"
    ) {
      programs = {
        interestedInPlayer:
          Array.isArray(
            programResult.value
              ?.interestedInPlayer
          )
            ? programResult.value
                .interestedInPlayer
            : [],

        playerInterested:
          Array.isArray(
            programResult.value
              ?.playerInterested
          )
            ? programResult.value
                .playerInterested
            : []
      };
    } else {
      programs = {
        interestedInPlayer: [],
        playerInterested: []
      };

      console.error(
        "Programs failed:",
        programResult.reason
      );
    }

    if (
      fileResult.status ===
      "fulfilled"
    ) {
      files =
        Array.isArray(
          fileResult.value?.files
        )
          ? fileResult.value.files
          : [];
    } else {
      files = [];

      console.error(
        "Files failed:",
        fileResult.reason
      );
    }

    if (
      progressResult.status ===
      "fulfilled"
    ) {
      progressRatings =
        Array.isArray(
          progressResult.value
            ?.ratings
        )
          ? progressResult.value
              .ratings
          : [];
    } else {
      progressRatings = [];

      console.error(
        "Progress failed:",
        progressResult.reason
      );
    }

    if (
      contactResult.status ===
      "fulfilled"
    ) {
      contacts =
        Array.isArray(
          contactResult.value
            ?.contacts
        )
          ? contactResult.value
              .contacts
          : [];
    } else {
      contacts = [];

      console.error(
        "Contacts failed:",
        contactResult.reason
      );
    }

    fillContacts();
    fillRecruitingLevels();
    renderEverything();
  } catch (error) {
    console.error(
      "Dashboard load error:",
      error
    );

    const welcomeName =
      document.getElementById(
        "welcomeName"
      );

    if (welcomeName) {
      welcomeName.textContent =
        "Unable to load player";
    }

    alert(error.message);
  }
}

function fullName() {
  if (!player) {
    return "Player";
  }

  return (
    `${player.firstName || ""} ${player.lastName || ""}`
      .trim() ||
    "Player"
  );
}

function capitalize(value) {
  const text =
    String(value || "");

  if (!text) {
    return "";
  }

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

function fillProfileForm() {
  if (!player) {
    return;
  }

  const fields = [
    "firstName",
    "lastName",
    "birthYear",
    "position",
    "currentTeam",
    "shoots",
    "height",
    "weight",
    "email",
    "phone",
    "careerStatus",
    "bio"
  ];

  fields.forEach(function(id) {
    const element =
      document.getElementById(id);

    if (!element) {
      console.warn(
        `Missing profile field: #${id}`
      );

      return;
    }

    element.value =
      player[id] || "";
  });
}

function fillContacts() {
  const select =
    document.getElementById(
      "messageRecipient"
    );

  if (!select) {
    return;
  }

  if (!contacts.length) {
    select.innerHTML = `
      <option value="">
        No staff contacts available
      </option>
    `;

    return;
  }

  select.innerHTML =
    contacts
      .map(function(contact) {
        const id =
          contact.id ||
          contact._id ||
          "";

        const name =
          contact.name ||
          `${contact.firstName || ""} ${contact.lastName || ""}`
            .trim() ||
          "Staff";

        const role =
          contact.role ||
          contact.type ||
          "Staff";

        return `
          <option value="${escapeHtml(id)}">
            ${escapeHtml(name)} · ${escapeHtml(role)}
          </option>
        `;
      })
      .join("");
}

function fillRecruitingLevels() {
  const levels =
    allowedRecruitingLevels(
      player?.careerStatus ||
      "Youth"
    );

  [
    "interestedInPlayerLevel",
    "playerInterestedLevel"
  ].forEach(function(id) {
    const select =
      document.getElementById(id);

    if (!select) {
      return;
    }

    select.innerHTML =
      levels.length
        ? levels
            .map(function(level) {
              return `
                <option value="${escapeHtml(level)}">
                  ${escapeHtml(level)}
                </option>
              `;
            })
            .join("")
        : `
          <option value="Pro">
            Pro
          </option>
        `;
  });
}

function setAvatar(url) {
  [
    "overviewAvatar",
    "profileAvatar",
    "stageAvatar"
  ].forEach(function(id) {
    const image =
      document.getElementById(id);

    if (!image) {
      return;
    }

    image.src = url || "";
    image.hidden = !url;
  });

  [
    "overviewAvatarPlaceholder",
    "profileAvatarPlaceholder",
    "stageAvatarPlaceholder"
  ].forEach(function(id) {
    const placeholder =
      document.getElementById(id);

    if (!placeholder) {
      return;
    }

    placeholder.hidden =
      Boolean(url);
  });
}

function renderOverview() {
  if (!player) {
    return;
  }

  const welcomeName =
    document.getElementById(
      "welcomeName"
    );

  if (welcomeName) {
    welcomeName.textContent =
      `Welcome back, ${
        player.firstName ||
        "Player"
      }`;
  }

  const overviewPosition =
    document.getElementById(
      "overviewPosition"
    );

  if (overviewPosition) {
    overviewPosition.textContent =
      capitalize(
        player.position
      ) || "Player";
  }

  const welcomeMeta =
    document.getElementById(
      "welcomeMeta"
    );

  if (welcomeMeta) {
    const meta = [
      player.currentTeam,
      player.birthYear
    ]
      .filter(Boolean)
      .join(" · ");

    welcomeMeta.textContent =
      meta ||
      "Your development dashboard is ready.";
  }

  const overviewCareerStatus =
    document.getElementById(
      "overviewCareerStatus"
    );

  if (overviewCareerStatus) {
    overviewCareerStatus.textContent =
      player.careerStatus ||
      "Youth";
  }

  const overviewProfile =
    document.getElementById(
      "overviewProfile"
    );

  if (overviewProfile) {
    overviewProfile.innerHTML = `
      <div class="profile-facts">
        <div class="fact-box">
          <span>Name</span>

          <strong>
            ${escapeHtml(fullName())}
          </strong>
        </div>

        <div class="fact-box">
          <span>Team</span>

          <strong>
            ${escapeHtml(
              player.currentTeam ||
              "Not set"
            )}
          </strong>
        </div>

        <div class="fact-box">
          <span>Birth Year</span>

          <strong>
            ${escapeHtml(
              player.birthYear ||
              "—"
            )}
          </strong>
        </div>

        <div class="fact-box">
          <span>Position</span>

          <strong>
            ${escapeHtml(
              capitalize(
                player.position
              ) || "—"
            )}
          </strong>
        </div>

        <div class="fact-box">
          <span>Height</span>

          <strong>
            ${escapeHtml(
              player.height ||
              "—"
            )}
          </strong>
        </div>

        <div class="fact-box">
          <span>Weight</span>

          <strong>
            ${escapeHtml(
              player.weight ||
              "—"
            )}
          </strong>
        </div>
      </div>
    `;
  }

  setAvatar(
    player.avatarUrl || ""
  );

  const unread =
    messages.filter(
      function(message) {
        return (
          message.direction !==
            "sent" &&
          !message.read
        );
      }
    ).length;

  const unreadElement =
    document.getElementById(
      "overviewUnreadCount"
    );

  if (unreadElement) {
    unreadElement.textContent =
      unread;
  }

  const messageList =
    document.getElementById(
      "overviewMessageList"
    );

  if (messageList) {
    messageList.innerHTML =
      messages.length
        ? messages
            .slice(0, 3)
            .map(function(message) {
              return `
                <div class="preview-row">
                  <div>
                    <strong>
                      ${escapeHtml(
                        message.fromName ||
                        message.toName ||
                        message.senderName ||
                        "Collective"
                      )}
                    </strong>

                    <p class="muted small">
                      ${escapeHtml(
                        message.subject ||
                        message.text ||
                        "Message"
                      )}
                    </p>
                  </div>
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

  const interestedCount =
    document.getElementById(
      "overviewInterestedCount"
    );

  if (interestedCount) {
    interestedCount.textContent =
      programs.interestedInPlayer
        .length;
  }

  const interestedList =
    document.getElementById(
      "overviewInterestedList"
    );

  if (interestedList) {
    interestedList.innerHTML =
      programs.interestedInPlayer
        .length
        ? programs
            .interestedInPlayer
            .slice(0, 4)
            .map(function(program) {
              return `
                <div class="preview-row">
                  <div>
                    <strong>
                      ${escapeHtml(
                        program.name ||
                        "Program"
                      )}
                    </strong>

                    <p class="muted small">
                      ${escapeHtml(
                        program.level ||
                        "Program"
                      )}
                    </p>
                  </div>
                </div>
              `;
            })
            .join("")
        : `
          <p class="muted small">
            No programs added.
          </p>
        `;
  }

  const overviewProgress =
    document.getElementById(
      "overviewProgress"
    );

  if (overviewProgress) {
    overviewProgress.innerHTML =
      progressRatings.length
        ? progressRatings
            .slice(0, 4)
            .map(function(item) {
              const rating =
                Math.max(
                  0,
                  Math.min(
                    100,
                    Number(
                      item.rating
                    ) || 0
                  )
                );

              return `
                <div class="progress-row">
                  <span class="small">
                    ${escapeHtml(
                      item.category ||
                      "Progress"
                    )}
                  </span>

                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      style="width: ${rating}%"
                    ></div>
                  </div>

                  <strong>
                    ${rating}
                  </strong>
                </div>
              `;
            })
            .join("")
        : `
          <p class="muted small">
            No progress ratings yet.
          </p>
        `;
  }

  const overviewFileCount =
    document.getElementById(
      "overviewFileCount"
    );

  if (overviewFileCount) {
    overviewFileCount.textContent =
      files.length;
  }

  const overviewFileList =
    document.getElementById(
      "overviewFileList"
    );

  if (overviewFileList) {
    overviewFileList.innerHTML =
      files.length
        ? files
            .slice(0, 3)
            .map(function(file) {
              return `
                <div class="preview-row">
                  <div>
                    <strong>
                      ${escapeHtml(
                        file.name ||
                        file.fileName ||
                        "File"
                      )}
                    </strong>

                    <p class="muted small">
                      ${escapeHtml(
                        file.category ||
                        file.type ||
                        "File"
                      )}
                    </p>
                  </div>
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
}

function renderProfile() {
  if (!player) {
    return;
  }

  const profileStatusPill =
    document.getElementById(
      "profileStatusPill"
    );

  if (profileStatusPill) {
    profileStatusPill.textContent =
      player.careerStatus ||
      "Player";
  }

  const recruitingStatusPill =
    document.getElementById(
      "recruitingStatusPill"
    );

  if (recruitingStatusPill) {
    recruitingStatusPill.textContent =
      player.careerStatus ||
      "Career Status";
  }

  setAvatar(
    player.avatarUrl || ""
  );
}

function renderProgress() {
  const ratingsElement =
    document.getElementById(
      "progressRatings"
    );

  const historyElement =
    document.getElementById(
      "progressHistory"
    );

  if (ratingsElement) {
    ratingsElement.innerHTML =
      progressRatings.length
        ? progressRatings
            .map(function(item) {
              const rating =
                Math.max(
                  0,
                  Math.min(
                    100,
                    Number(
                      item.rating
                    ) || 0
                  )
                );

              return `
                <article class="rating-card">
                  <div class="rating-head">
                    <strong>
                      ${escapeHtml(
                        item.category ||
                        "Progress"
                      )}
                    </strong>

                    <span class="pill">
                      ${rating}/100
                    </span>
                  </div>

                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      style="width: ${rating}%"
                    ></div>
                  </div>

                  <p
                    class="muted small"
                    style="margin-top: 9px"
                  >
                    ${escapeHtml(
                      item.note ||
                      "No note provided."
                    )}
                  </p>
                </article>
              `;
            })
            .join("")
        : `
          <p class="muted small">
            No progress ratings yet.
          </p>
        `;
  }

  if (historyElement) {
    historyElement.innerHTML = `
      <p class="eyebrow">
        Recent Evaluations
      </p>

      ${
        progressRatings.length
          ? progressRatings
              .map(function(item) {
                const date =
                  item.createdAt
                    ? new Date(
                        item.createdAt
                      ).toLocaleDateString()
                    : "";

                return `
                  <div class="history-item">
                    <strong>
                      ${escapeHtml(
                        item.evaluator ||
                        "Collective Staff"
                      )}
                    </strong>

                    <p class="muted small">
                      ${escapeHtml(
                        item.category ||
                        "Progress"
                      )}
                      ${date ? ` · ${date}` : ""}
                    </p>

                    <p class="muted small">
                      ${escapeHtml(
                        item.note || ""
                      )}
                    </p>
                  </div>
                `;
              })
              .join("")
          : `
            <p class="muted small">
              No evaluations yet.
            </p>
          `
      }
    `;
  }
}

function renderPrograms() {
  function renderList(
    type,
    elementId,
    countId
  ) {
    const list =
      programs[type] || [];

    const count =
      document.getElementById(
        countId
      );

    const element =
      document.getElementById(
        elementId
      );

    if (count) {
      count.textContent =
        `${list.length} programs`;
    }

    if (!element) {
      return;
    }

    element.innerHTML =
      list.length
        ? list
            .map(function(program) {
              const id =
                program.id ||
                program._id ||
                "";

              return `
                <div class="program-item">
                  <div class="program-head">
                    <div>
                      <strong>
                        ${escapeHtml(
                          program.name ||
                          "Program"
                        )}
                      </strong>

                      <p class="muted small">
                        ${escapeHtml(
                          program.level ||
                          "Program"
                        )}
                      </p>
                    </div>

                    <button
                      class="text-button"
                      type="button"
                      onclick="deleteProgram('${type}', '${escapeHtml(id)}')"
                    >
                      Delete
                    </button>
                  </div>

                  <p class="muted small">
                    ${escapeHtml(
                      program.contact ||
                      program.note ||
                      "No contact information"
                    )}
                  </p>
                </div>
              `;
            })
            .join("")
        : `
          <p class="muted small">
            No programs added.
          </p>
        `;
  }

  renderList(
    "interestedInPlayer",
    "programsInterestedList",
    "programsInterestedCount"
  );

  renderList(
    "playerInterested",
    "playerInterestedList",
    "playerInterestedCount"
  );
}

function renderMessages() {
  const search =
    document.getElementById(
      "messageSearch"
    );

  const query =
    search?.value
      .toLowerCase()
      .trim() || "";

  const filtered =
    messages.filter(
      function(message) {
        const text = [
          message.subject,
          message.text,
          message.fromName,
          message.toName
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(query);
      }
    );

  const countPill =
    document.getElementById(
      "messageCountPill"
    );

  if (countPill) {
    countPill.textContent =
      `${filtered.length} messages`;
  }

  const messageList =
    document.getElementById(
      "messageList"
    );

  if (!messageList) {
    return;
  }

  messageList.innerHTML =
    filtered.length
      ? filtered
          .map(function(message) {
            const id =
              message.id ||
              message._id ||
              "";

            const date =
              message.createdAt
                ? new Date(
                    message.createdAt
                  ).toLocaleString()
                : "";

            const directionText =
              message.direction ===
              "sent"
                ? `To ${
                    message.toName ||
                    "Staff"
                  }`
                : `From ${
                    message.fromName ||
                    "Collective"
                  }`;

            return `
              <div class="message-item">
                <div class="message-head">
                  <div>
                    <strong>
                      ${escapeHtml(
                        message.subject ||
                        "Message"
                      )}
                    </strong>

                    <p class="muted small">
                      ${escapeHtml(directionText)}
                      ${date ? ` · ${escapeHtml(date)}` : ""}
                    </p>
                  </div>

                  <button
                    class="text-button"
                    type="button"
                    onclick="deleteMessage('${escapeHtml(id)}')"
                  >
                    Delete
                  </button>
                </div>

                <p class="muted small">
                  ${escapeHtml(
                    message.text || ""
                  )}
                </p>
              </div>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No messages found.
        </p>
      `;
}

function renderFiles() {
  const search =
    document.getElementById(
      "fileSearch"
    );

  const query =
    search?.value
      .toLowerCase()
      .trim() || "";

  const filtered =
    files.filter(function(file) {
      const text = [
        file.name,
        file.fileName,
        file.category
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });

  const countPill =
    document.getElementById(
      "fileCountPill"
    );

  if (countPill) {
    countPill.textContent =
      `${filtered.length} files`;
  }

  const fileList =
    document.getElementById(
      "fileList"
    );

  if (!fileList) {
    return;
  }

  fileList.innerHTML =
    filtered.length
      ? filtered
          .map(function(file) {
            const id =
              file.id ||
              file._id ||
              "";

            const url =
              file.url ||
              file.fileUrl ||
              "";

            const type =
              file.mimeType ||
              file.type ||
              "";

            let preview = `
              <span>
                ${escapeHtml(
                  file.category ||
                  "File"
                )}
              </span>
            `;

            if (
              url &&
              type.startsWith(
                "image/"
              )
            ) {
              preview = `
                <img
                  src="${escapeHtml(url)}"
                  alt="${escapeHtml(
                    file.name ||
                    "File"
                  )}"
                >
              `;
            }

            if (
              url &&
              type.startsWith(
                "video/"
              )
            ) {
              preview = `
                <video
                  src="${escapeHtml(url)}"
                  muted
                ></video>
              `;
            }

            return `
              <div class="file-item">
                <div class="file-thumb">
                  ${preview}
                </div>

                <div class="file-head">
                  <div>
                    <strong>
                      ${escapeHtml(
                        file.name ||
                        file.fileName ||
                        "Untitled file"
                      )}
                    </strong>

                    <p class="muted small">
                      ${escapeHtml(
                        file.category ||
                        "File"
                      )}
                    </p>
                  </div>

                  <button
                    class="text-button"
                    type="button"
                    onclick="deleteFile('${escapeHtml(id)}')"
                  >
                    Delete
                  </button>
                </div>

                ${
                  url
                    ? `
                      <a
                        class="text-button"
                        href="${escapeHtml(url)}"
                        target="_blank"
                        rel="noopener"
                      >
                        View File
                      </a>
                    `
                    : ""
                }

                <p class="muted small">
                  ${escapeHtml(
                    file.note || ""
                  )}
                </p>
              </div>
            `;
          })
          .join("")
      : `
        <p class="muted small">
          No files found.
        </p>
      `;
}

function renderEverything() {
  renderOverview();
  renderProfile();
  renderProgress();
  renderPrograms();
  renderMessages();
  renderFiles();
}

async function saveProfile(event) {
  event.preventDefault();

  const payload = {};

  [
    "firstName",
    "lastName",
    "birthYear",
    "position",
    "currentTeam",
    "shoots",
    "height",
    "weight",
    "email",
    "phone",
    "careerStatus",
    "bio"
  ].forEach(function(id) {
    const element =
      document.getElementById(id);

    if (element) {
      payload[id] =
        element.value.trim();
    }
  });

  try {
    const data =
      await apiRequest(
        API.me,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    player = {
      ...player,
      ...(data?.player || payload)
    };

    fillProfileForm();
    fillRecruitingLevels();
    renderEverything();

    alert("Profile saved.");
  } catch (error) {
    console.error(
      "Save profile error:",
      error
    );

    alert(error.message);
  }
}

async function uploadAvatar() {
  const input =
    document.getElementById(
      "avatarInput"
    );

  const file =
    input?.files?.[0];

  if (!file) {
    alert(
      "Choose a photo first."
    );

    return;
  }

  try {
    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    const data =
      await apiRequest(
        API.avatar,
        {
          method: "POST",
          body: formData
        }
      );

    player.avatarUrl =
      data?.avatarUrl ||
      data?.url ||
      "";

    input.value = "";

    renderEverything();
  } catch (error) {
    console.error(
      "Avatar upload error:",
      error
    );

    alert(error.message);
  }
}

async function deleteAvatar() {
  if (
    !player?.avatarUrl ||
    !confirm(
      "Remove your profile photo?"
    )
  ) {
    return;
  }

  try {
    await apiRequest(
      API.avatar,
      {
        method: "DELETE"
      }
    );

    player.avatarUrl = "";

    renderEverything();
  } catch (error) {
    console.error(
      "Avatar delete error:",
      error
    );

    alert(error.message);
  }
}

async function addProgram(
  event,
  type
) {
  event.preventDefault();

  const prefix =
    type ===
    "interestedInPlayer"
      ? "interestedInPlayer"
      : "playerInterested";

  const nameInput =
    document.getElementById(
      `${prefix}Name`
    );

  const levelInput =
    document.getElementById(
      `${prefix}Level`
    );

  const contactInput =
    document.getElementById(
      `${prefix}Contact`
    );

  const payload = {
    type,

    name:
      nameInput?.value
        .trim() || "",

    level:
      levelInput?.value || "",

    contact:
      contactInput?.value
        .trim() || ""
  };

  try {
    const data =
      await apiRequest(
        API.programs,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    if (data?.program) {
      programs[type].unshift(
        data.program
      );
    }

    event.target.reset();

    fillRecruitingLevels();
    renderEverything();
  } catch (error) {
    console.error(
      "Add program error:",
      error
    );

    alert(error.message);
  }
}

async function deleteProgram(
  type,
  id
) {
  if (
    !confirm(
      "Delete this program?"
    )
  ) {
    return;
  }

  try {
    await apiRequest(
      API.programs,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            id,
            type
          })
      }
    );

    programs[type] =
      programs[type].filter(
        function(program) {
          return (
            String(
              program.id ||
              program._id
            ) !== String(id)
          );
        }
      );

    renderEverything();
  } catch (error) {
    console.error(
      "Delete program error:",
      error
    );

    alert(error.message);
  }
}

async function sendMessage(event) {
  event.preventDefault();

  const recipientSelect =
    document.getElementById(
      "messageRecipient"
    );

  const subjectInput =
    document.getElementById(
      "messageSubject"
    );

  const textInput =
    document.getElementById(
      "messageText"
    );

  const selectedOption =
    recipientSelect?.options[
      recipientSelect.selectedIndex
    ];

  const payload = {
    recipientId:
      recipientSelect?.value || "",

    toName:
      selectedOption?.text
        .split(" · ")[0] || "",

    subject:
      subjectInput?.value
        .trim() || "",

    text:
      textInput?.value
        .trim() || ""
  };

  try {
    const data =
      await apiRequest(
        API.messages,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    if (data?.message) {
      messages.unshift(
        data.message
      );
    }

    event.target.reset();

    renderEverything();
  } catch (error) {
    console.error(
      "Send message error:",
      error
    );

    alert(error.message);
  }
}

async function deleteMessage(id) {
  if (
    !confirm(
      "Delete this message?"
    )
  ) {
    return;
  }

  try {
    await apiRequest(
      API.messages,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            id
          })
      }
    );

    messages =
      messages.filter(
        function(message) {
          return (
            String(
              message.id ||
              message._id
            ) !== String(id)
          );
        }
      );

    renderEverything();
  } catch (error) {
    console.error(
      "Delete message error:",
      error
    );

    alert(error.message);
  }
}

async function uploadFile(event) {
  event.preventDefault();

  const input =
    document.getElementById(
      "fileInput"
    );

  const file =
    input?.files?.[0];

  if (!file) {
    alert(
      "Choose a file first."
    );

    return;
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "category",
    document
      .getElementById(
        "fileCategory"
      )
      ?.value || "Other"
  );

  formData.append(
    "note",
    document
      .getElementById(
        "fileNote"
      )
      ?.value
      .trim() || ""
  );

  try {
    const data =
      await apiRequest(
        API.files,
        {
          method: "POST",
          body: formData
        }
      );

    if (data?.file) {
      files.unshift(
        data.file
      );
    }

    event.target.reset();

    renderEverything();
  } catch (error) {
    console.error(
      "File upload error:",
      error
    );

    alert(error.message);
  }
}

async function deleteFile(id) {
  if (
    !confirm(
      "Delete this file?"
    )
  ) {
    return;
  }

  try {
    await apiRequest(
      API.files,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            id
          })
      }
    );

    files =
      files.filter(
        function(file) {
          return (
            String(
              file.id ||
              file._id
            ) !== String(id)
          );
        }
      );

    renderEverything();
  } catch (error) {
    console.error(
      "Delete file error:",
      error
    );

    alert(error.message);
  }
}

async function logout() {
  try {
    await apiRequest(
      API.logout,
      {
        method: "POST"
      }
    );

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

loadDashboard();
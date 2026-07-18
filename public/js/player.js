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
let progressCategories = [];
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
  careerStatus: "Youth",
  bio: "",
  avatarUrl: "",
  eliteProspects: "",
  epData: null,
  epSync: null
};

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

function setProfilePanel(panel) {
  const sectionIds = {
    details: "profileDetailsSection",
    eliteprospects: "profileEliteProspectsSection",
    progress: "profileProgressSection"
  };

  document
    .querySelectorAll(".segment")
    .forEach(function(button) {
      button.classList.toggle(
        "active",
        button.dataset.profilePanel ===
          panel
      );
    });

  requestAnimationFrame(function() {
    document
      .getElementById(sectionIds[panel] || "")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    renderEliteProspects();

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

      progressCategories =
        Array.isArray(
          progressResult.value
            ?.categories
        )
          ? progressResult.value
              .categories
          : [];
    } else {
      progressRatings = [];
      progressCategories = [];

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

function eliteProspectsSeasonLine(season) {
  if (!season || (!season.team && !season.league && !season.season)) {
    return "";
  }

  const parts = [
    season.team,
    season.league,
    season.season
  ].filter(Boolean).join(" · ");

  const stats = [
    season.gp != null ? `${season.gp} GP` : null,
    season.goals != null ? `${season.goals}G` : null,
    season.assists != null ? `${season.assists}A` : null,
    season.points != null ? `${season.points}PTS` : null,
    season.pim != null ? `${season.pim} PIM` : null,
    season.plusMinus != null ? `${season.plusMinus > 0 ? "+" : ""}${season.plusMinus}` : null
  ].filter(Boolean).join(" ");

  return [parts, stats].filter(Boolean).join(" — ");
}

function eliteProspectsRecentFormLine(recentForm) {
  if (!recentForm || recentForm.gp == null) {
    return "";
  }

  const stats = [
    `${recentForm.gp} GP`,
    recentForm.goals != null ? `${recentForm.goals}G` : null,
    recentForm.assists != null ? `${recentForm.assists}A` : null,
    recentForm.points != null ? `${recentForm.points}PTS` : null,
    recentForm.plusMinus != null ? `${recentForm.plusMinus > 0 ? "+" : ""}${recentForm.plusMinus}` : null
  ].filter(Boolean).join(" ");

  return `Last ${recentForm.spanGames} Games — ${stats}`;
}

function eliteProspectsContextLine(context) {
  if (!context) return "";
  return [context.team, context.league, context.season].filter(Boolean).join(" · ");
}

function statBoxGridHtml(boxes) {
  return `<div class="stat-box-grid">${boxes.map(function(box) {
    const value = box[1];
    return `
      <div class="stat-box">
        <strong>${value != null ? escapeHtml(String(value)) : "—"}</strong>
        <span>${escapeHtml(box[0])}</span>
      </div>
    `;
  }).join("")}</div>`;
}

function renderEliteProspects() {
  const overviewLine = document.getElementById("overviewEliteProspects");
  const body = document.getElementById("eliteProspectsBody");
  const statusPill = document.getElementById("epSyncStatusPill");

  const epData = player?.epData || null;
  const epSync = player?.epSync || null;
  const seasonLine = eliteProspectsSeasonLine(epData?.latestSeason);
  const recentFormLine = eliteProspectsRecentFormLine(epData?.recentForm);
  const contextLine = eliteProspectsContextLine(epData?.currentContext);
  const overviewSummary = seasonLine || recentFormLine || contextLine;

  if (overviewLine) {
    overviewLine.textContent = overviewSummary
      ? `Elite Prospects: ${overviewSummary}`
      : "Elite Prospects: Not synced yet.";
  }

  if (statusPill) {
    statusPill.textContent =
      epSync?.status === "success" ? "Synced" :
      epSync?.status === "error" ? "Sync failed" :
      "Not synced";
  }

  if (!body) {
    return;
  }

  if (!player?.eliteProspects) {
    body.innerHTML = `<p class="muted small ep-empty">No Elite Prospects profile linked.</p>`;
    return;
  }

  const bio = epData?.bio || {};
  const season = epData?.latestSeason || {};
  const recentForm = epData?.recentForm || {};
  const context = epData?.currentContext || {};

  const bioFacts = [
    ["Full Name", bio.fullName],
    ["Date of Birth", bio.dateOfBirth],
    ["Age", bio.age],
    ["Position", bio.position],
    ["Shoots/Catches", bio.shoots],
    ["Height", bio.height],
    ["Weight", bio.weight],
    ["Nationality", bio.nationality],
    ["Place of Birth", bio.placeOfBirth]
  ].filter(function(fact) {
    return fact[1] != null && fact[1] !== "";
  });

  const bioHtml = bioFacts.length
    ? `<div class="ep-fact-grid">${bioFacts.map(function(fact) {
        return `<div class="ep-fact"><span>${escapeHtml(fact[0])}</span><strong>${escapeHtml(String(fact[1]))}</strong></div>`;
      }).join("")}</div>`
    : `<p class="muted small ep-empty">No biography data yet.</p>`;

  const contextFacts = [
    ["Team", context.team],
    ["League", context.league],
    ["Season", context.season]
  ].filter(function(fact) {
    return fact[1] != null && fact[1] !== "";
  });

  const contextHtml = contextFacts.length
    ? `<div class="ep-fact-grid">${contextFacts.map(function(fact) {
        return `<div class="ep-fact"><span>${escapeHtml(fact[0])}</span><strong>${escapeHtml(String(fact[1]))}</strong></div>`;
      }).join("")}</div>`
    : `<p class="muted small ep-empty">No current team on file.</p>`;

  const seasonHtml = season.gp != null || season.season
    ? statBoxGridHtml([
        ["GP", season.gp],
        ["G", season.goals],
        ["A", season.assists],
        ["PTS", season.points],
        ["PIM", season.pim],
        ["+/-", season.plusMinus != null ? `${season.plusMinus > 0 ? "+" : ""}${season.plusMinus}` : null]
      ])
    : `<p class="muted small ep-empty">No full season totals available.</p>`;

  const recentFormHtml = recentForm.gp != null
    ? statBoxGridHtml([
        ["GP", recentForm.gp],
        ["G", recentForm.goals],
        ["A", recentForm.assists],
        ["PTS", recentForm.points],
        ["+/-", recentForm.plusMinus != null ? `${recentForm.plusMinus > 0 ? "+" : ""}${recentForm.plusMinus}` : null]
      ])
    : `<p class="muted small ep-empty">No recent form data available.</p>`;

  const lastUpdated = epSync?.lastSuccessfulAt
    ? new Date(epSync.lastSuccessfulAt).toLocaleDateString()
    : "Never";

  body.innerHTML = `
    <div class="ep-layout">
      <div class="ep-row">
        <div class="ep-subcard">
          <h4 class="ep-subcard-title">Bio</h4>
          ${bioHtml}
        </div>
        <div class="ep-subcard">
          <h4 class="ep-subcard-title">Current Team</h4>
          ${contextHtml}
        </div>
      </div>
      <div class="ep-subcard">
        <h4 class="ep-subcard-title">Latest Season</h4>
        ${seasonHtml}
      </div>
      <div class="ep-subcard">
        <h4 class="ep-subcard-title">Recent Form${recentForm.spanGames ? ` <span class="ep-subcard-sub">Last ${escapeHtml(String(recentForm.spanGames))} Games</span>` : ""}</h4>
        ${recentFormHtml}
      </div>
      <div class="ep-footer">
        <span class="muted small">Last updated: ${escapeHtml(lastUpdated)}</span>
        <a class="button secondary" href="${escapeHtml(player.eliteProspects)}" target="_blank" rel="noopener noreferrer">View Elite Prospects Profile</a>
      </div>
    </div>
  `;
}

function latestRatingsByCategory(ratings) {
  const map = new Map();

  ratings.forEach(function(item) {
    const category = item.category || "Progress";
    const time = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    const existing = map.get(category);

    if (!existing || time >= existing._time) {
      map.set(category, { ...item, _time: time });
    }
  });

  const categoryOrder = new Map(
    progressCategories.map(function(item, index) {
      return [item.name, item.order ?? index];
    })
  );

  return Array.from(map.values()).sort(function(a, b) {
    const orderA = categoryOrder.has(a.category) ? categoryOrder.get(a.category) : Infinity;
    const orderB = categoryOrder.has(b.category) ? categoryOrder.get(b.category) : Infinity;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return (b._time || 0) - (a._time || 0);
  });
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
    const latestByCategory =
      latestRatingsByCategory(
        progressRatings
      );

    ratingsElement.innerHTML =
      latestByCategory.length
        ? latestByCategory
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

              const date =
                item.createdAt
                  ? new Date(
                      item.createdAt
                    ).toLocaleDateString(
                      undefined,
                      { year: "numeric", month: "long" }
                    )
                  : "";

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

                  <div class="progress-track lg">
                    <div
                      class="progress-fill"
                      style="width: ${rating}%"
                    ></div>
                  </div>

                  <div class="rating-meta">
                    <span class="rating-meta-label">Latest evaluation</span>
                    <span class="rating-meta-value">
                      ${escapeHtml(
                        item.evaluator ||
                        "Collective Staff"
                      )}${date ? ` · ${escapeHtml(date)}` : ""}
                    </span>
                  </div>

                  <div class="rating-comment">
                    <span class="rating-comment-label">Comment</span>
                    <p>
                      ${escapeHtml(
                        item.note ||
                        "No note provided."
                      )}
                    </p>
                  </div>
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

            const otherPartyName =
              message.direction === "sent"
                ? message.toName || "Staff"
                : message.fromName || "Collective";

            return `
              <div class="message-item">
                <div class="message-head">
                  <div class="message-head-info">
                    ${avatarHtml(
                      otherPartyName,
                      message.avatarUrl,
                      "avatar-sm"
                    )}

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
  renderEliteProspects();
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
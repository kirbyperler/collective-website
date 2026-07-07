const playerData = {
    name: "Owen Schwarz",
    position: "Defenseman",
    birthYear: "2009",
    height: "6'2\"",
    weight: "185 lbs",
    shot: "Left Shot",
    team: "Boston Jr. Rangers 16U",
    league: "16U AAA",

    stats: {
      GP: 34,
      G: 6,
      A: 15,
      PTS: 21,
      PIM: 18
    },

    tasks: [
      {
        title: "Mobility Routine",
        time: "30 min",
        completed: true
      },
      {
        title: "Stickhandling Progression",
        time: "20 min",
        completed: true
      },
      {
        title: "Watch Video Clips",
        time: "15 min",
        completed: false
      },
      {
        title: "Nutrition Log",
        time: "5 min",
        completed: false
      }
    ],

    messages: [
      {
        from: "Tyler Young",
        role: "Video Coach",
        text: "Great session today. Focus on your gap work.",
        time: "2h ago"
      },
      {
        from: "Nick Tremblay",
        role: "Advisor",
        text: "Added a new school to your board.",
        time: "5h ago"
      },
      {
        from: "Team Channel",
        role: "Collective Feed",
        text: "New video breakdown is up.",
        time: "1d ago"
      }
    ],

    schoolsRecruiting: [
      "Boston College",
      "Northeastern",
      "Providence",
      "Maine"
    ],

    dreamSchools: [
      "Boston University",
      "Michigan",
      "Quinnipiac",
      "Denver"
    ],

    programsRecruiting: [
      "USHL",
      "Lincoln Stars",
      "Waterloo Black Hawks",
      "Sioux Falls Stampede"
    ],

    progress: [
      {
        label: "Overall",
        value: 72
      },
      {
        label: "Skating",
        value: 68
      },
      {
        label: "Decision Making",
        value: 75
      },
      {
        label: "Strength",
        value: 61
      },
      {
        label: "Recruiting",
        value: 58
      }
    ]
  };

  function renderDashboard(player) {
    document.getElementById("playerName").textContent = player.name;
    document.getElementById("topPlayerName").textContent = player.name;

    document.getElementById("playerMeta").textContent =
      `${player.position} · ${player.birthYear} · ${player.height} · ${player.weight}`;

    document.getElementById("playerShot").textContent = player.shot;

    document.getElementById("seasonStats").innerHTML = `
      <div class="stat">
        <span>Team</span>
        <strong>${player.team}</strong>
      </div>

      <div class="stat">
        <span>League</span>
        <strong>${player.league}</strong>
      </div>

      ${Object.entries(player.stats)
        .map(([key, value]) => {
          return `
            <div class="stat">
              <span>${key}</span>
              <strong>${value}</strong>
            </div>
          `;
        })
        .join("")}
    `;

    document.getElementById("tasks").innerHTML = player.tasks
      .map((task) => {
        return `
          <div class="task">
            <span class="check ${task.completed ? "done" : ""}">
              ${task.completed ? "✓" : ""}
            </span>

            <span>${task.title}</span>

            <span class="muted">${task.time}</span>
          </div>
        `;
      })
      .join("");

    document.getElementById("messages").innerHTML = player.messages
      .map((message) => {
        return `
          <div class="msg">
            <div class="msg-icon"></div>

            <div>
              <strong>${message.from}</strong>
              <p>${message.role}</p>
              <p>${message.text}</p>
            </div>

            <span class="muted">${message.time}</span>
          </div>
        `;
      })
      .join("");

    renderMiniList("schoolsRecruiting", player.schoolsRecruiting, true);
    renderMiniList("dreamSchools", player.dreamSchools, false);
    renderMiniList("programsRecruiting", player.programsRecruiting, false);

    document.getElementById("progress").innerHTML = player.progress
      .map((item) => {
        return `
          <div class="progress-row">
            <div class="progress-top">
              <span>${item.label}</span>
              <span class="muted">${item.value}%</span>
            </div>

            <div class="bar">
              <span style="width: ${item.value}%"></span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderMiniList(id, items, starred) {
    document.getElementById(id).innerHTML = items
      .map((item) => {
        return `
          <div class="item">
            <div class="badge">
              ${item.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <strong>${item}</strong>
              <p class="muted" style="font-size: 12px; margin-top: 3px;">
                Development File
              </p>
            </div>

            <span class="${starred ? "star" : "muted"}">★</span>
          </div>
        `;
      })
      .join("");
  }

  renderDashboard(playerData);
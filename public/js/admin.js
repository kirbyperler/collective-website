const response = await fetch("/api/get-players");
const players = await response.json();

    let messages = [
      {
        to: "Owen Schwarz",
        type: "Advisor Message",
        text: "Great session today. Focus on your gap control.",
        time: "2h ago"
      },
      {
        to: "Ryan Carter",
        type: "Admin Notice",
        text: "Your new video review has been added.",
        time: "1d ago"
      }
    ];

    let selectedPlayerId = 1;

    function renderPlayerList() {
      const searchValue = document
        .getElementById("playerSearch")
        .value
        .toLowerCase();

      const filteredPlayers = players.filter((player) => {
        return (
          player.name.toLowerCase().includes(searchValue) ||
          player.email.toLowerCase().includes(searchValue) ||
          player.team.toLowerCase().includes(searchValue)
        );
      });

      document.getElementById("playerList").innerHTML = filteredPlayers
        .map((player) => {
          return `
            <button
              class="player-button ${player.id === selectedPlayerId ? "active" : ""}"
              onclick="selectPlayer(${player.id})"
            >
              <div class="avatar">${getInitials(player.name)}</div>

              <div>
                <strong>${player.name}</strong>
                <p class="muted small">${player.position} · ${player.team}</p>
              </div>

              <span class="status">${player.status}</span>
            </button>
          `;
        })
        .join("");

      document.getElementById("playerCount").textContent =
        `${players.length} users`;
    }

    function renderSelectedPlayer() {
      const player = players.find((item) => item.id === selectedPlayerId);

      if (!player) {
        return;
      }

      document.getElementById("selectedPlayer").innerHTML = `
        <div class="profile-top">
          <div class="profile-avatar">${getInitials(player.name)}</div>

          <div>
            <h2>${player.name}</h2>
            <p class="muted">${player.email}</p>
            <p class="muted">${player.position} · ${player.birthYear} · ${player.team}</p>
          </div>

          <span class="status">${player.status}</span>
        </div>

        <div class="stat-grid">
          <div class="stat-box">
            <span>Role</span>
            <strong>${player.role}</strong>
          </div>

          <div class="stat-box">
            <span>Tasks Due</span>
            <strong>${player.tasksDue}</strong>
          </div>

          <div class="stat-box">
            <span>Unread</span>
            <strong>${player.unreadMessages}</strong>
          </div>

          <div class="stat-box">
            <span>Status</span>
            <strong>${player.status}</strong>
          </div>
        </div>

        <div class="section-grid">
          <div class="mini-panel">
            <h3>Staff</h3>

            <div class="line-item">
              <span>Advisor</span>
              <strong>${player.advisor}</strong>
            </div>

            <div class="line-item">
              <span>Video Coach</span>
              <strong>${player.videoCoach}</strong>
            </div>
          </div>

          <div class="mini-panel">
            <h3>Quick Actions</h3>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="button secondary">View Dashboard</button>
              <button class="button secondary">Edit User</button>
              <button class="button secondary" onclick="prepareMessage(${player.id})">
                Message
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function renderMessageRecipients() {
      document.getElementById("messageRecipient").innerHTML = players
        .map((player) => {
          return `<option value="${player.id}">${player.name}</option>`;
        })
        .join("");

      document.getElementById("messageRecipient").value = selectedPlayerId;
    }

    function renderMessageLog() {
      document.getElementById("messageLog").innerHTML = messages
        .map((message) => {
          return `
            <div class="message">
              <strong>${message.to}</strong>
              <p>${message.type}</p>
              <p>${message.text}</p>
              <p class="muted small">${message.time}</p>
            </div>
          `;
        })
        .join("");

      document.getElementById("dbMessages").textContent =
        `${messages.length} rows`;
    }

    function renderDatabasePreview() {
      document.getElementById("dbPlayers").textContent =
        `${players.length} rows`;
    }

    function selectPlayer(id) {
      selectedPlayerId = id;
      renderPlayerList();
      renderSelectedPlayer();
      renderMessageRecipients();
    }

    function prepareMessage(id) {
      selectedPlayerId = id;
      renderPlayerList();
      renderSelectedPlayer();
      renderMessageRecipients();

      document.getElementById("messageText").focus();
    }

async function addUser(event) {
  event.preventDefault();

  const newPlayer = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("email").value.trim(),
    role: document.getElementById("role").value,
    position: document.getElementById("position").value.trim(),
    birthYear: document.getElementById("birthYear").value.trim()
  };

  const response = await fetch("/api/players", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newPlayer)
  });

  const data = await response.json();

  if (response.ok) {
    alert("Player created successfully");
    document.getElementById("newUserForm").reset();
  } else {
    alert(data.message || "Something went wrong");
  }
}

    function sendMessage(event) {
      event.preventDefault();

      const recipientId = Number(document.getElementById("messageRecipient").value);
      const recipient = players.find((player) => player.id === recipientId);
      const text = document.getElementById("messageText").value.trim();

      if (!recipient || !text) {
        return;
      }

      messages.unshift({
        to: recipient.name,
        type: document.getElementById("messageType").value,
        text: text,
        time: "Just now"
      });

      recipient.unreadMessages += 1;
      document.getElementById("messageText").value = "";

      renderEverything();
    }

    function focusNewUserForm() {
      document.getElementById("firstName").focus();
    }

    function getInitials(name) {
      return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }

    function renderEverything() {
      renderPlayerList();
      renderSelectedPlayer();
      renderMessageRecipients();
      renderMessageLog();
      renderDatabasePreview();
    }

    renderEverything();
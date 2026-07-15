const setupForm =
  document.getElementById("setupAccountForm");

const usernameInput =
  document.getElementById("username");

const passwordInput =
  document.getElementById("password");

const confirmPasswordInput =
  document.getElementById("confirmPassword");

const submitButton =
  document.getElementById("submitButton");

const setupMessage =
  document.getElementById("setupMessage");

const urlParameters =
  new URLSearchParams(window.location.search);

const setupToken =
  urlParameters.get("token");

if (!setupToken) {
  showMessage(
    "This account setup link is missing its token.",
    "error"
  );

  submitButton.disabled = true;
}

setupForm.addEventListener(
  "submit",
  completeAccountSetup
);

async function completeAccountSetup(event) {
  event.preventDefault();

  clearMessage();

  const username =
    usernameInput.value.trim();

  const password =
    passwordInput.value;

  const confirmPassword =
    confirmPasswordInput.value;

  if (!setupToken) {
    showMessage(
      "This account setup link is invalid.",
      "error"
    );

    return;
  }

  if (username.length < 3) {
    showMessage(
      "Your username must be at least 3 characters.",
      "error"
    );

    return;
  }

  if (password.length < 10) {
    showMessage(
      "Your password must be at least 10 characters.",
      "error"
    );

    return;
  }

  if (password !== confirmPassword) {
    showMessage(
      "The passwords do not match.",
      "error"
    );

    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating Account...";

  try {
    const response = await fetch(
      "/api/complete-account-setup",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          token: setupToken,
          username,
          password
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Could not create your account."
      );
    }

    showMessage(
      "Your account has been created. Redirecting to login...",
      "success"
    );

    setupForm.reset();

    setTimeout(function redirectToLogin() {
      window.location.href = "/login.html";
    }, 1800);
  } catch (error) {
    showMessage(
      error.message,
      "error"
    );

    submitButton.disabled = false;
    submitButton.textContent = "Create Account";
  }
}

function showMessage(message, type) {
  setupMessage.textContent = message;
  setupMessage.className =
    `setup-message ${type}`;
}

function clearMessage() {
  setupMessage.textContent = "";
  setupMessage.className = "setup-message";
}
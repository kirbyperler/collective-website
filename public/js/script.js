// ============================================
// COLLECTIVE
// script.js
// ============================================

const navbar = document.querySelector(".navbar");

if (navbar) {
    window.addEventListener("scroll", function () {
        if (window.scrollY > 40) {
            navbar.style.background = "rgba(5,5,5,.92)";
            navbar.style.borderBottom = "1px solid rgba(255,255,255,.2)";
        } else {
            navbar.style.background = "rgba(5,5,5,.72)";
            navbar.style.borderBottom = "1px solid rgba(255,255,255,.2)";
        }
    });
}

// ============================================
// Fade in sections
// ============================================

const sections = document.querySelectorAll("section:not(.inquiry-section)");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
            }
        });
    }, {
        threshold: .2
    });

    sections.forEach(function (section) {
        section.classList.add("fade");
        observer.observe(section);
    });
} else {
    sections.forEach(function (section) {
        section.classList.add("show");
    });
}

// ============================================
// Smooth hover animation for cards
// ============================================

const cards = document.querySelectorAll(".card");

cards.forEach(function (card) {
    card.addEventListener("mousemove", function () {
        card.style.transform = "translateY(-10px)";
    });

    card.addEventListener("mouseleave", function () {
        card.style.transform = "";
    });
});

// ============================================
// Inquiry Form
// ============================================

const inquiryForm = document.getElementById("inquiryForm");

if (inquiryForm) {
    inquiryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(inquiryForm);

        const data = {
            firstName: formData.get("firstName"),
            lastName: formData.get("lastName"),
            role: formData.get("role"),
            birthYear: formData.get("birthYear"),
            phoneNumber: formData.get("phoneNumber"),
            email: formData.get("email"),
            goals: formData.get("goals")
        };

        const eliteProspectsValue = String(formData.get("eliteProspects") || "").trim();

        if (data.role === "player" && eliteProspectsValue) {
            const eliteProspectsPattern = /^https:\/\/(www\.)?eliteprospects\.com\/player\/\d+\/[a-z0-9-]+/i;

            if (!eliteProspectsPattern.test(eliteProspectsValue)) {
                alert("Please enter a valid Elite Prospects player profile URL, or leave it blank.");
                return;
            }
        }

        data.eliteProspects = data.role === "player" ? eliteProspectsValue : "";

        try {
            const response = await fetch("/api/inquiries", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                inquiryForm.innerHTML = `
                    <div class="success-message">
                        <h2>Thank you.</h2>
                        <p>Your inquiry has been received. We'll be in touch if Collective is the right fit.</p>
                        <a href="index.html" class="hero-button">Return Home</a>
                    </div>
                `;
            } else {
                alert("Something went wrong. Please try again.");
            }
        } catch (error) {
            alert("Something went wrong. Please try again.");
        }
    });
}

// ============================================
// Show Elite Prospects link only for players
// ============================================

const roleButtons = document.querySelectorAll('input[name="role"]');
const eliteProspectsContainer = document.getElementById("eliteProspectsContainer");
const eliteProspectsInput = document.getElementById("eliteProspects");

if (roleButtons.length && eliteProspectsContainer) {

    roleButtons.forEach(function (roleButton) {

        roleButton.addEventListener("change", function () {

            if (roleButton.value === "player") {
                eliteProspectsContainer.style.display = "block";

                if (eliteProspectsInput) {
                    eliteProspectsInput.disabled = false;
                }

            } else {
                eliteProspectsContainer.style.display = "none";

                if (eliteProspectsInput) {
                    eliteProspectsInput.disabled = true;
                    eliteProspectsInput.value = "";
                }
            }

        });

    });

}

// ============================================
// Login form
// ============================================

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener(
        "submit",
        async function(event) {
            event.preventDefault();

            const usernameInput =
                document.getElementById("username");

            const passwordInput =
                document.getElementById("password");

            const loginButton =
                document.getElementById("loginButton");

            const loginMessage =
                document.getElementById("loginMessage");

            const username =
                usernameInput.value
                    .trim()
                    .toLowerCase();

            const password =
                passwordInput.value;

            loginButton.disabled = true;
            loginButton.textContent =
                "Signing In...";

            loginMessage.textContent = "";

            try {
                const response = await fetch(
                    "/api/auth?action=login",
                    {
                        method: "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            password
                        })
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
                    data =
                        await response.json();
                } else {
                    const responseText =
                        await response.text();

                    console.error(
                        "Non-JSON login response:",
                        response.status,
                        responseText
                    );

                    throw new Error(
                        `Login API returned ${response.status}. ` +
                        responseText.slice(0, 200)
                    );
                }

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        data.error ||
                        "Unable to sign in."
                    );
                }

                if (!data.redirectTo) {
                    throw new Error(
                        "No dashboard is assigned to this account."
                    );
                }

                window.location.href =
                    data.redirectTo;
            } catch (error) {
                console.error(
                    "Login error:",
                    error
                );

                loginMessage.textContent =
                    error.message;

                passwordInput.value = "";
                passwordInput.focus();
            } finally {
                loginButton.disabled = false;
                loginButton.textContent =
                    "Log In";
            }
        }
    );
}
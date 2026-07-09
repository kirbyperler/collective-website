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
            position: formData.get("position"),
            birthYear: formData.get("birthYear"),
            phoneNumber: formData.get("phoneNumber"),
            email: formData.get("email"),
            goals: formData.get("goals")
        };

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
// Show position only for players
// ============================================

const roleButtons = document.querySelectorAll('input[name="role"]');
const positionContainer = document.getElementById("positionContainer");
const positionButtons = document.querySelectorAll('input[name="position"]');

if (roleButtons.length && positionContainer && positionButtons.length) {

    roleButtons.forEach(function (roleButton) {

        roleButton.addEventListener("change", function () {

            if (roleButton.value === "player") {
                positionContainer.style.display = "block";

                positionButtons.forEach(function (positionButton) {
                    positionButton.required = true;
                    positionContainer.style.cssText = `
                        display: flex;
                        flex-direction: column;
                        gap: 18px;
                    `;
                });

            } else {
                positionContainer.style.display = "none";

                positionButtons.forEach(function (positionButton) {
                    positionButton.required = false;
                    positionButton.checked = false;
                });
            }

        });

    });

}
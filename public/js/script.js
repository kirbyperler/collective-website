// ============================================
// COLLECTIVE
// script.js
// ============================================



// ============================================
// Navbar background on scroll
// ============================================

const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", function () {

    if (window.scrollY > 40) {

        navbar.style.background = "rgba(5,5,5,.92)";
        navbar.style.borderBottom = "1px solid rgba(255, 255, 255, 0.2)";
    }

    else {

        navbar.style.background = "rgba(5,5,5,.55)";
        navbar.style.borderBottom = "1px solid rgba(255,255,255,.2)";

    }

});



// ============================================
// Fade in sections
// ============================================

const sections = document.querySelectorAll("section");

const observer = new IntersectionObserver(function(entries){

    entries.forEach(function(entry){

        if(entry.isIntersecting){

            entry.target.classList.add("show");

        }

    });

}, {

    threshold: .2

});

sections.forEach(function(section){

    section.classList.add("fade");

    observer.observe(section);

});



// ============================================
// Smooth hover animation for cards
// ============================================

const cards = document.querySelectorAll(".card");

cards.forEach(function(card){

    card.addEventListener("mousemove", function(){

        card.style.transform = "translateY(-10px)";

    });

    card.addEventListener("mouseleave", function(){

        card.style.transform = "";

    });

});



// ============================================
// Inquiry Form
// ============================================

const inquiryForm = document.querySelector(".inquiry-form");

if (inquiryForm) {
    inquiryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(inquiryForm);

        const data = {
            firstName: formData.get("firstName"),
            lastName: formData.get("lastName"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            birthYear: formData.get("birthYear"),
            team: formData.get("team"),
            position: formData.get("position"),
            goals: formData.get("goals")
        };

        const response = await fetch("/api/submit-inquiry", {
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
    });
}
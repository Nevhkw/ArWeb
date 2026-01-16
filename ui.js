// --- UI LOGIC (Tabs, Animations, Fireflies) ---

// 1. Synopsis Language Switcher (Tabs)
function switchSynopsisLang(lang, btnElement) {
    // Hide all text versions
    const allTexts = ['synopsis-ms', 'synopsis-en', 'synopsis-dusun'];
    allTexts.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Show the selected one
    const target = document.getElementById('synopsis-' + lang);
    if(target) target.style.display = 'block';

    // Update button styling
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
}

// 2. Scroll Reveal Animation
const revealElements = document.querySelectorAll('.reveal');

const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const elementVisible = 150;
    
    revealElements.forEach((reveal) => {
        const elementTop = reveal.getBoundingClientRect().top;
        if (elementTop < windowHeight - elementVisible) {
            reveal.classList.add('active');
        }
    });
};

window.addEventListener('scroll', revealOnScroll);
// Trigger once on load
revealOnScroll();

// 3. Magical Fireflies Generator (Your Design Feature)
const particleContainer = document.getElementById('particles');
if (particleContainer) {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
        const firefly = document.createElement('div');
        firefly.classList.add('firefly');
        
        // Random positioning and delay
        firefly.style.left = Math.random() * 100 + 'vw';
        firefly.style.top = Math.random() * 100 + 'vh';
        firefly.style.animationDelay = Math.random() * 10 + 's';
        firefly.style.animationDuration = 10 + Math.random() * 20 + 's';
        
        particleContainer.appendChild(firefly);
    }
}

// 4. Smooth Scroll for Navigation Links (Matches friend's ui.js logic)
const scrollLinks = document.querySelectorAll('a.navLink[href^="#"]');
scrollLinks.forEach(link => {
    link.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.getAttribute("href");
        const targetEl = document.querySelector(id);
        if (targetEl) {
            const navOffset = 50; // Adjust based on your layout
            const y = targetEl.getBoundingClientRect().top + window.pageYOffset - navOffset;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    });
});
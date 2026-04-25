// ══════════════════════════════════════════════
// GENSIS STUDIOS — Scripts
// ══════════════════════════════════════════════

// ── Mobile Nav Toggle ──
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
});

// Close menu on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
  });
});

// ── Navbar scroll effect ──
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ── Fade-in on scroll (IntersectionObserver) ──
const fadeEls = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -40px 0px'
});

fadeEls.forEach(el => observer.observe(el));

// ── Contact form: live char counter + Netlify AJAX submit ──
const contactForm = document.getElementById('contact-form');
const messageField = document.getElementById('message');
const charCounter = document.getElementById('char-counter');
const contactSuccess = document.getElementById('contact-success');

if (contactForm && messageField && charCounter) {
  const updateCounter = () => {
    charCounter.textContent = `${messageField.value.length}/500 characters`;
  };
  messageField.addEventListener('input', updateCounter);
  updateCounter();

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(contactForm);
    const body = new URLSearchParams(data).toString();
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error('Network response was not ok');
      contactForm.hidden = true;
      contactSuccess.hidden = false;
    } catch (err) {
      alert('Something went wrong sending your message. Please try again or email info@gensis.co.uk directly.');
    }
  });
}

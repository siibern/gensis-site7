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
const emailField = document.getElementById('email');
const emailError = document.getElementById('email-error');
const emailDomainError = document.getElementById('email-domain-error');
const submitButton = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const verifyEmailDomain = async (email) => {
  try {
    const res = await fetch(`/.netlify/functions/verify-email?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { valid: true, degraded: true };
    return await res.json();
  } catch (_) {
    return { valid: true, degraded: true };
  }
};

if (contactForm && contactSuccess && new URLSearchParams(window.location.search).get('sent') === '1') {
  contactForm.hidden = true;
  contactForm.style.display = 'none';
  contactSuccess.hidden = false;
}

if (contactForm && messageField && charCounter) {
  const updateCounter = () => {
    const len = messageField.value.length;
    charCounter.textContent = `${len}/300 characters`;
    charCounter.hidden = len === 0;
  };
  messageField.addEventListener('input', updateCounter);
  updateCounter();

  if (emailField && emailError) {
    emailField.addEventListener('input', () => {
      if (!emailError.hidden && emailPattern.test(emailField.value.trim())) {
        emailError.hidden = true;
      }
      if (emailDomainError && !emailDomainError.hidden) {
        emailDomainError.hidden = true;
      }
    });
  }

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailValue = emailField ? emailField.value.trim() : '';

    if (emailField && emailError) {
      if (!emailPattern.test(emailValue)) {
        emailError.hidden = false;
        if (emailDomainError) emailDomainError.hidden = true;
        emailField.focus();
        return;
      }
      emailError.hidden = true;
    }

    const originalButtonText = submitButton ? submitButton.textContent : null;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending…';
    }

    const verdict = await verifyEmailDomain(emailValue);
    if (verdict.degraded) {
      console.warn('Email domain verification degraded — proceeding without it.');
    }
    if (verdict.valid === false) {
      if (emailDomainError) emailDomainError.hidden = false;
      if (emailField) emailField.focus();
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
      return;
    }
    if (emailDomainError) emailDomainError.hidden = true;

    const data = new FormData(contactForm);
    const body = new URLSearchParams(data).toString();
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error('Network response was not ok');
      window.location.href = `${window.location.pathname}?sent=1#contact`;
    } catch (err) {
      alert('Something went wrong sending your message. Please try again or email info@gensis.co.uk directly.');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}

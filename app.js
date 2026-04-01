'use strict';

let rounds = [];
let currentRoundIndex = 0;
let confettiInterval = null;

async function init() {
    try {
        const resp = await fetch('data/rounds.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        rounds = data.rounds;
        document.getElementById('total-rounds').textContent = rounds.length;

        const params = new URLSearchParams(window.location.search);
        const requested = parseInt(params.get('round') || '0', 10);
        currentRoundIndex = Math.max(0, Math.min(requested, rounds.length - 1));

        renderRound(currentRoundIndex);
    } catch (err) {
        document.getElementById('headlines-grid').innerHTML =
            '<div class="loading">⚠️ Could not load quiz data. Make sure data/rounds.json is present.</div>';
        console.error('Quiz load error:', err);
    }
}

function renderRound(index) {
    const round = rounds[index];
    document.getElementById('round-num').textContent = index + 1;
    document.getElementById('round-theme').textContent = round.theme;

    // Fisher-Yates shuffle so the fake isn't always in the same position
    const shuffled = [...round.headlines];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const labels = ['A', 'B', 'C'];

    const grid = document.getElementById('headlines-grid');
    grid.innerHTML = '';

    shuffled.forEach((headline, i) => {
        const card = document.createElement('article');
        card.className = 'headline-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Option ${labels[i]}: ${headline.text}`);

        card.innerHTML = `
      <div class="headline-label">${labels[i]}</div>
      <div class="headline-body">
        <div class="headline-text">${renderMd(headline.text)}</div>
        ${headline.source ? `<div class="headline-source">${escapeHtml(headline.source)}</div>` : ''}
      </div>
    `;

        const activate = () => {
            if (headline.real) {
                window.open(headline.url, '_blank', 'noopener,noreferrer');
                showToast('Real headline! 📰 Article opening in a new tab…');
            } else {
                const realHeadlines = shuffled.filter(h => h.real);
                showFakeFound(headline.text, realHeadlines);
            }
        };

        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });

        grid.appendChild(card);
    });
}

function showFakeFound(text, realHeadlines) {
    const overlay = document.getElementById('overlay');
    document.getElementById('fake-headline-text').innerHTML = renderMd(text);

    const list = document.getElementById('real-links-list');
    list.innerHTML = realHeadlines.map(h => `
    <li>
      <a href="${escapeHtml(h.url)}" target="_blank" rel="noopener noreferrer">
        ${renderMd(h.text)}
        <span class="real-link-source">${escapeHtml(h.source)}</span>
      </a>
    </li>
  `).join('');

    overlay.classList.remove('hidden');
    overlay.removeAttribute('aria-hidden');

    // Focus the next button for keyboard users
    document.getElementById('next-btn').focus();

    // Fire confetti bursts
    launchConfetti();
    confettiInterval = setInterval(launchConfetti, 2200);

    document.getElementById('next-btn').onclick = closeOverlayAndAdvance;
    overlay.addEventListener('keydown', overlayKeyHandler);
}

function launchConfetti() {
    const sharedOpts = { spread: 70, startVelocity: 38, decay: 0.88 };
    const easterColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#c77dff', '#4d96ff', '#ff9a3c'];

    confetti({ ...sharedOpts, particleCount: 60, angle: 55, origin: { x: 0.15, y: 0.72 }, colors: easterColors });
    confetti({ ...sharedOpts, particleCount: 60, angle: 125, origin: { x: 0.85, y: 0.72 }, colors: easterColors });
    confetti({ particleCount: 80, spread: 110, origin: { x: 0.5, y: 0.55 }, colors: easterColors });
}

function overlayKeyHandler(e) {
    if (e.key === 'Escape') closeOverlayAndAdvance();
}

function closeOverlayAndAdvance() {
    clearInterval(confettiInterval);
    confettiInterval = null;
    confetti.reset();

    const overlay = document.getElementById('overlay');
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.removeEventListener('keydown', overlayKeyHandler);

    const nextIndex = currentRoundIndex + 1;
    if (nextIndex < rounds.length) {
        currentRoundIndex = nextIndex;
        renderRound(currentRoundIndex);
        updateUrl(nextIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showFinished();
    }
}

function updateUrl(index) {
    const url = new URL(window.location.href);
    url.searchParams.set('round', index);
    window.history.pushState({ round: index }, '', url);
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Double rAF to ensure transition fires
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

function showFinished() {
    document.querySelector('main').innerHTML = `
    <div class="finished">
      <span class="big-egg">All Done</span>
      <h2>Quiz Complete!</h2>
      <p>You spotted all the fakes.</p>
      <button onclick="location.href = location.pathname">Play Again</button>
    </div>
  `;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Renders a safe subset of markdown: **bold**, *italic*, _italic_
// All HTML is escaped first so no arbitrary tags can sneak in.
function renderMd(str) {
    return escapeHtml(str)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>');
}

// Handle browser back/forward navigation
window.addEventListener('popstate', (e) => {
    if (e.state && typeof e.state.round === 'number') {
        currentRoundIndex = e.state.round;
        renderRound(currentRoundIndex);
    }
});

init();

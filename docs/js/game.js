// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;

// --- Animated Background Bubbles ---


function createBackgroundBubbles() {
    const bg = document.querySelector('.background-bubbles');
    if (!bg) return;
    bg.innerHTML = '';
    const bubbleCount = 18;
    for (let i = 0; i < bubbleCount; i++) {
        const b = document.createElement('div');
        b.className = 'background-bubble';
        const size = Math.random() * 60 + 40;
        b.style.width = b.style.height = size + 'px';
        b.style.left = Math.random() * 100 + 'vw';
        b.style.bottom = '-' + (Math.random() * 40 + 20) + 'px';
        b.style.animationDuration = (14 + Math.random() * 10) + 's';
        b.style.opacity = (0.10 + Math.random() * 0.18).toFixed(2);
        bg.appendChild(b);
    }
}

// --- Dark/Light Mode Toggle ---
function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    function setTheme(mode) {
        if (mode === 'light') {
            document.body.classList.add('light-mode');
            btn.textContent = '☀️';
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            btn.textContent = '🌙';
            localStorage.setItem('theme', 'dark');
        }
    }
    btn.onclick = () => {
        setTheme(document.body.classList.contains('light-mode') ? 'dark' : 'light');
    };
    // On load
    setTheme(localStorage.getItem('theme') || 'dark');
}

// --- Leaderboard Logic ---
function getLeaderboard() {
    return JSON.parse(localStorage.getItem('bubbles_leaderboard') || '[]');
}
function setLeaderboard(lb) {
    localStorage.setItem('bubbles_leaderboard', JSON.stringify(lb));
}
function addLeaderboardEntry(username, score) {
    let lb = getLeaderboard();
    lb.push({ username, score, time: Date.now() });
    lb = lb.sort((a, b) => b.score - a.score).slice(0, 10); // Top 10
    setLeaderboard(lb);
}
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    const lb = getLeaderboard();
    if (!lb.length) {
        list.innerHTML = '<div style="text-align:center;opacity:0.7;">No winners yet. Play the minigame!</div>';
        return;
    }
    list.innerHTML = lb.map((entry, i) => `
        <div class="leaderboard-entry">
            <span class="leaderboard-rank">${i + 1}</span>
            <span class="leaderboard-user">${entry.username || 'Anonymous'}</span>
            <span class="leaderboard-score">${entry.score}</span>
        </div>
    `).join('');
}

// --- Patch: Add leaderboard update to minigame win ---
function showCongratulationsWithLeaderboard(total) {
    addLeaderboardEntry(gameState.username || 'Anonymous', total);
    renderLeaderboard();
    const minigameArea = document.getElementById('minigame-area');
    minigameArea.innerHTML = `
        <div class="congrats-table">
            <h3>Congratulations!</h3>
            <p>You have earned <b>${total}</b> bubbles</p>
            <button class="btn" id="back-to-home">Back to Home</button>
        </div>
    `;
    showConfetti();
    document.getElementById('back-to-home').onclick = () => {
        showPage('main-game');
    };
}

// --- Patch navigation to render leaderboard on nav ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('[data-page="leaderboard"]').addEventListener('click', renderLeaderboard);
});

// --- Game State ---
let gameState = {
    bubblecoins: 0,
    lastPopTime: null,
    lastMiniGameTime: null,
    lastDuelTime: null,
    walletConnected: false,
    userId: 'localuser', // fallback for local use
    username: 'Anonymous' // fallback for local use
};

// --- DOM Elements ---
const mainBubble = document.getElementById('main-bubble-img');
const bubblecoinsDisplay = document.getElementById('bubblecoins');
const popTimer = document.getElementById('pop-timer');
const gameTimer = document.getElementById('game-timer');
const walletModal = document.getElementById('wallet-modal');
const connectWalletBtn = document.getElementById('connect-wallet');
const openWalletBtn = document.getElementById('open-wallet');

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const pageId = btn.dataset.page;
        showPage(pageId);
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// --- Show specific page ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// --- Intro animation ---
function createIntroBubbles() {
    const container = document.querySelector('.bubbles-container');
    container.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const bubble = document.createElement('img');
        bubble.src = 'img/bubble.png';
        bubble.className = 'bubble';
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.top = `${Math.random() * 100}%`;
        bubble.style.width = `${Math.random() * 50 + 30}px`;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        container.appendChild(bubble);
    }
    setTimeout(() => {
        document.getElementById('intro').classList.remove('active');
        showPage('main-game');
    }, 3000);
}

// --- Main bubble pop functionality ---
function setupMainBubble() {
    mainBubble.addEventListener('click', () => {
        const now = Date.now();
        if (!gameState.lastPopTime || now - gameState.lastPopTime >= 7200000) { // 2 hours
            const coins = Math.floor(Math.random() * 25) + 1;
            gameState.bubblecoins += coins;
            gameState.lastPopTime = now;
            updateDisplay();
            popBubble(mainBubble);
            saveGameState();
        }
    });
}

// --- Update timers and display ---
function updateDisplay() {
    bubblecoinsDisplay.textContent = gameState.bubblecoins;
    // Pop timer
    if (gameState.lastPopTime) {
        const timeLeft = 7200000 - (Date.now() - gameState.lastPopTime);
        if (timeLeft > 0) {
            popTimer.textContent = formatTime(timeLeft);
        } else {
            popTimer.textContent = 'Ready to pop!';
        }
    }
    // Mini game timer
    if (gameState.lastMiniGameTime) {
        const timeLeft = 86400000 - (Date.now() - gameState.lastMiniGameTime);
        if (timeLeft > 0) {
            gameTimer.textContent = formatTime(timeLeft);
        } else {
            gameTimer.textContent = 'Ready to play!';
        }
    }
    // Duel status (if duel page visible)
    const duelStatus = document.getElementById('duel-status');
    if (duelStatus && gameState.lastDuelTime) {
        const left = 7200000 - (Date.now() - gameState.lastDuelTime);
        if (left > 0) {
            duelStatus.textContent = 'Duel cooldown: ' + formatTime(left);
        } else if (!window.__activeDuelId) {
            duelStatus.textContent = 'You can start a new duel.';
        }
    }
}

// --- Format time in HH:MM:SS ---
function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// --- Wallet connection ---
function setupWalletConnection() {
    connectWalletBtn.addEventListener('click', () => {
        gameState.walletConnected = true;
        walletModal.classList.remove('active');
        openWalletBtn.textContent = 'Wallet Connected';
    });
    openWalletBtn.addEventListener('click', () => {
        if (!gameState.walletConnected) {
            walletModal.classList.add('active');
        }
    });
}

// --- Missions ---
function setupMissions() {
    document.querySelectorAll('.mission-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mission = btn.dataset.mission;
            if (mission === 'subscribe') {
                window.open('https://t.me/your_channel', '_blank'); // open in new tab
            } else if (mission === 'refer') {
                const referralLink = `https://t.me/your_bot?start=${gameState.userId}`;
                alert(`Your referral link: ${referralLink}`);
            }
        });
    });
}

// --- Mini game ---
function setupMiniGame() {
    const minigameArea = document.getElementById('minigame-area');
    const minigameTimer = document.getElementById('minigame-timer');
    function resetMinigameArea() {
        minigameArea.innerHTML = '';
        const confetti = document.querySelector('.confetti');
        if (confetti) confetti.remove();
    }
    function showConfetti() {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        for (let i = 0; i < 36; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.background = `hsl(${Math.random()*360}, 80%, 60%)`;
            piece.style.left = `${Math.random()*100}%`;
            piece.style.top = `${Math.random()*10}%`;
            piece.style.transform = `rotate(${Math.random()*360}deg)`;
            confetti.appendChild(piece);
        }
        minigameArea.appendChild(confetti);
        setTimeout(() => confetti.remove(), 1800);
    }
    function startMinigame() {
        resetMinigameArea();
        let popped = 0;
        let totalCoins = 0;
        const bubblesCount = 25;
        const poppedBubbles = new Set();
        for (let i = 0; i < bubblesCount; i++) {
            const bubble = document.createElement('img');
            bubble.src = 'img/bubble.png';
            bubble.className = 'bubble minigame-bubble';
            bubble.style.position = 'absolute';
            bubble.style.left = `${Math.random() * 100}%`;
            bubble.style.top = `${Math.random() * 100}%`;
            bubble.style.width = `${Math.random() * 50 + 30}px`;
            bubble.style.cursor = 'pointer';
            bubble.style.zIndex = 2;
            bubble.dataset.index = i;
            minigameArea.appendChild(bubble);
        }
        minigameArea.style.position = 'relative';
        minigameArea.style.height = '350px';
        minigameArea.querySelectorAll('.minigame-bubble').forEach(bubble => {
            bubble.addEventListener('click', function popHandler() {
                if (poppedBubbles.has(bubble.dataset.index) || popped >= 5) return;
                poppedBubbles.add(bubble.dataset.index);
                popped++;
                const coins = Math.floor(Math.random() * 98) + 3; // 3-100
                totalCoins += coins;
                popBubble(bubble);
                const coinLabel = document.createElement('div');
                coinLabel.textContent = `+${coins}`;
                coinLabel.className = 'coin-label';
                coinLabel.style.position = 'absolute';
                coinLabel.style.left = bubble.style.left;
                coinLabel.style.top = bubble.style.top;
                coinLabel.style.color = '#FFD700';
                coinLabel.style.fontWeight = 'bold';
                coinLabel.style.fontSize = '18px';
                coinLabel.style.zIndex = 10;
                coinLabel.style.pointerEvents = 'none';
                minigameArea.appendChild(coinLabel);
                setTimeout(() => coinLabel.remove(), 1000);
                if (popped === 5) {
                    setTimeout(() => {
                        showCongratulationsWithLeaderboard(totalCoins);
                        gameState.bubblecoins += totalCoins;
                        gameState.lastMiniGameTime = Date.now();
                        updateDisplay();
                        saveGameState();
                    }, 700);
                }
            });
        });
    }
    document.querySelector('[data-page="minigame"]').addEventListener('click', () => {
        resetMinigameArea();
        const now = Date.now();
        if (!gameState.lastMiniGameTime || now - gameState.lastMiniGameTime >= 86400000) {
            minigameTimer.textContent = '';
            startMinigame();
        } else {
            const timeLeft = 86400000 - (now - gameState.lastMiniGameTime);
            minigameArea.innerHTML = '<p style="text-align:center;margin-top:100px;">Next game available in:<br><b>' + formatTime(timeLeft) + '</b></p>';
        }
    });
}

// --- Reaction Test mode ---
function setupReactionTest() {
    const area = document.getElementById('reaction-area');
    const startBtn = document.getElementById('reaction-start');
    const timeEl = document.getElementById('reaction-time');
    const scoreEl = document.getElementById('reaction-score-value');
    if (!area || !startBtn || !timeEl || !scoreEl) return;

    let running = false;
    let remainingMs = 60000; // 1 minute
    let tickTimer = null;
    let spawnTimer = null;
    let score = 0;

    function resetUI() {
        running = false;
        remainingMs = 60000;
        score = 0;
        timeEl.textContent = '01:00';
        scoreEl.textContent = '0';
        area.innerHTML = '';
        startBtn.disabled = false;
    }

    function spawnBubble() {
        const bubble = document.createElement('img');
        bubble.src = 'img/bubble.png';
        bubble.style.position = 'absolute';
        bubble.style.cursor = 'pointer';
        const size = Math.floor(Math.random() * 40) + 30; // 30-70px
        bubble.style.width = size + 'px';
        bubble.style.height = 'auto';
        const rect = area.getBoundingClientRect();
        const maxLeft = Math.max(0, rect.width - size);
        const maxTop = Math.max(0, rect.height - size);
        bubble.style.left = Math.floor(Math.random() * maxLeft) + 'px';
        bubble.style.top = Math.floor(Math.random() * maxTop) + 'px';
        bubble.addEventListener('click', () => {
            score++;
            scoreEl.textContent = String(score);
            bubble.remove();
        }, { once: true });
        // Auto-remove after a short while to keep the field clean
        setTimeout(() => bubble.remove(), 2500);
        area.appendChild(bubble);
    }

    function updateSpawnInterval() {
        if (spawnTimer) clearInterval(spawnTimer);
        const elapsed = 60000 - remainingMs;
        const interval = elapsed < 30000 ? 2000 : 1000; // first 30s every 2s, last 30s every 1s
        spawnTimer = setInterval(() => {
            if (!running) return;
            spawnBubble();
        }, interval);
    }

    function format(ms) {
        const s = Math.max(0, Math.ceil(ms / 1000));
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return mm + ':' + ss;
    }

    function endGame() {
        running = false;
        if (tickTimer) clearInterval(tickTimer);
        if (spawnTimer) clearInterval(spawnTimer);
        area.innerHTML = '';
        // Show results
        let feedback = 'Try harder!';
        if (score >= 30 && score <= 40) feedback = 'Super!';
        else if (score >= 20 && score <= 29) feedback = 'Good!';
        const results = document.createElement('div');
        results.className = 'congrats-table';
        results.innerHTML = '<h3>Reaction Test Result</h3>' +
            '<p>You popped <b>' + score + '</b> bubbles.</p>' +
            '<p>' + feedback + '</p>' +
            '<button class="btn" id="reaction-reset">Play Again</button>';
        area.appendChild(results);
        const resetBtn = document.getElementById('reaction-reset');
        if (resetBtn) resetBtn.onclick = () => { resetUI(); };
        startBtn.disabled = false;
    }

    function startGame() {
        if (running) return;
        running = true;
        remainingMs = 60000;
        score = 0;
        area.innerHTML = '';
        scoreEl.textContent = '0';
        startBtn.disabled = true;
        updateSpawnInterval();
        // spawn immediately so player has something to click
        spawnBubble();
        tickTimer = setInterval(() => {
            remainingMs -= 250; // smooth timer updates
            if (remainingMs <= 0) {
                timeEl.textContent = '00:00';
                endGame();
            } else {
                timeEl.textContent = format(remainingMs);
                // If we cross 30s boundary, refresh spawn rate
                const elapsed = 60000 - remainingMs;
                if (Math.abs(30000 - elapsed) < 200) updateSpawnInterval();
            }
        }, 250);
    }

    startBtn.addEventListener('click', startGame);
    // Reset when navigating to the page
    document.querySelector('[data-page="reaction"]').addEventListener('click', () => {
        resetUI();
    });

    resetUI();
}

// --- Duel Mode ---
function setupDuelMode() {
    // Temporarily disable Duel Mode (no API calls)
    try {
        const duelPage = document.getElementById('duel');
        const duelStatusEl = document.getElementById('duel-status');
        const duelControls = document.getElementById('duel-controls');
        const duelAreaEl = document.getElementById('duel-area');
        if (duelControls) duelControls.style.display = 'none';
        if (duelAreaEl) duelAreaEl.innerHTML = '';
        if (duelStatusEl) duelStatusEl.textContent = 'Duel mode is temporarily disabled.';
        const duelNavBtn = document.querySelector('[data-page="duel"]');
        if (duelNavBtn) {
            duelNavBtn.addEventListener('click', () => {
                const s = document.getElementById('duel-status');
                if (s) s.textContent = 'Duel mode is temporarily disabled.';
            });
        }
    } catch (_) {}
    return; // Early exit to fully disable Duel Mode
    const duelArea = document.getElementById('duel-area');
    const createBtn = document.getElementById('create-duel');
    const duelLinkWrap = document.getElementById('duel-link-wrap');
    const duelLinkInput = document.getElementById('duel-link');
    const copyBtn = document.getElementById('copy-duel-link');
    const duelStatus = document.getElementById('duel-status');

    // Resolve API base from URL (?api=), localStorage, or window.API_BASE
    function resolveApiBase() {
        try {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('api');
            if (q) {
                try { localStorage.setItem('API_BASE', q); } catch (_) {}
                return q;
            }
            try {
                const s = localStorage.getItem('API_BASE');
                if (s) return s;
            } catch (_) {}
        } catch (_) {}
        return (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '';
    }
    const API_BASE = resolveApiBase();

    async function api(path, opts = {}) {
        const url = (API_BASE || '') + path;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
        if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
        return res.json();
    }

    function renderDuelBubbles(values, onPick) {
        duelArea.innerHTML = '';
        const grid = document.createElement('div');
        grid.style.position = 'relative';
        grid.style.height = '360px';
        grid.style.borderRadius = '14px';
        grid.style.background = 'rgba(255,255,255,0.06)';
        grid.style.overflow = 'hidden';
        const picked = new Set();
        for (let i = 0; i < values.length; i++) {
            const bubble = document.createElement('img');
            bubble.src = 'img/bubble.png';
            bubble.className = 'bubble minigame-bubble';
            bubble.style.position = 'absolute';
            bubble.style.left = `${Math.random() * 100}%`;
            bubble.style.top = `${Math.random() * 100}%`;
            bubble.style.width = `${Math.random() * 50 + 30}px`;
            bubble.style.cursor = 'pointer';
            bubble.style.zIndex = 2;
            bubble.dataset.index = i;
            grid.appendChild(bubble);
        }
        duelArea.appendChild(grid);
        let count = 0; let total = 0;
        grid.querySelectorAll('.minigame-bubble').forEach(bubble => {
            bubble.addEventListener('click', () => {
                const idx = parseInt(bubble.dataset.index, 10);
                if (picked.has(idx) || count >= 5) return;
                picked.add(idx); count++;
                const coins = values[idx]; total += coins;
                popBubble(bubble);
                const coinLabel = document.createElement('div');
                coinLabel.textContent = `+${coins}`;
                coinLabel.className = 'coin-label';
                coinLabel.style.left = bubble.style.left;
                coinLabel.style.top = bubble.style.top;
                coinLabel.style.color = '#FFD700';
                coinLabel.style.fontWeight = 'bold';
                coinLabel.style.fontSize = '18px';
                coinLabel.style.zIndex = 10;
                grid.appendChild(coinLabel);
                setTimeout(() => coinLabel.remove(), 1000);
                if (count === 5) {
                    onPick(Array.from(picked));
                }
            });
        });
    }

    async function loadOrJoinDuelFromUrl() {
        const params = new URLSearchParams(location.search);
        const duelId = params.get('duel');
        if (!duelId) return;
        try {
            await api(`/api/duels/${duelId}/join`, { method: 'POST', body: JSON.stringify({ userId: gameState.userId, username: gameState.username }) });
        } catch (e) {}
        const duel = await api(`/api/duels/${duelId}`);
        window.__activeDuelId = duel.id;
        duelStatus.textContent = 'Duel joined. Pop 5 bubbles!';
        renderDuelBubbles(duel.bubbleValues, async (picked) => {
            try {
                const resp = await api(`/api/duels/${duel.id}/submit`, { method: 'POST', body: JSON.stringify({ userId: gameState.userId, poppedIndices: picked }) });
                if (resp.status === 'completed') {
                    await handleDuelResult(duel.id);
                } else {
                    duelStatus.textContent = 'Waiting for opponent to finish...';
                }
            } catch (err) {
                duelStatus.textContent = err.error || 'Submit failed';
            }
        });
        duelLinkWrap.style.display = 'block';
        duelLinkInput.value = location.href.split('#')[0];
    }

    async function handleDuelResult(duelId) {
        const d = await api(`/api/duels/${duelId}`);
        const players = Object.values(d.players);
        const me = d.players[gameState.userId];
        const other = players.find(p => p.userId !== gameState.userId);
        let msg = '';
        if (d.winner === 'tie') msg = `Tie! You earned ${me.total}`;
        else if (d.winner === gameState.userId) {
            msg = `You win! +${me.total} BubbleCoins`;
            gameState.bubblecoins += me.total;
            gameState.lastDuelTime = Date.now();
            saveGameState();
            updateDisplay();
        } else if (other) {
            msg = `${other.username} wins. You got ${me.total}.`;
            gameState.lastDuelTime = Date.now();
            saveGameState();
            updateDisplay();
        }
        duelArea.innerHTML = `<div class="congrats-table"><h3>Duel Result</h3><p>${msg}</p><button class="btn" id="back-home-from-duel">Back to Home</button></div>`;
        const btn = document.getElementById('back-home-from-duel');
        if (btn) btn.onclick = () => { showPage('main-game'); };
        window.__activeDuelId = null;
    }

    createBtn.addEventListener('click', async () => {
        // Cooldown check client-side for UX
        if (gameState.lastDuelTime && Date.now() - gameState.lastDuelTime < 7200000) {
            const left = 7200000 - (Date.now() - gameState.lastDuelTime);
            duelStatus.textContent = 'Cooldown: ' + formatTime(left);
            return;
        }
        try {
            const resp = await api('/api/duels', { method: 'POST', body: JSON.stringify({ userId: gameState.userId, username: gameState.username }) });
            const url = new URL(location.href);
            url.searchParams.set('duel', resp.id);
            duelLinkInput.value = url.toString();
            duelLinkWrap.style.display = 'block';
            duelStatus.textContent = 'Share this link with your opponent.';
            window.__activeDuelId = resp.id;
            const duel = await api(`/api/duels/${resp.id}`);
            renderDuelBubbles(duel.bubbleValues, async (picked) => {
                try {
                    const submit = await api(`/api/duels/${resp.id}/submit`, { method: 'POST', body: JSON.stringify({ userId: gameState.userId, poppedIndices: picked }) });
                    if (submit.status === 'completed') {
                        await handleDuelResult(resp.id);
                    } else {
                        duelStatus.textContent = 'Waiting for opponent to finish...';
                    }
                } catch (err) {
                    duelStatus.textContent = err.error || 'Submit failed';
                }
            });
        } catch (err) {
            if (err.remainingMs) duelStatus.textContent = 'Cooldown: ' + formatTime(err.remainingMs);
            else duelStatus.textContent = err.error || 'Failed to create duel';
        }
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(duelLinkInput.value);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1200);
        } catch (_) {}
    });

    document.querySelector('[data-page="duel"]').addEventListener('click', () => {
        duelArea.innerHTML = '';
        duelStatus.textContent = 'Create or open a duel link.';
        const params = new URLSearchParams(location.search);
        if (params.get('duel')) loadOrJoinDuelFromUrl();
    });

    // Auto-join if the app opened with a duel param
    if (new URLSearchParams(location.search).get('duel')) {
        showPage('duel');
        loadOrJoinDuelFromUrl();
    }
}

// --- Save/Load game state ---
function saveGameState() {
    if (gameState.userId) {
        localStorage.setItem(`gameState_${gameState.userId}`, JSON.stringify(gameState));
    }
}
function loadGameState() {
    if (gameState.userId) {
        const savedState = localStorage.getItem(`gameState_${gameState.userId}`);
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            gameState = { ...gameState, ...parsedState };
            updateDisplay();
        }
    }
}

// --- Pop bubble animation ---
function popBubble(bubbleElement) {
    const rect = bubbleElement.getBoundingClientRect();
    bubbleElement.style.visibility = 'hidden';
}

// --- Telegram WebApp Integration ---
function initTelegramWebApp() {
    if (tg) {
        // Initialize the WebApp
        tg.ready();
        
        // Get user data from Telegram
        const user = tg.initDataUnsafe?.user;
        if (user) {
            gameState.userId = user.id.toString();
            gameState.username = user.first_name || 'Anonymous';
        }
        
        // Enable closing confirmation
        tg.enableClosingConfirmation();
        
        // Set main button if needed
        tg.MainButton.setText('Play Game');
        tg.MainButton.show();
        
        // Handle main button click
        tg.MainButton.onClick(() => {
            showPage('main-game');
        });
        
        console.log('Telegram WebApp initialized');
    } else {
        console.log('Running outside Telegram - using local mode');
    }
}

// --- Init ---
function init() {
    initTelegramWebApp();
    createBackgroundBubbles();
    setupThemeToggle();
    createIntroBubbles();
    setupMainBubble();
    setupWalletConnection();
    setupMissions();
    setupMiniGame();
    setupReactionTest();
    setupDuelMode();
    loadGameState();
    setInterval(updateDisplay, 1000);
    setInterval(saveGameState, 300000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadGameState();
        }
    });
    window.addEventListener('beforeunload', () => {
        try { saveGameState(); } catch (_) {}
    });
}
document.addEventListener('DOMContentLoaded', init); 
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'back-to-home') { showPage('main-game'); }
  });
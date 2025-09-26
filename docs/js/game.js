// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;

// Initialize TON Connect
let tonConnect = null;
let wallet = null;

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

// --- Patch: Add congratulations to minigame win ---
function showCongratulationsWithLeaderboard(total) {
    const minigameArea = document.getElementById('minigame-area');
    minigameArea.innerHTML = `
        <div class="congrats-table">
            <h3>Congratulations!</h3>
            <p>You have earned <b>${total}</b> BubbleCoins</p>
            <button class="btn" id="back-to-home">Back to Home</button>
        </div>
    `;
    showConfetti();
    document.getElementById('back-to-home').onclick = () => {
        showPage('main-game');
    };
}

// --- Game State ---
let gameState = {
    bubblecoins: 0,
    lastPopTime: null,
    lastMiniGameTime: null,
    walletConnected: false,
    userId: 'localuser', // fallback for local use
    username: 'Anonymous', // fallback for local use
    totalGamesPlayed: 0,
    bestReactionScore: 0,
    referralCode: null, // user's referral code
    referralsCount: 0, // number of successful referrals
    referralRewardClaimed: false, // whether 100 coin reward was claimed
    reactionTest: {
        running: false,
        remainingMs: 0,
        tickTimer: null,
        spawnTimer: null,
        score: 0
    }
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
            saveUserProgress(); // Auto-save when earning coins
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
}

// --- Format time in HH:MM:SS ---
function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// --- TON Connect initialization ---
async function initTonConnect() {
    try {
        console.log('Initializing TON Connect...');
        
        // Check if TonConnect is available globally
        if (typeof TonConnect !== 'undefined') {
            console.log('TON Connect SDK found, initializing...');
            
            // Initialize TON Connect
            tonConnect = new TonConnect({
                manifestUrl: 'https://vrtesikkk.github.io/Bubblesgame/tonconnect-manifest.json'
            });
            
            console.log('TON Connect initialized');

            // Check if wallet is already connected
            const connectedWallets = await tonConnect.getConnectedWallets();
            console.log('Connected wallets on init:', connectedWallets);
            
            if (connectedWallets.length > 0) {
                wallet = connectedWallets[0];
                gameState.walletConnected = true;
                gameState.userId = wallet.account.address;
                gameState.username = wallet.account.address.slice(0, 8) + '...';
                openWalletBtn.textContent = `TON: ${gameState.username}`;
                loadUserProgress();
                // Process referral code now that user is identified
                processReferralCode();
                console.log('Wallet already connected:', wallet.account.address);
            }
        } else {
            console.log('TON Connect SDK not loaded - using fallback');
        }
    } catch (error) {
        console.error('TON Connect initialization error:', error);
    }
}

// --- Wallet connection ---
function setupWalletConnection() {
    // Initialize TON Connect
    initTonConnect();
    // Check if Telegram WebApp is available
    if (tg) {
        // Initialize with Telegram user data
        const user = tg.initDataUnsafe?.user;
        if (user) {
            gameState.walletConnected = true;
            gameState.userId = user.id.toString();
            gameState.username = user.username || user.first_name;
            openWalletBtn.textContent = `Connected: ${user.first_name}`;
            loadUserProgress();
            // Process referral code now that user is identified
            processReferralCode();
        }
    }

    connectWalletBtn.addEventListener('click', async () => {
        try {
            if (tonConnect) {
                // Get available wallets
                const wallets = await tonConnect.getWallets();
                console.log('Available wallets:', wallets);
                
                if (wallets.length > 0) {
                    // Create connection source for the first available wallet
                    const connectionSource = {
                        jsBridgeKey: wallets[0].jsBridgeKey
                    };
                    
                    console.log('Connecting to wallet:', wallets[0]);
                    
                    // Connect to wallet
                    await tonConnect.connect(connectionSource);
                    
                    // Get connected wallets after connection
                    const connectedWallets = await tonConnect.getConnectedWallets();
                    console.log('Connected wallets:', connectedWallets);
                    
                    if (connectedWallets.length > 0) {
                        wallet = connectedWallets[0];
                        gameState.walletConnected = true;
                        gameState.userId = wallet.account.address;
                        gameState.username = wallet.account.address.slice(0, 8) + '...';
                        walletModal.classList.remove('active');
                        openWalletBtn.textContent = `TON: ${gameState.username}`;
                        loadUserProgress();
                        // Process referral code now that user is identified
                        processReferralCode();
                        saveUserProgress();
                        
                        if (tg) {
                            tg.showAlert('TON Wallet connected successfully!');
                        } else {
                            alert('TON Wallet connected successfully!');
                        }
                    } else {
                        throw new Error('No wallets connected after connection attempt');
                    }
                } else {
                    throw new Error('No TON wallets available');
                }
            } else {
                throw new Error('TON Connect not initialized');
            }
        } catch (error) {
            console.error('TON wallet connection error:', error);
            
            // Fallback to Telegram user data
            if (tg) {
                try {
                    await tg.requestAccess();
                    const user = tg.initDataUnsafe?.user;
                    if (user) {
                        gameState.walletConnected = true;
                        gameState.userId = user.id.toString();
                        gameState.username = user.username || user.first_name;
                        walletModal.classList.remove('active');
                        openWalletBtn.textContent = `Telegram: ${user.first_name}`;
                        saveUserProgress();
                        tg.showAlert('Connected via Telegram!');
                    } else {
                        tg.showAlert('Failed to connect wallet. Please try again.');
                    }
                } catch (telegramError) {
                    console.error('Telegram fallback error:', telegramError);
                    tg.showAlert('Failed to connect wallet. Please try again.');
                }
            } else {
                // Demo mode fallback
                gameState.walletConnected = true;
                gameState.userId = 'demo_user_' + Date.now();
                gameState.username = 'Demo User';
                walletModal.classList.remove('active');
                openWalletBtn.textContent = 'Demo Wallet Connected';
                saveUserProgress();
                alert('Connected in demo mode!');
            }
        }
    });

    openWalletBtn.addEventListener('click', () => {
        if (!gameState.walletConnected) {
            walletModal.classList.add('active');
        } else {
            // Show wallet info
            if (tg) {
                tg.showAlert(`Wallet: ${gameState.username}\nBubbleCoins: ${gameState.bubblecoins}`);
            } else {
                alert(`Wallet: ${gameState.username}\nBubbleCoins: ${gameState.bubblecoins}`);
            }
        }
    });
}

// --- Progress saving functions ---
function saveUserProgress() {
    if (gameState.walletConnected && gameState.userId) {
        const progress = {
            userId: gameState.userId,
            username: gameState.username,
            bubblecoins: gameState.bubblecoins,
            lastPlayTime: Date.now(),
            totalGamesPlayed: gameState.totalGamesPlayed || 0,
            bestReactionScore: gameState.bestReactionScore || 0,
            referralCode: gameState.referralCode,
            referralsCount: gameState.referralsCount || 0,
            referralRewardClaimed: gameState.referralRewardClaimed || false
        };
        
        // Save to localStorage as backup
        localStorage.setItem(`bubbles_progress_${gameState.userId}`, JSON.stringify(progress));
        
        // In a real app, you would send this to your server
        console.log('Progress saved:', progress);
        
        if (tg) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
}

function loadUserProgress() {
    if (gameState.walletConnected && gameState.userId) {
        const saved = localStorage.getItem(`bubbles_progress_${gameState.userId}`);
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                gameState.bubblecoins = progress.bubblecoins || 0;
                gameState.totalGamesPlayed = progress.totalGamesPlayed || 0;
                gameState.bestReactionScore = progress.bestReactionScore || 0;
                gameState.referralCode = progress.referralCode;
                gameState.referralsCount = progress.referralsCount || 0;
                gameState.referralRewardClaimed = progress.referralRewardClaimed || false;
                updateDisplay();
                console.log('Progress loaded:', progress);
            } catch (error) {
                console.error('Failed to load progress:', error);
            }
        }
    }
}

// --- Referral System ---
function generateReferralCode() {
    if (!gameState.referralCode) {
        // Generate a unique referral code based on user ID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        gameState.referralCode = `${gameState.userId}_${timestamp}_${random}`;
        saveUserProgress();
    }
    return gameState.referralCode;
}

function getReferralLink() {
    const code = generateReferralCode();
    return `https://vrtesikkk.github.io/Bubblesgame/?ref=${code}`;
}

function checkReferralReward() {
    if (gameState.referralsCount >= 5 && !gameState.referralRewardClaimed) {
        gameState.bubblecoins += 100;
        gameState.referralRewardClaimed = true;
        updateDisplay();
        saveUserProgress();
        
        if (tg) {
            tg.showAlert('🎉 Congratulations! You earned 100 BubbleCoins for referring 5 friends!');
        } else {
            alert('🎉 Congratulations! You earned 100 BubbleCoins for referring 5 friends!');
        }
    }
}

function processReferralCode() {
    console.log('Processing referral code...');
    console.log('Current gameState.userId:', gameState.userId);
    
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    console.log('Referral code from URL:', refCode);
    console.log('Current user referral code:', gameState.referralCode);
    
    if (refCode && refCode !== gameState.referralCode && gameState.userId) {
        // This user came from a referral link
        const referrerUserId = refCode.split('_')[0];
        
        console.log('Processing referral for referrer:', referrerUserId);
        
        // Store referral data
        const referralData = {
            referrer: referrerUserId,
            referee: gameState.userId,
            timestamp: Date.now(),
            code: refCode
        };
        
        // Save referral locally (in a real app, this would go to a server)
        const referrals = JSON.parse(localStorage.getItem('referrals') || '[]');
        referrals.push(referralData);
        localStorage.setItem('referrals', JSON.stringify(referrals));
        
        // Update referrer's count
        updateReferrerCount(referrerUserId);
        
        console.log('Referral processed:', referralData);
        
        // Show success message
        if (tg) {
            tg.showAlert('🎉 Welcome! You joined via a referral link!');
        } else {
            alert('🎉 Welcome! You joined via a referral link!');
        }
    } else {
        console.log('No referral code to process or invalid conditions');
    }
}

function updateReferrerCount(referrerUserId) {
    console.log('Updating referrer count for:', referrerUserId);
    
    // Get all referrals for this referrer
    const referrals = JSON.parse(localStorage.getItem('referrals') || '[]');
    const referrerReferrals = referrals.filter(r => r.referrer === referrerUserId);
    
    console.log('Total referrals for this user:', referrerReferrals.length);
    console.log('Current user ID:', gameState.userId);
    
    // Update referrer's game state if they're the current user
    if (referrerUserId === gameState.userId) {
        gameState.referralsCount = referrerReferrals.length;
        console.log('Updated referrals count to:', gameState.referralsCount);
        checkReferralReward();
        saveUserProgress();
    } else {
        console.log('Referrer is not current user, not updating count');
    }
}

// --- Missions ---
function setupMissions() {
    document.querySelectorAll('.mission-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mission = btn.dataset.mission;
            if (mission === 'subscribe') {
                window.open('https://t.me/bubblesgameco', '_blank'); // open in new tab
            } else if (mission === 'refer') {
                const referralLink = getReferralLink();
                
                console.log('Share button clicked');
                console.log('navigator.share available:', !!navigator.share);
                console.log('navigator.canShare available:', !!navigator.canShare);
                console.log('User agent:', navigator.userAgent);
                console.log('Telegram WebApp available:', !!tg);
                
                // Try multiple sharing methods
                let shareAttempted = false;
                
                // Method 1: Try Web Share API first
                if (navigator.share && !shareAttempted) {
                    console.log('Attempting Web Share API...');
                    shareAttempted = true;
                    
                    // Try with just URL first (most compatible)
                    navigator.share({
                        url: referralLink
                    }).then(() => {
                        console.log('Web Share API successful');
                        if (tg) {
                            tg.HapticFeedback.impactOccurred('medium');
                        }
                    }).catch(err => {
                        console.log('Web Share API failed:', err);
                        // Try with full data
                        const shareData = {
                            title: 'Join Bubbles Game!',
                            text: 'Play this fun bubble game and earn rewards!',
                            url: referralLink
                        };
                        
                        navigator.share(shareData).then(() => {
                            console.log('Web Share API with full data successful');
                            if (tg) {
                                tg.HapticFeedback.impactOccurred('medium');
                            }
                        }).catch(err2 => {
                            console.log('Web Share API with full data failed:', err2);
                            shareAttempted = false; // Allow fallback
                        });
                    });
                }
                
                // Method 2: Try Telegram's openLink with share URL
                if (tg && tg.openLink && !shareAttempted) {
                    console.log('Attempting Telegram share...');
                    shareAttempted = true;
                    
                    const shareText = 'Join Bubbles Game! 🎮\n\nPlay this fun bubble game and earn rewards!';
                    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
                    
                    try {
                        tg.openLink(telegramShareUrl);
                        console.log('Telegram share opened');
                        if (tg.HapticFeedback) {
                            tg.HapticFeedback.impactOccurred('medium');
                        }
                    } catch (err) {
                        console.log('Telegram share failed:', err);
                        shareAttempted = false;
                    }
                }
                
                // Method 3: Try window.open with share URL
                if (!shareAttempted) {
                    console.log('Attempting window.open share...');
                    shareAttempted = true;
                    
                    const shareText = 'Join Bubbles Game! 🎮\n\nPlay this fun bubble game and earn rewards!';
                    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
                    
                    try {
                        window.open(shareUrl, '_blank');
                        console.log('Window share opened');
                    } catch (err) {
                        console.log('Window share failed:', err);
                        shareAttempted = false;
                    }
                }
                
                // Method 4: Fallback to popup with options
                if (!shareAttempted) {
                    console.log('Using fallback popup...');
                    
                    if (tg && tg.showPopup) {
                        tg.showPopup({
                            title: 'Share Referral Link',
                            message: 'Choose how to share your referral link:',
                            buttons: [
                                { id: 'copy', type: 'default', text: 'Copy Link' },
                                { id: 'telegram', type: 'default', text: 'Share via Telegram' },
                                { id: 'cancel', type: 'cancel', text: 'Cancel' }
                            ]
                        }, (buttonId) => {
                            if (buttonId === 'copy') {
                                copyToClipboard(referralLink);
                            } else if (buttonId === 'telegram') {
                                const shareText = 'Join Bubbles Game! 🎮\n\nPlay this fun bubble game and earn rewards!';
                                const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
                                
                                if (tg.openLink) {
                                    tg.openLink(telegramShareUrl);
                                } else {
                                    window.open(telegramShareUrl, '_blank');
                                }
                            }
                        });
                    } else {
                        // Final fallback - copy to clipboard
                        copyToClipboard(referralLink);
                    }
                }
            }
        });
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            if (tg) {
                tg.showAlert(`✅ Referral link copied to clipboard!\n\nShare this link with friends to earn 100 BubbleCoins when 5 people join!`);
                tg.HapticFeedback.impactOccurred('light');
            } else {
                alert(`✅ Referral link copied to clipboard!\n\n${text}\n\nShare this link with friends to earn 100 BubbleCoins when 5 people join!`);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (tg) {
            tg.showAlert(`✅ Referral link copied to clipboard!\n\nShare this link with friends to earn 100 BubbleCoins when 5 people join!`);
            tg.HapticFeedback.impactOccurred('light');
        } else {
            alert(`✅ Referral link copied to clipboard!\n\n${text}\n\nShare this link with friends to earn 100 BubbleCoins when 5 people join!`);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        if (tg) {
            tg.showAlert(`Your referral link:\n${text}\n\nCopy this link and share with friends to earn 100 BubbleCoins when 5 people join!`);
        } else {
            alert(`Your referral link:\n${text}\n\nCopy this link and share with friends to earn 100 BubbleCoins when 5 people join!`);
        }
    }
    document.body.removeChild(textArea);
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
                        gameState.bubblecoins += totalCoins;
                        gameState.lastMiniGameTime = Date.now();
                        gameState.totalGamesPlayed++;
                        updateDisplay();
                        saveUserProgress(); // Auto-save when earning coins
                        saveGameState();
                        showCongratulationsWithLeaderboard(totalCoins);
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
        startBtn.textContent = 'Start';
        if (tickTimer) clearInterval(tickTimer);
        if (spawnTimer) clearInterval(spawnTimer);
        tickTimer = null;
        spawnTimer = null;
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
        // Auto-remove timing: 2s for first 30s, 1s for last 30s
        const elapsed = 60000 - remainingMs;
        const removeDelay = elapsed < 30000 ? 2000 : 1000;
        setTimeout(() => bubble.remove(), removeDelay);
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
        startBtn.textContent = 'Start';
    }

    function startGame() {
        if (running) return;
        running = true;
        remainingMs = 60000;
        score = 0;
        area.innerHTML = '';
        scoreEl.textContent = '0';
        startBtn.disabled = true;
        startBtn.textContent = 'Playing...';
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

    function endGame() {
        clearInterval(tickTimer);
        clearInterval(spawnTimer);
        running = false;
        startBtn.disabled = false;
        startBtn.textContent = 'Play Again';
        
        // Update best score
        if (score > gameState.bestReactionScore) {
            gameState.bestReactionScore = score;
        }
        
        // Show results
        let feedback = '';
        if (score >= 30) {
            feedback = 'Super!';
        } else if (score >= 20) {
            feedback = 'Good!';
                    } else {
            feedback = 'Try harder!';
        }
        
        area.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-primary);">
                <h3 style="color: var(--accent-success); margin-bottom: 16px;">Game Over!</h3>
                <p style="font-size: 1.2rem; margin-bottom: 8px;">Score: ${score}</p>
                <p style="font-size: 1.1rem; color: var(--accent-gold); margin-bottom: 16px;">${feedback}</p>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">Best Score: ${gameState.bestReactionScore}</p>
            </div>
        `;
        
        // Save progress
        gameState.totalGamesPlayed++;
        saveUserProgress();
    }

    startBtn.addEventListener('click', startGame);
    // Reset when navigating to the page
    document.querySelector('[data-page="reaction"]').addEventListener('click', () => {
        resetUI();
    });

    resetUI();
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
document.addEventListener('DOMContentLoaded', () => {
    init();
    // Initialize referral system after a short delay to ensure wallet is connected
    setTimeout(() => {
        processReferralCode();
    }, 1000);
}); 
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'back-to-home') { showPage('main-game'); }
  });
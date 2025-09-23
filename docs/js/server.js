// Simple Express server with Duel mode APIs and static file serving
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Serve static assets for the SPA from the docs directory (one level up)
// __dirname here is .../docs/js, so we resolve to the parent /docs folder
const staticDir = path.resolve(__dirname, '..');
app.use(express.static(staticDir));

// --- Simple JSON file persistence helpers ---
// Use a writable directory in serverless (e.g., Vercel) and local disk otherwise
// Store local data alongside the docs folder (../.data)
const dataDir = process.env.VERCEL ? path.join('/tmp', 'data') : path.resolve(__dirname, '..', '.data');
const duelsFile = path.join(dataDir, 'duels.json');
const cooldownFile = path.join(dataDir, 'duel_cooldowns.json');

function ensureDataDir() {
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir);
	}
}

function loadJson(filePath, fallback) {
	try {
		if (!fs.existsSync(filePath)) return fallback;
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw || 'null') || fallback;
	} catch (e) {
		console.error('Failed to load JSON', filePath, e);
		return fallback;
	}
}

function saveJson(filePath, data) {
	try {
		ensureDataDir();
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
		return true;
	} catch (e) {
		console.error('Failed to save JSON', filePath, e);
		return false;
	}
}

function generateId() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(4);
}

function now() {
	return Date.now();
}

const DUEL_DURATION_MS = 1000 * 60 * 60 * 4; // 4 hours expiry window
const DUEL_COOLDOWN_MS = 1000 * 60 * 60 * 2; // 2 hours cooldown

// --- API: Create a duel ---
app.post('/api/duels', (req, res) => {
	const { userId, username } = req.body || {};
	if (!userId) return res.status(400).json({ error: 'userId required' });
	const cooldowns = loadJson(cooldownFile, {});
	const last = cooldowns[userId] || 0;
	if (now() - last < DUEL_COOLDOWN_MS) {
		const remaining = DUEL_COOLDOWN_MS - (now() - last);
		return res.status(429).json({ error: 'Cooldown active', remainingMs: remaining });
	}
	const duels = loadJson(duelsFile, {});
	const id = generateId();
	// Pre-generate 20 bubble values (10-50 inclusive)
	const bubbleValues = Array.from({ length: 20 }, () => 10 + Math.floor(Math.random() * 41));
	duels[id] = {
		id,
		createdAt: now(),
		expiresAt: now() + DUEL_DURATION_MS,
		bubbleValues,
		players: {
			[userId]: { userId, username: username || 'Anonymous', poppedIndices: [], total: null, submittedAt: null }
		},
		status: 'waiting',
		winner: null
	};
	saveJson(duelsFile, duels);
	return res.json({ id, expiresAt: duels[id].expiresAt });
});

// --- API: Get duel state ---
app.get('/api/duels/:id', (req, res) => {
	const { id } = req.params;
	const duels = loadJson(duelsFile, {});
	const duel = duels[id];
	if (!duel) return res.status(404).json({ error: 'Not found' });
	return res.json(duel);
});

// --- API: Join duel ---
app.post('/api/duels/:id/join', (req, res) => {
	const { id } = req.params;
	const { userId, username } = req.body || {};
	if (!userId) return res.status(400).json({ error: 'userId required' });
	const duels = loadJson(duelsFile, {});
	const duel = duels[id];
	if (!duel) return res.status(404).json({ error: 'Not found' });
	if (now() > duel.expiresAt) return res.status(410).json({ error: 'Duel expired' });
	if (!duel.players[userId]) {
		if (Object.keys(duel.players).length >= 2) return res.status(409).json({ error: 'Duel full' });
		duel.players[userId] = { userId, username: username || 'Anonymous', poppedIndices: [], total: null, submittedAt: null };
	}
	duel.status = 'in_progress';
	saveJson(duelsFile, duels);
	return res.json({ ok: true, id: duel.id });
});

// --- API: Submit results ---
app.post('/api/duels/:id/submit', (req, res) => {
	const { id } = req.params;
	const { userId, poppedIndices } = req.body || {};
	if (!userId || !Array.isArray(poppedIndices)) return res.status(400).json({ error: 'userId and poppedIndices required' });
	const duels = loadJson(duelsFile, {});
	const duel = duels[id];
	if (!duel) return res.status(404).json({ error: 'Not found' });
	if (!duel.players[userId]) return res.status(403).json({ error: 'Not a participant' });
	if (poppedIndices.length !== 5) return res.status(400).json({ error: 'Exactly 5 bubbles must be popped' });
	// Cooldown check on submit to prevent bypass
	const cooldowns = loadJson(cooldownFile, {});
	const last = cooldowns[userId] || 0;
	if (now() - last < DUEL_COOLDOWN_MS) {
		const remaining = DUEL_COOLDOWN_MS - (now() - last);
		return res.status(429).json({ error: 'Cooldown active', remainingMs: remaining });
	}
	// Compute total
	let total = 0;
	for (const idx of poppedIndices) {
		const val = duel.bubbleValues[idx];
		if (typeof val !== 'number') return res.status(400).json({ error: 'Invalid bubble index' });
		total += val;
	}
	duel.players[userId].poppedIndices = poppedIndices;
	duel.players[userId].total = total;
	duel.players[userId].submittedAt = now();

	// Determine completion
	const playerIds = Object.keys(duel.players);
	const bothSubmitted = playerIds.length === 2 && playerIds.every(pid => duel.players[pid].total !== null);
	if (bothSubmitted) {
		const [a, b] = playerIds;
		const at = duel.players[a].total;
		const bt = duel.players[b].total;
		let winner = null;
		if (at > bt) winner = a; else if (bt > at) winner = b; else winner = 'tie';
		duel.status = 'completed';
		duel.winner = winner;
		// Set cooldown for both participants
		cooldowns[a] = now();
		cooldowns[b] = now();
		saveJson(cooldownFile, cooldowns);
	}

	saveJson(duelsFile, duels);
	return res.json({ ok: true, total, status: duel.status, winner: duel.winner });
});

// Fallback to SPA index.html
app.get('*', (req, res) => {
	res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});


// Utility: Cryptographically secure random number between 0 (inclusive) and 1 (exclusive)
function getRandomNumber() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
}

// Application State
let state = {
    players: [],
    gameId: null,
    allowDuplicates: false,
    excludedTeams: [],
    availableTeams: [],
    currentPlayerIndex: 0,
    results: []
};

// DOM Elements
const views = {
    setup: document.getElementById('setup-view'),
    spin: document.getElementById('spin-view'),
    summary: document.getElementById('summary-view')
};

const DOM = {
    numPlayers: document.getElementById('num-players'),
    playerNamesContainer: document.getElementById('player-names-container'),
    gameSelect: document.getElementById('game-select'),
    allowDuplicates: document.getElementById('allow-duplicates'),
    excludeToggle: document.getElementById('exclude-teams-toggle'),
    excludeContainer: document.getElementById('exclude-teams-container'),
    startBtn: document.getElementById('start-btn'),
    setupError: document.getElementById('setup-error'),

    currentPlayerName: document.getElementById('current-player-name'),
    slotReel: document.getElementById('slot-reel'),

    resultsList: document.getElementById('results-list'),
    resetBtn: document.getElementById('reset-btn')
};

// Initialization
function init() {
    populateGames();
    renderPlayerInputs();
    renderExcludeList();

    // Event Listeners
    DOM.numPlayers.addEventListener('change', renderPlayerInputs);
    DOM.numPlayers.addEventListener('input', renderPlayerInputs);
    DOM.gameSelect.addEventListener('change', renderExcludeList);
    DOM.excludeToggle.addEventListener('change', (e) => {
        DOM.excludeContainer.classList.toggle('hidden', !e.target.checked);
    });
    DOM.startBtn.addEventListener('click', handleStart);
    DOM.resetBtn.addEventListener('click', handleReset);
    views.spin.addEventListener('click', handleSpinTap);
}

// Setup View Logic
function populateGames() {
    DOM.gameSelect.innerHTML = '';
    for (const [id, game] of Object.entries(GAMES_DATA)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = game.name;
        DOM.gameSelect.appendChild(option);
    }
}

function renderPlayerInputs() {
    let count = parseInt(DOM.numPlayers.value) || 1;
    if (count < 1) count = 1;
    if (count > 28) count = 28;

    const currentInputs = Array.from(DOM.playerNamesContainer.querySelectorAll('input'));
    const savedNames = currentInputs.map(input => input.value);

    DOM.playerNamesContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.marginBottom = '5px';
        group.style.flexDirection = 'row';
        group.style.alignItems = 'center';

        const label = document.createElement('label');
        label.textContent = `${i + 1}.`;
        label.style.width = '30px';
        label.style.margin = '0';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = savedNames[i] || `Player ${i + 1}`;
        input.style.flex = '1';

        group.appendChild(label);
        group.appendChild(input);
        DOM.playerNamesContainer.appendChild(group);
    }
}

function renderExcludeList() {
    const gameId = DOM.gameSelect.value;
    if (!gameId) return;

    const teams = GAMES_DATA[gameId].teams;
    DOM.excludeContainer.innerHTML = '';

    teams.forEach(team => {
        const item = document.createElement('div');
        item.className = 'team-exclude-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = team;
        checkbox.id = `exclude-${team.replace(/\s+/g, '-')}`;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = team;
        label.className = 'checkbox-label';

        item.appendChild(checkbox);
        item.appendChild(label);
        DOM.excludeContainer.appendChild(item);
    });
}

function handleStart() {
    DOM.setupError.classList.add('hidden');

    // Gather state
    const playerInputs = Array.from(DOM.playerNamesContainer.querySelectorAll('input[type="text"]'));
    state.players = playerInputs.map(input => input.value.trim() || 'Anonymous');
    state.gameId = DOM.gameSelect.value;
    state.allowDuplicates = DOM.allowDuplicates.checked;

    if (DOM.excludeToggle.checked) {
        const excludeCheckboxes = Array.from(DOM.excludeContainer.querySelectorAll('input[type="checkbox"]:checked'));
        state.excludedTeams = excludeCheckboxes.map(cb => cb.value);
    } else {
        state.excludedTeams = [];
    }

    const allTeams = GAMES_DATA[state.gameId].teams;
    state.availableTeams = allTeams.filter(team => !state.excludedTeams.includes(team));

    // Validation
    if (!state.allowDuplicates && state.players.length > state.availableTeams.length) {
        DOM.setupError.textContent = `Not enough teams! You have ${state.players.length} players but only ${state.availableTeams.length} available teams. Allow duplicates or reduce exclusions.`;
        DOM.setupError.classList.remove('hidden');
        return;
    }

    if (state.availableTeams.length === 0) {
        DOM.setupError.textContent = "You excluded all teams! Uncheck some to play.";
        DOM.setupError.classList.remove('hidden');
        return;
    }

    // Reset spin state
    state.currentPlayerIndex = 0;
    state.results = [];
    isWaitingForNext = false;

    startSpinPhase();
}

// Spin View Logic
let isSpinning = false;
let isWaitingForNext = false;
const ITEM_HEIGHT = 120; // Matches CSS .slot-item height
const SPINS_BEFORE_STOP = 3; // Number of full list rotations before stopping

function startSpinPhase() {
    showView('spin');
    prepareNextPlayer();
}

function prepareNextPlayer() {
    const player = state.players[state.currentPlayerIndex];
    DOM.currentPlayerName.textContent = player;
    DOM.slotReel.style.transition = 'none';
    DOM.slotReel.style.transform = `translateY(0px)`;

    buildSlotReel();
    isSpinning = false;
    document.querySelector('.instruction').classList.add('blink');
    document.querySelector('.instruction').textContent = 'Tap screen to spin!';
}

function createSlotItem(text) {
    const el = document.createElement('div');
    el.className = 'slot-item';
    el.textContent = text;

    // Scale down text if it's too long
    if (text.length > 8) {
        el.style.fontSize = '1.25rem';
    }

    return el;
}

function buildSlotReel() {
    DOM.slotReel.innerHTML = '';
    // We need a long list of items to animate a spin
    // Copy availableTeams a few times
    const pool = [...state.availableTeams];

    // Shuffle the base pool for randomness in appearance
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(getRandomNumber() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // The target will be randomly selected and placed at a specific index
    // Create list: [initial_padding, ...SPINS_BEFORE_STOP * pool, target]

    // Add one dummy item for initial state
    const initialItem = createSlotItem("???");
    DOM.slotReel.appendChild(initialItem);

    const TOTAL_ITEMS = 40;
    for (let i = 0; i < TOTAL_ITEMS; i++) {
        const team = pool[i % pool.length];
        const el = createSlotItem(team);
        DOM.slotReel.appendChild(el);
    }
}

function handleSpinTap() {
    if (isWaitingForNext) {
        isWaitingForNext = false;
        if (state.currentPlayerIndex >= state.players.length) {
            showSummary();
        } else {
            prepareNextPlayer();
        }
        return;
    }

    if (isSpinning) return;
    isSpinning = true;

    document.querySelector('.instruction').classList.remove('blink');
    document.querySelector('.instruction').textContent = 'Spinning...';

    // Pick a winner from available teams
    let winnerIndex = Math.floor(getRandomNumber() * state.availableTeams.length);
    let winnerTeam = state.availableTeams[winnerIndex];

    // Easter egg: Tyler always gets Mexico in Little League Baseball
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (state.gameId === 'little_league_baseball' && currentPlayer.toLowerCase() === 'tyler') {
        winnerTeam = 'Mexico';
        winnerIndex = state.availableTeams.indexOf('Mexico');
    }

    // If not allowing duplicates, remove from available
    if (!state.allowDuplicates && winnerIndex !== -1) {
        state.availableTeams.splice(winnerIndex, 1);
    }

    // Determine the position to stop. We append the winner to the end of the reel
    const winnerEl = createSlotItem(winnerTeam);
    DOM.slotReel.appendChild(winnerEl);

    // Add some padding after the winner so it doesn't spin past the bottom
    for (let i = 0; i < 2; i++) {
        const pad = createSlotItem(state.availableTeams[Math.floor(getRandomNumber() * state.availableTeams.length)] || "???");
        DOM.slotReel.appendChild(pad);
    }

    const itemsCount = DOM.slotReel.children.length;
    // The winner is at index itemsCount - 3
    const targetY = -(itemsCount - 3) * ITEM_HEIGHT;

    // Trigger animation
    // Force reflow
    void DOM.slotReel.offsetWidth;

    const spinDuration = 4000 + getRandomNumber() * 1000; // 4-5 seconds
    DOM.slotReel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.15, 0.85, 0.15, 1)`;
    DOM.slotReel.style.transform = `translateY(${targetY}px)`;

    setTimeout(() => {
        finishSpin(winnerTeam);
    }, spinDuration + 500);
}

function finishSpin(winnerTeam) {
    state.results.push({
        player: state.players[state.currentPlayerIndex],
        team: winnerTeam
    });

    state.currentPlayerIndex++;

    isWaitingForNext = true;
    const instruction = document.querySelector('.instruction');
    instruction.classList.add('blink');
    if (state.currentPlayerIndex >= state.players.length) {
        instruction.textContent = 'Tap to see results!';
    } else {
        instruction.textContent = 'Tap to continue';
    }
}

// Summary View Logic
function showSummary() {
    showView('summary');
    DOM.resultsList.innerHTML = '';

    state.results.forEach(res => {
        const row = document.createElement('div');
        row.className = 'result-row';

        const playerDiv = document.createElement('div');
        playerDiv.className = 'result-player';
        playerDiv.textContent = res.player;

        const teamDiv = document.createElement('div');
        teamDiv.className = 'result-team';
        teamDiv.textContent = res.team;

        row.appendChild(playerDiv);
        row.appendChild(teamDiv);
        DOM.resultsList.appendChild(row);
    });
}

function handleReset() {
    // Reset form states partially or just go back
    showView('setup');
}

// Helper to switch views
function showView(viewName) {
    Object.values(views).forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('active');
    });
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');
}

// Run init
init();

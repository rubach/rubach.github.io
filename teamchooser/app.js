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
    updateMaxPlayers();
    renderPlayerInputs();
    renderExcludeList();

    // Event Listeners
    DOM.numPlayers.addEventListener('change', renderPlayerInputs);
    DOM.numPlayers.addEventListener('input', renderPlayerInputs);
    DOM.gameSelect.addEventListener('change', () => {
        updateMaxPlayers();
        renderExcludeList();
    });
    DOM.allowDuplicates.addEventListener('change', updateMaxPlayers);
    DOM.excludeToggle.addEventListener('change', (e) => {
        DOM.excludeContainer.classList.toggle('hidden', !e.target.checked);
    });
    DOM.startBtn.addEventListener('click', handleStart);
    DOM.resetBtn.addEventListener('click', handleReset);
    views.spin.addEventListener('click', handleSpinTap);
}

// Setup View Logic
function updateMaxPlayers() {
    const gameId = DOM.gameSelect.value;
    if (!gameId) return;

    let maxPlayers = 30;
    if (gameId === 'dusty_diamonds_softball') {
        maxPlayers = 2;
    } else if (!DOM.allowDuplicates.checked) {
        maxPlayers = GAMES_DATA[gameId].teams.length;
    }

    DOM.numPlayers.max = maxPlayers;

    const label = document.querySelector('label[for="num-players"]');
    if (label) {
        label.textContent = `Number of Players (1-${maxPlayers})`;
    }

    if (parseInt(DOM.numPlayers.value) > maxPlayers) {
        DOM.numPlayers.value = maxPlayers;
        renderPlayerInputs();
    }
}

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
    const max = parseInt(DOM.numPlayers.max) || 30;
    if (count < 1) count = 1;
    if (count > max) count = max;

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
        input.placeholder = `Player ${i + 1}`;
        if (savedNames[i]) {
            input.value = savedNames[i];
        }
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
    state.players = playerInputs.map((input, i) => input.value.trim() || `Player ${i + 1}`);
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
    let requiredTeams = state.players.length;
    if (state.gameId === 'dusty_diamonds_softball') {
        requiredTeams = state.players.length * 10;
    }
    
    if (!state.allowDuplicates && state.availableTeams.length < requiredTeams) {
        DOM.setupError.textContent = `Not enough available! You need ${requiredTeams} but only ${state.availableTeams.length} are available. Allow duplicates or reduce exclusions.`;
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

    if (state.gameId === 'dusty_diamonds_softball') {
        let pool = [...state.availableTeams];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(getRandomNumber() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        
        for (let p of state.players) {
            let roster = [];
            for (let i = 0; i < 10; i++) {
                if (pool.length > 0) {
                    roster.push(pool.pop());
                } else if (state.allowDuplicates) {
                    roster.push(state.availableTeams[Math.floor(getRandomNumber() * state.availableTeams.length)]);
                } else {
                    roster.push("???");
                }
            }
            state.results.push({
                player: p,
                team: roster
            });
        }
        showSummary();
        return;
    }

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

    if (state.gameId === 'tecmo_super_bowl' && text !== '???') {
        const logoPath = `logos/${text.toLowerCase().replace(/ /g, "_").replace(/\./g, "")}.webp`;
        const img = document.createElement('img');
        img.src = logoPath;
        img.className = 'team-logo';
        el.appendChild(img);
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    el.appendChild(textSpan);

    // Scale down text if it's too long
    if (text.length > 8) {
        textSpan.style.fontSize = '1.25rem';
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

    const getDifferentTeam = (exclude) => {
        const pool = state.availableTeams.length > 1 ? state.availableTeams : GAMES_DATA[state.gameId].teams;
        if (!pool || pool.length === 0) return "???";
        let pick;
        let attempts = 0;
        do {
            pick = pool[Math.floor(getRandomNumber() * pool.length)];
            attempts++;
        } while (pick === exclude && attempts < 20);
        return pick;
    };

    // Ensure the pre-built item just before the winner isn't the same as the winner
    const lastItem = DOM.slotReel.lastChild;
    if (lastItem && lastItem.textContent === winnerTeam) {
        DOM.slotReel.removeChild(lastItem);
        DOM.slotReel.appendChild(createSlotItem(getDifferentTeam(winnerTeam)));
    }

    // Determine the position to stop. We append the winner to the end of the reel
    const winnerEl = createSlotItem(winnerTeam);
    DOM.slotReel.appendChild(winnerEl);

    // Add some padding after the winner so it doesn't spin past the bottom
    let previousTeam = winnerTeam;
    for (let i = 0; i < 2; i++) {
        const padTeam = getDifferentTeam(previousTeam);
        const pad = createSlotItem(padTeam);
        DOM.slotReel.appendChild(pad);
        previousTeam = padTeam;
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

    if (state.gameId === 'dusty_diamonds_softball') {
        DOM.resultsList.classList.add('roster-layout');
    } else {
        DOM.resultsList.classList.remove('roster-layout');
    }

    state.results.forEach(res => {
        const row = document.createElement('div');
        row.className = 'result-row';
        
        if (Array.isArray(res.team)) {
            row.classList.add('roster-row');
        }

        const playerDiv = document.createElement('div');
        playerDiv.className = 'result-player';
        playerDiv.textContent = res.player;

        const teamDiv = document.createElement('div');
        teamDiv.className = 'result-team';
        
        if (Array.isArray(res.team)) {
            teamDiv.classList.add('roster-grid');
            res.team.forEach(t => {
                const charDiv = document.createElement('div');
                charDiv.className = 'roster-character';
                
                if (state.gameId === 'dusty_diamonds_softball') {
                    const img = document.createElement('img');
                    const safeName = t.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
                    img.src = `logos/${safeName}.png`;
                    img.alt = t;
                    img.className = 'portrait-img';
                    charDiv.appendChild(img);
                }
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = t;
                charDiv.appendChild(nameSpan);
                
                teamDiv.appendChild(charDiv);
            });
        } else {
            teamDiv.textContent = res.team;
        }

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

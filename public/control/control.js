/**
 * Smash OBS API - Control UI
 * Made by: Julio Rubio 
 */

/* ============================================================================
   CONTROL UI - Socket.IO Client with Custom Modal
   ============================================================================ */

// Get match ID from URL query params
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('match') || 'default';

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const stageGrid = document.getElementById('stageGrid');
const phaseIndicator = document.getElementById('phaseIndicator');
const phaseLabel = document.getElementById('phaseLabel');
const phaseCounter = document.getElementById('phaseCounter');
const availableList = document.getElementById('availableList');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const forcePhaseBtn = document.getElementById('forcePhaseBtn');
const matchIdDisplay = document.getElementById('matchIdDisplay');
const toastContainer = document.getElementById('toastContainer');
const modeBtns = document.querySelectorAll('.mode-btn');

// Modal elements
const modalOverlay = document.getElementById('modalOverlay');
const modalHeader = document.getElementById('modalHeader');
const modalBody = document.getElementById('modalBody');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');

// State
let stages = [];
let currentState = null;
let modalCallback = null;

// ============================================================================
// CUSTOM MODAL SYSTEM (replaces browser confirm)
// ============================================================================

function showModal(title, message, onConfirm) {
    modalHeader.textContent = title;
    modalBody.textContent = message;
    modalCallback = onConfirm;
    modalOverlay.classList.add('active');
}

function hideModal() {
    modalOverlay.classList.remove('active');
    modalCallback = null;
}

modalConfirm.addEventListener('click', () => {
    if (modalCallback) {
        modalCallback();
    }
    hideModal();
});

modalCancel.addEventListener('click', () => {
    hideModal();
});

// Close modal on overlay click (outside modal)
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        hideModal();
    }
});

// ============================================================================
// SOCKET.IO CONNECTION
// ============================================================================

const socket = io();

socket.on('connect', () => {
    console.log('✅ Connected to server');
    updateConnectionStatus('connected', 'Connected');
    socket.emit('join', { matchId });
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    updateConnectionStatus('disconnected', 'Disconnected');
});

socket.on('state:update', (state) => {
    console.log('📦 State update:', state);
    currentState = state;
    renderState();
});

socket.on('action:result', (result) => {
    console.log('⚡ Action result:', result);
    if (!result.ok && result.error) {
        showToast(result.error, 'error');
    }
});

socket.on('event:push', (event) => {
    console.log('🎯 Event:', event);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    try {
        const response = await fetch('/api/stages');
        stages = await response.json();
        renderStageGrid();
    } catch (err) {
        console.error('Failed to load stages:', err);
        showToast('Error loading stages', 'error');
    }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderStageGrid() {
    stageGrid.innerHTML = stages.map(stage => `
    <div class="stage-card" data-id="${stage.id}">
      <img 
        class="stage-image" 
        src="/assets/stages/${stage.id}.png" 
        alt="${stage.name}"
        onerror="this.style.display='none'"
      >
      <div class="stage-name">${stage.name}</div>
    </div>
  `).join('');

    // Add click handlers
    stageGrid.querySelectorAll('.stage-card').forEach(card => {
        card.addEventListener('click', () => handleStageClick(card.dataset.id));
    });
}

function renderState() {
    if (!currentState) return;

    const { mode, phase, bans, pick, available, bansRemaining, picksRemaining, canUndo } = currentState;

    // Update match ID display
    if (matchIdDisplay) {
        matchIdDisplay.textContent = matchId;
    }

    // Update mode toggle
    modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update phase indicator
    updatePhaseIndicator(phase, bansRemaining, picksRemaining);

    // Update available stages list
    if (availableList && available) {
        const availableNames = available.map(id => {
            const stage = stages.find(s => s.id === id);
            return stage ? stage.short : id;
        });
        availableList.textContent = `${available.length} (${availableNames.join(', ')})`;
    }

    // Update stage cards
    stageGrid.querySelectorAll('.stage-card').forEach(card => {
        const id = card.dataset.id;
        card.classList.remove('banned', 'picked');

        if (bans.includes(id)) {
            card.classList.add('banned');
        }
        if (pick === id) {
            card.classList.add('picked');
        }
    });

    // Update buttons
    undoBtn.disabled = !canUndo;

    // Disable force phase if DONE
    if (forcePhaseBtn) {
        forcePhaseBtn.disabled = phase === 'DONE';
    }
}

function updatePhaseIndicator(phase, bansRemaining, picksRemaining) {
    phaseIndicator.className = 'phase-indicator';

    const phaseConfig = {
        'WINNER_BAN': {
            label: '🔴 Winner Ban',
            counter: `Faltan: ${bansRemaining}`,
            class: ''
        },
        'LOSER_BAN': {
            label: '🔵 Loser Ban',
            counter: `Faltan: ${bansRemaining}`,
            class: 'loser-phase'
        },
        'WINNER_PICK': {
            label: '🟢 Winner Pick',
            counter: 'Elige 1 de 2',
            class: 'pick-phase'
        },
        'LOSER_PICK': {
            label: '🟢 Loser Pick',
            counter: 'Elige 1 de 6',
            class: 'pick-phase'
        },
        'DONE': {
            label: '✅ Completado',
            counter: currentState?.pick ? `Escenario: ${getStageName(currentState.pick)}` : '',
            class: 'done-phase'
        }
    };

    const config = phaseConfig[phase] || phaseConfig.DONE;
    phaseLabel.textContent = config.label;
    phaseCounter.textContent = config.counter;
    if (config.class) {
        phaseIndicator.classList.add(config.class);
    }
}

function getStageName(stageId) {
    const stage = stages.find(s => s.id === stageId);
    return stage ? stage.name : stageId;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleStageClick(stageId) {
    if (!currentState) return;

    const { phase, bans, pick } = currentState;

    // Don't allow clicking banned or picked stages
    if (bans.includes(stageId) || pick === stageId) {
        return;
    }

    // Determine action based on current phase
    let actionType = null;

    if (phase === 'WINNER_BAN' || phase === 'LOSER_BAN') {
        actionType = 'BAN';
    } else if (phase === 'WINNER_PICK' || phase === 'LOSER_PICK') {
        actionType = 'PICK';
    } else if (phase === 'DONE') {
        showToast('La selección está completada', 'error');
        return;
    }

    if (actionType) {
        socket.emit('action', { matchId, type: actionType, stageId });
    }
}

// Mode toggle
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        showModal(
            '🎮 Cambiar Modo',
            `¿Cambiar a ${mode === 'G1' ? 'Partida 1' : 'Partida 2-5'}? Esto reseteará la selección actual.`,
            () => {
                socket.emit('action', { matchId, type: 'SET_MODE', mode });
            }
        );
    });
});

// Undo button
undoBtn.addEventListener('click', () => {
    socket.emit('action', { matchId, type: 'UNDO' });
});

// Reset button - NOW USES CUSTOM MODAL
resetBtn.addEventListener('click', () => {
    showModal(
        '🔄 Resetear Selección',
        '¿Estás seguro de que quieres resetear todos los bans y picks?',
        () => {
            console.log('Sending RESET action for match:', matchId);
            socket.emit('action', { matchId, type: 'RESET' });
        }
    );
});

// Force phase button (arbiter) - NOW USES CUSTOM MODAL
if (forcePhaseBtn) {
    forcePhaseBtn.addEventListener('click', () => {
        showModal(
            '⏭️ Forzar Siguiente Fase',
            '¿Forzar avance a la siguiente fase? (Solo árbitro)',
            () => {
                socket.emit('action', { matchId, type: 'FORCE_NEXT_PHASE' });
            }
        );
    });
}

// ============================================================================
// UI HELPERS
// ============================================================================

function updateConnectionStatus(status, text) {
    connectionStatus.className = `connection-status ${status}`;
    connectionStatus.querySelector('.status-text').textContent = text;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ============================================================================
// START
// ============================================================================

init();

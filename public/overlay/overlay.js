/**
 * Smash OBS API - Overlay UI
 * Made by: Julio Rubio
 */

/* ============================================================================
   OVERLAY UI - Socket.IO Client
   
   Only PERSISTENT TILES - no auto-fading popups
   Tiles stay visible until Reset or phase change
   ============================================================================ */

// Get match ID from URL query params
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('match') || 'default';

// DOM Elements
const stageGrid = document.getElementById('stageGrid');
const banHistoryContainer = document.getElementById('banHistoryContainer');

// State
let stages = [];
let currentState = null;

// ============================================================================
// SOCKET.IO CONNECTION
// ============================================================================

const socket = io();

socket.on('connect', () => {
    console.log('✅ Overlay connected to server');
    socket.emit('join', { matchId });
});

socket.on('disconnect', () => {
    console.log('❌ Overlay disconnected');
});

socket.on('state:update', (state) => {
    console.log('📦 Overlay received state:update', state);
    currentState = state;
    renderBanHistory();
    renderStageGrid();
});

// We still receive event:push but don't show popups anymore
socket.on('event:push', (event) => {
    console.log('🎯 Event received (no popup):', event);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    console.log('🚀 Overlay initializing for match:', matchId);
    try {
        const response = await fetch('/api/stages');
        stages = await response.json();
        console.log('📋 Loaded', stages.length, 'stages');
        renderBanHistory();
        renderStageGrid();
    } catch (err) {
        console.error('❌ Failed to load stages:', err);
    }
}

// ============================================================================
// BAN HISTORY - PERSISTENT TILES (Main display)
// These tiles STAY VISIBLE until state changes
// ============================================================================

function renderBanHistory() {
    if (!banHistoryContainer) {
        console.warn('banHistoryContainer not found');
        return;
    }

    // Clear and rebuild from current state
    banHistoryContainer.innerHTML = '';

    if (!currentState || !stages.length) {
        return;
    }

    const { bans, pick } = currentState;

    // Render all banned stages
    if (bans && bans.length > 0) {
        bans.forEach((stageId) => {
            const stage = stages.find(s => s.id === stageId);
            if (!stage) return;

            const tile = createHistoryTile(stage, 'ban');
            banHistoryContainer.appendChild(tile);
        });
    }

    // Render picked stage if exists
    if (pick) {
        const stage = stages.find(s => s.id === pick);
        if (stage) {
            const tile = createHistoryTile(stage, 'pick');
            banHistoryContainer.appendChild(tile);
        }
    }
}

function createHistoryTile(stage, type) {
    const tile = document.createElement('div');
    tile.className = `history-tile ${type}`;
    tile.dataset.stageId = stage.id;
    tile.innerHTML = `
    <div class="tile-label">${type === 'ban' ? 'BANNED' : 'STAGE'}</div>
    <div class="tile-image-container">
      <img 
        class="tile-image" 
        src="/assets/stages/${stage.id}.png" 
        alt="${stage.name}"
        onerror="this.style.display='none'"
      >
    </div>
    <div class="tile-name">${stage.name}</div>
  `;
    return tile;
}

// ============================================================================
// STAGE GRID RENDERING (Optional - hidden by default in CSS)
// ============================================================================

function renderStageGrid() {
    if (!stageGrid) return;

    stageGrid.innerHTML = stages.map(stage => {
        const isBanned = currentState?.bans?.includes(stage.id);
        const isPicked = currentState?.pick === stage.id;
        const classes = ['stage-card'];
        if (isBanned) classes.push('banned');
        if (isPicked) classes.push('picked');

        return `
      <div class="${classes.join(' ')}" data-id="${stage.id}">
        <img 
          class="stage-image" 
          src="/assets/stages/${stage.id}.png" 
          alt="${stage.name}"
          onerror="this.style.display='none'"
        >
        <div class="stage-name">${stage.short || stage.name}</div>
      </div>
    `;
    }).join('');
}

// ============================================================================
// START
// ============================================================================

init();

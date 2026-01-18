/**
 * Smash OBS API - Stage Selection System
 * Made by: Julio Rubio
 * https://github.com/juliorubio
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for LAN access

// ============================================================================
// LAN IP DETECTION
// ============================================================================

function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Load stages data
const stages = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stages.json'), 'utf8'));
const stageIds = stages.map(s => s.id);

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// In-memory state per match
const matchStates = new Map();

/**
 * Phase flow:
 * 
 * G1 (Game 1 - 3-4-1 Striking):
 *   WINNER_BAN (3) -> LOSER_BAN (4) -> WINNER_PICK (1 of 2) -> DONE
 * 
 * G2PLUS (Game 2-5):
 *   WINNER_BAN (3) -> LOSER_PICK (1 of 6) -> DONE
 */

const PHASES = {
  WINNER_BAN: 'WINNER_BAN',
  LOSER_BAN: 'LOSER_BAN',
  WINNER_PICK: 'WINNER_PICK',
  LOSER_PICK: 'LOSER_PICK',
  DONE: 'DONE'
};

function createInitialState(mode = 'G1') {
  return {
    mode,                    // 'G1' or 'G2PLUS'
    phase: PHASES.WINNER_BAN,
    bans: [],                // array of stageIds in order
    pick: null,              // stageId or null
    history: []              // stack for undo: [{action, stageId, prevPhase}]
  };
}

function getState(matchId) {
  if (!matchStates.has(matchId)) {
    matchStates.set(matchId, createInitialState());
  }
  return matchStates.get(matchId);
}

function getAvailableStages(state) {
  return stageIds.filter(id => !state.bans.includes(id));
}

function getBansRemaining(state) {
  const { mode, phase, bans } = state;

  if (phase === PHASES.WINNER_BAN) {
    return 3 - bans.length;
  }

  if (mode === 'G1' && phase === PHASES.LOSER_BAN) {
    return 7 - bans.length; // Need 7 total bans (3+4), currently have bans.length
  }

  return 0;
}

function getPicksRemaining(state) {
  if (state.phase === PHASES.WINNER_PICK || state.phase === PHASES.LOSER_PICK) {
    return state.pick ? 0 : 1;
  }
  return 0;
}

function advancePhase(state) {
  const { mode, phase, bans } = state;

  if (mode === 'G1') {
    // G1: WINNER_BAN(3) -> LOSER_BAN(4) -> WINNER_PICK -> DONE
    if (phase === PHASES.WINNER_BAN && bans.length >= 3) {
      state.phase = PHASES.LOSER_BAN;
    } else if (phase === PHASES.LOSER_BAN && bans.length >= 7) {
      state.phase = PHASES.WINNER_PICK;
    } else if (phase === PHASES.WINNER_PICK && state.pick) {
      state.phase = PHASES.DONE;
    }
  } else {
    // G2PLUS: WINNER_BAN(3) -> LOSER_PICK -> DONE
    if (phase === PHASES.WINNER_BAN && bans.length >= 3) {
      state.phase = PHASES.LOSER_PICK;
    } else if (phase === PHASES.LOSER_PICK && state.pick) {
      state.phase = PHASES.DONE;
    }
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

function handleBan(state, stageId) {
  // Validate stage exists
  if (!stageIds.includes(stageId)) {
    return { ok: false, error: `Invalid stage: ${stageId}` };
  }

  // Validate not already banned
  if (state.bans.includes(stageId)) {
    return { ok: false, error: `Stage already banned: ${stageId}` };
  }

  // Validate we're in a ban phase
  if (state.phase !== PHASES.WINNER_BAN && state.phase !== PHASES.LOSER_BAN) {
    return { ok: false, error: `Cannot ban in phase: ${state.phase}` };
  }

  // Validate bans remaining
  if (getBansRemaining(state) <= 0) {
    return { ok: false, error: 'No bans remaining in this phase' };
  }

  // Apply ban
  const prevPhase = state.phase;
  state.bans.push(stageId);
  state.history.push({ action: 'BAN', stageId, prevPhase });

  // Check phase transition
  advancePhase(state);

  return { ok: true, event: { type: 'BAN', stageId, ts: Date.now() } };
}

function handlePick(state, stageId) {
  // Validate stage exists
  if (!stageIds.includes(stageId)) {
    return { ok: false, error: `Invalid stage: ${stageId}` };
  }

  // Validate not banned
  if (state.bans.includes(stageId)) {
    return { ok: false, error: `Cannot pick banned stage: ${stageId}` };
  }

  // Validate we're in a pick phase
  if (state.phase !== PHASES.WINNER_PICK && state.phase !== PHASES.LOSER_PICK) {
    return { ok: false, error: `Cannot pick in phase: ${state.phase}` };
  }

  // Validate no pick yet
  if (state.pick) {
    return { ok: false, error: 'Already picked' };
  }

  // Apply pick
  const prevPhase = state.phase;
  state.pick = stageId;
  state.history.push({ action: 'PICK', stageId, prevPhase });

  // Advance to DONE
  advancePhase(state);

  return { ok: true, event: { type: 'PICK', stageId, ts: Date.now() } };
}

function handleUndo(state) {
  if (state.history.length === 0) {
    return { ok: false, error: 'Nothing to undo' };
  }

  const lastAction = state.history.pop();

  if (lastAction.action === 'BAN') {
    state.bans = state.bans.filter(id => id !== lastAction.stageId);
  } else if (lastAction.action === 'PICK') {
    state.pick = null;
  }
  // FORCE_PHASE only needs phase revert, no data to undo

  state.phase = lastAction.prevPhase;

  return { ok: true };
}

function handleReset(matchId, keepMode = true) {
  const state = getState(matchId);
  const newState = createInitialState(state.mode);
  matchStates.set(matchId, newState);
  return { ok: true };
}

function handleSetMode(state, mode) {
  if (mode !== 'G1' && mode !== 'G2PLUS') {
    return { ok: false, error: `Invalid mode: ${mode}` };
  }

  // Reset state with new mode
  const newState = createInitialState(mode);
  return { ok: true, newState };
}

function handleForceNextPhase(state) {
  const { mode, phase } = state;
  const prevPhase = phase;

  // Define phase transitions
  const transitions = {
    G1: {
      WINNER_BAN: PHASES.LOSER_BAN,
      LOSER_BAN: PHASES.WINNER_PICK,
      WINNER_PICK: PHASES.DONE,
      DONE: PHASES.DONE
    },
    G2PLUS: {
      WINNER_BAN: PHASES.LOSER_PICK,
      LOSER_PICK: PHASES.DONE,
      DONE: PHASES.DONE
    }
  };

  const nextPhase = transitions[mode]?.[phase];
  if (!nextPhase || nextPhase === phase) {
    return { ok: false, error: 'Cannot advance phase' };
  }

  state.phase = nextPhase;
  state.history.push({ action: 'FORCE_PHASE', prevPhase });

  return { ok: true };
}

// ============================================================================
// COMPUTED STATE (for clients)
// ============================================================================

function getComputedState(matchId) {
  const state = getState(matchId);
  const available = getAvailableStages(state);

  return {
    matchId,
    mode: state.mode,
    phase: state.phase,
    bans: state.bans,
    pick: state.pick,
    available,
    bansRemaining: getBansRemaining(state),
    picksRemaining: getPicksRemaining(state),
    canUndo: state.history.length > 0
  };
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Redirects for cleaner URLs
app.get('/control', (req, res) => res.redirect('/control/'));
app.get('/overlay', (req, res) => res.redirect('/overlay/'));

// Health check
app.get('/health', (req, res) => res.send('OK'));

// API: Get stages
app.get('/api/stages', (req, res) => {
  res.json(stages);
});

// API: Get state for match
app.get('/api/state', (req, res) => {
  const matchId = req.query.match || 'default';
  res.json(getComputedState(matchId));
});

// ============================================================================
// SOCKET.IO
// ============================================================================

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  let currentMatchId = null;

  // Join a match room
  socket.on('join', ({ matchId }) => {
    matchId = matchId || 'default';
    currentMatchId = matchId;

    socket.join(matchId);
    console.log(`👤 ${socket.id} joined match: ${matchId}`);

    // Send current state
    socket.emit('state:update', getComputedState(matchId));
  });

  // Handle actions
  socket.on('action', ({ matchId, type, stageId, mode }) => {
    matchId = matchId || currentMatchId || 'default';
    const state = getState(matchId);

    let result;

    switch (type) {
      case 'BAN':
        result = handleBan(state, stageId);
        break;
      case 'PICK':
        result = handlePick(state, stageId);
        break;
      case 'UNDO':
        result = handleUndo(state);
        break;
      case 'RESET':
        console.log(`🔄 RESET requested for match: ${matchId}`);
        result = handleReset(matchId);
        console.log(`🔄 RESET applied. New state:`, getComputedState(matchId));
        break;
      case 'SET_MODE':
        result = handleSetMode(state, mode);
        if (result.ok && result.newState) {
          matchStates.set(matchId, result.newState);
        }
        break;
      case 'FORCE_NEXT_PHASE':
        result = handleForceNextPhase(state);
        break;
      default:
        result = { ok: false, error: `Unknown action: ${type}` };
    }

    // Send result to sender
    socket.emit('action:result', { type, ok: result.ok, error: result.error });

    // If successful, broadcast state update to all in room
    if (result.ok) {
      io.to(matchId).emit('state:update', getComputedState(matchId));

      // Also emit event for overlays (BAN/PICK only)
      if (result.event) {
        io.to(matchId).emit('event:push', result.event);
      }
    }

    console.log(`⚡ Action [${matchId}]: ${type} ${stageId || mode || ''} -> ${result.ok ? 'OK' : result.error}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// START SERVER
// ============================================================================

httpServer.listen(PORT, HOST, () => {
  const lanIP = getLanIP();

  console.log(`\n🎮 Smash OBS API running!`);
  console.log(``);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   LAN:     http://${lanIP}:${PORT}`);
  console.log(``);
  console.log(`   Control: http://${lanIP}:${PORT}/control/?match=TEST`);
  console.log(`   Overlay: http://${lanIP}:${PORT}/overlay/?match=TEST`);
  console.log(``);
  console.log(`   API:     http://localhost:${PORT}/api/stages`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log(``);
  console.log(`   💡 Tablet: Open the LAN Control URL on your tablet`);
  console.log(`   ⚠️  If tablet can't connect, open Windows Firewall for port ${PORT}\n`);
});

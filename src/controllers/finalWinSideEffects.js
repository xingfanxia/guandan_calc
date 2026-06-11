import state from '../core/state.js';
import { getPlayers } from '../player/playerManager.js';
import { calculateHonorsFromData } from '../stats/honors.js';
import { showVictoryModal, getVotingResults } from '../ui/victoryModal.js';
import { getRoomInfo } from '../share/roomManager.js';
import { scheduleAutoVotingSync } from '../share/votingSync.js';
import { syncProfileStats } from '../api/playerApi.js';
import { resolvePlayerCountMode } from '../core/playerCountMode.js';

function normalizeSessionDurationSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
}

export function resolveFinalSessionDuration(historyDuration = 0, roomInfo = {}) {
  const fallbackDuration = normalizeSessionDurationSeconds(historyDuration);
  const createdAt = roomInfo?.createdAt;
  const finishedAt = roomInfo?.finishedAt;
  if (!createdAt || !finishedAt) return fallbackDuration;

  const createdTime = new Date(createdAt).getTime();
  const finishedTime = new Date(finishedAt).getTime();
  if (!Number.isFinite(createdTime) || !Number.isFinite(finishedTime)) {
    return fallbackDuration;
  }

  const roomDuration = Math.floor((finishedTime - createdTime) / 1000);
  return roomDuration >= 0 ? roomDuration : fallbackDuration;
}

export async function handleFinalWinSideEffects({ applyResult, winnerName, mode }) {
  if (!applyResult?.finalWin) {
    return false;
  }

  // Snapshot all state synchronously before delayed profile sync. Undo/reset
  // during modal profile fetches or the later wait must not credit the wrong
  // players, honors, or session.
  const capturedHistoryEntry = JSON.parse(JSON.stringify(applyResult.historyEntry));
  const capturedRoomInfo = getRoomInfo();
  const capturedPlayers = getPlayers().map(p => ({ ...p }));
  const capturedMode = resolvePlayerCountMode(mode, capturedPlayers.length);
  const capturedStats = JSON.parse(JSON.stringify(state.getPlayerStats()));
  const capturedSessionHonors = calculateHonorsFromData(capturedPlayers, capturedStats, capturedMode);

  await showVictoryModal(winnerName);
  scheduleAutoVotingSync({
    roomInfo: capturedRoomInfo,
    players: capturedPlayers
  });

  setTimeout(() => {
    const votingResults = getVotingResults();

    const sessionDuration = resolveFinalSessionDuration(
      capturedHistoryEntry.sessionDuration,
      capturedRoomInfo
    );
    if (
      capturedRoomInfo.createdAt &&
      capturedRoomInfo.finishedAt &&
      sessionDuration !== normalizeSessionDurationSeconds(capturedHistoryEntry.sessionDuration)
    ) {
      console.log(`✅ Calculated session duration from room: ${sessionDuration}s`);
    }

    const historyWithDuration = {
      ...capturedHistoryEntry,
      sessionDuration
    };

    syncProfileStats(
      historyWithDuration,
      capturedRoomInfo.roomCode || 'LOCAL',
      capturedPlayers,
      capturedStats,
      capturedSessionHonors,
      votingResults,
      capturedRoomInfo.authToken || null
    );
  }, 2000);

  return true;
}

/**
 * Settings Controls Controller
 * Handles game configuration: Mode, Checkboxes, Team Names/Colors, Custom Rules, Voting Sync
 */

import { $, on } from '../core/utils.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { updateRuleHint, applyTeamStyles, refreshPreviewOnly } from '../ui/teamDisplay.js';
import { updateTeamLabels } from '../player/playerRenderer.js';
import { syncVotingToProfiles } from '../share/votingSync.js';
import { generatePlayers } from '../player/playerManager.js';
import { renderRankingArea } from '../ranking/rankingRenderer.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';

/**
 * Update bulk names placeholder based on mode
 */
export function updateBulkNamesPlaceholder(mode) {
  const bulkNames = $('bulkNames');
  if (!bulkNames) return;

  const placeholders = {
    '4': '空格分隔，如：小 超 豪 姐',
    '6': '空格分隔，如：小 超 豪 姐 哥 帆',
    '8': '空格分隔，如：小 超 豪 姐 哥 帆 夫 达'
  };

  const normalizedMode = normalizePlayerCountMode(mode);
  bulkNames.placeholder = normalizedMode
    ? placeholders[String(normalizedMode)]
    : '请先选择 4/6/8 人模式';
}

/**
 * Setup all settings control handlers
 */
export function setupSettingsControls() {
  // Mode change handler
  const modeSelect = $('mode');
  if (modeSelect) {
    on(modeSelect, 'change', (e) => {
      const newMode = e.target.value;
      updateRuleHint(newMode);
      updateBulkNamesPlaceholder(newMode);
      generatePlayers(newMode, false);
      // Always re-render ranking slots — generatePlayers can early-return on
      // empty player list, leaving the ranking area showing the old mode's
      // slot count. The ranking renderer is the source of truth for slot count
      // per mode regardless of whether players were re-generated.
      renderRankingArea(newMode);
      emit('ui:modeChanged', { mode: newMode });
    });
  }

  // Preference checkboxes
  const must1 = $('must1');
  const autoNext = $('autoNext');
  const autoApply = $('autoApply');
  const strictA = $('strictA');

  if (must1) {
    on(must1, 'change', (e) => {
      config.setPreference('must1', e.target.checked);
    });
  }

  if (autoNext) {
    on(autoNext, 'change', (e) => {
      config.setPreference('autoNext', e.target.checked);
    });
  }

  if (autoApply) {
    on(autoApply, 'change', (e) => {
      config.setPreference('autoApply', e.target.checked);
    });
  }

  if (strictA) {
    on(strictA, 'change', (e) => {
      config.setPreference('strictA', e.target.checked);
    });
  }

  // Custom rules save/reset buttons
  const save4Btn = $('save4');
  const save6Btn = $('save6');
  const save8Btn = $('save8');
  const reset4Btn = $('reset4');
  const reset6Btn = $('reset6');
  const reset8Btn = $('reset8');

  if (save4Btn) {
    on(save4Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('4');
      updateRuleHint('4');
      refreshPreviewOnly();
      alert('4人规则已保存到本地浏览器');
    });
  }

  if (save6Btn) {
    on(save6Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('6');
      updateRuleHint('6');
      refreshPreviewOnly();
      alert('6人规则已保存到本地浏览器');
    });
  }

  if (save8Btn) {
    on(save8Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('8');
      updateRuleHint('8');
      refreshPreviewOnly();
      alert('8人规则已保存到本地浏览器');
    });
  }

  if (reset4Btn) {
    on(reset4Btn, 'click', () => {
      if (confirm('恢复4人规则到默认值？')) {
        config.resetModeToDefaults('4');
        updateRuleHint('4');
        refreshPreviewOnly();
        alert('4人规则已恢复默认');
      }
    });
  }

  if (reset6Btn) {
    on(reset6Btn, 'click', () => {
      if (confirm('恢复6人规则到默认值？')) {
        config.resetModeToDefaults('6');
        updateRuleHint('6');
        refreshPreviewOnly();
        alert('6人规则已恢复默认');
      }
    });
  }

  if (reset8Btn) {
    on(reset8Btn, 'click', () => {
      if (confirm('恢复8人规则到默认值？')) {
        config.resetModeToDefaults('8');
        updateRuleHint('8');
        refreshPreviewOnly();
        alert('8人规则已恢复默认');
      }
    });
  }

  // Manual voting sync button
  const syncVotingBtn = $('syncVotingButton');
  if (syncVotingBtn) {
    on(syncVotingBtn, 'click', async () => {
      const statusEl = $('syncVotingStatus');

      syncVotingBtn.disabled = true;
      syncVotingBtn.textContent = '同步中...';
      if (statusEl) statusEl.textContent = '正在同步投票结果到玩家资料...';

      const result = await syncVotingToProfiles();

      if (result.success) {
        if (statusEl) {
          statusEl.style.color = 'var(--win)';
          statusEl.textContent = `✅ 同步成功！已同步 ${result.totalPlayersSynced || 0} 位玩家的投票数据 | 最高: MVP ${result.mvpPlayer?.name || '无'} (${result.mvpVotes}票), 累赘 ${result.burdenPlayer?.name || '无'} (${result.burdenVotes}票)`;
        }
        syncVotingBtn.textContent = '✅ 已同步';
        setTimeout(() => {
          syncVotingBtn.disabled = false;
          syncVotingBtn.textContent = '🔄 同步投票到玩家资料';
        }, 3000);
      } else {
        if (statusEl) {
          statusEl.style.color = 'var(--danger)';
          statusEl.textContent = `❌ 同步失败: ${result.reason || 'unknown'}`;
        }
        syncVotingBtn.disabled = false;
        syncVotingBtn.textContent = '🔄 重试同步';
      }
    });
  }
}

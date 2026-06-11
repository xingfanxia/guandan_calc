import config from '../core/config.js';

const PREFERENCE_KEYS = ['must1', 'autoNext', 'autoApply', 'strictA'];

export function applySnapshotSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;

  if (settings.t1) {
    config.setTeam('t1', settings.t1);
  }

  if (settings.t2) {
    config.setTeam('t2', settings.t2);
  }

  PREFERENCE_KEYS.forEach(key => {
    if (settings[key] !== undefined) {
      config.setPreference(key, settings[key]);
    }
  });

  if (settings.c4) {
    config.set4PlayerRules(settings.c4);
  }

  if (settings.t6 || settings.p6) {
    config.set6PlayerRules({
      thresholds: settings.t6,
      points: settings.p6
    });
  }

  if (settings.t8 || settings.p8) {
    config.set8PlayerRules({
      thresholds: settings.t8,
      points: settings.p8
    });
  }
}

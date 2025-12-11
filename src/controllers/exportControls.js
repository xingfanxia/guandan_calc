/**
 * Export Controls Controller
 * Handles all export button handlers: TXT, CSV, PNG (mobile/desktop), Share
 */

import { $, on } from '../core/utils.js';
import { exportTXT, exportCSV, exportLongPNG, exportMobilePNG } from '../export/exportHandlers.js';
import { generateShareURL, showShareModal } from '../share/shareManager.js';

/**
 * Setup all export control button handlers
 */
export function setupExportControls() {
  const exportTxtBtn = $('exportTxt');
  const exportCsvBtn = $('exportCsv');
  const exportPngBtn = $('exportLongPng');
  const exportMobileBtn = $('exportMobilePng');
  const shareBtn = $('shareGame');

  // Export TXT
  if (exportTxtBtn) {
    on(exportTxtBtn, 'click', exportTXT);
  }

  // Export CSV
  if (exportCsvBtn) {
    on(exportCsvBtn, 'click', exportCSV);
  }

  // Export PNG (desktop long image)
  if (exportPngBtn) {
    on(exportPngBtn, 'click', exportLongPNG);
  }

  // Export mobile PNG
  if (exportMobileBtn) {
    on(exportMobileBtn, 'click', exportMobilePNG);
  }

  // Share URL
  if (shareBtn) {
    on(shareBtn, 'click', () => {
      showShareModal();
    });
  }
}

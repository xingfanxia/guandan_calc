// Victory modal and UI effects module
// UTF-8 encoding for Chinese characters

import { $ } from '../utils/dom.js';

class VictoryModal {
  constructor(gameState) {
    this.gameState = gameState;
    this.modal = null;
    this.modalContent = null;
    this.teamNameEl = null;
    this.initialize();
  }

  /**
   * Initialize modal elements
   */
  initialize() {
    this.modal = $('victoryModal');
    this.teamNameEl = $('victoryTeamName');
    
    if (this.modal) {
      this.modalContent = this.modal.querySelector('div');
    }
  }

  /**
   * Show victory modal for winning team
   * @param {string} teamName - Winning team name
   */
  showVictoryModal(teamName) {
    if (!this.modal || !this.teamNameEl) {
      console.warn('Victory modal elements not found');
      return;
    }
    
    // Determine which team won and get their color
    let winningTeamColor = '';
    if (teamName === this.gameState.settings.t1.name) {
      winningTeamColor = this.gameState.settings.t1.color;
    } else if (teamName === this.gameState.settings.t2.name) {
      winningTeamColor = this.gameState.settings.t2.color;
    }
    
    // Update modal content
    this.teamNameEl.textContent = teamName;
    this.teamNameEl.style.color = winningTeamColor;
    
    // Update modal border color
    if (this.modalContent) {
      this.modalContent.style.borderColor = winningTeamColor;
      this.modalContent.style.boxShadow = '0 0 30px ' + winningTeamColor + '40';
    }
    
    // Show modal with animation
    this.modal.style.display = 'flex';
    
    // Add celebration effects if available
    this.addCelebrationEffects(winningTeamColor);
  }

  /**
   * Close victory modal
   */
  closeVictoryModal() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    
    // Clean up any celebration effects
    this.cleanupCelebrationEffects();
  }

  /**
   * Add celebration effects (confetti, etc.)
   * @param {string} color - Team color for effects
   */
  addCelebrationEffects(color) {
    // Add some celebration animation classes if they exist
    if (this.modalContent) {
      this.modalContent.classList.add('celebration-bounce');
      
      // Remove animation class after animation completes
      setTimeout(() => {
        if (this.modalContent) {
          this.modalContent.classList.remove('celebration-bounce');
        }
      }, 1000);
    }
    
    // Add haptic feedback if available
    if (navigator.vibrate) {
      // Victory vibration pattern: short-long-short-long
      navigator.vibrate([100, 50, 200, 50, 100]);
    }
    
    // Play celebration sound if audio is available
    this.playCelebrationSound();
  }

  /**
   * Play celebration sound
   */
  playCelebrationSound() {
    try {
      // Create a simple celebratory tone using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Victory fanfare frequencies
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      let currentFreq = 0;
      
      const playNote = () => {
        if (currentFreq < frequencies.length) {
          oscillator.frequency.setValueAtTime(frequencies[currentFreq], audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          
          currentFreq++;
          setTimeout(playNote, 200);
        } else {
          oscillator.stop();
        }
      };
      
      oscillator.start();
      playNote();
    } catch (error) {
      // Silently fail if Web Audio API is not supported
      console.log('Audio celebration not available:', error);
    }
  }

  /**
   * Clean up celebration effects
   */
  cleanupCelebrationEffects() {
    // Remove any lingering animation classes
    if (this.modalContent) {
      this.modalContent.classList.remove('celebration-bounce');
    }
    
    // Clean up any visual effects elements that might have been added
    const celebrationElements = document.querySelectorAll('.celebration-effect');
    celebrationElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }

  /**
   * Setup modal event listeners
   */
  setupEventListeners() {
    // Close modal when clicking outside
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeVictoryModal();
        }
      });
    }
    
    // Close modal with escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.style.display === 'flex') {
        this.closeVictoryModal();
      }
    });
    
    // Setup close button if it exists
    const closeBtn = this.modal ? this.modal.querySelector('.close-btn') : null;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeVictoryModal();
      });
    }
  }

  /**
   * Check if modal is currently open
   * @returns {boolean} Modal open state
   */
  isOpen() {
    return this.modal && this.modal.style.display === 'flex';
  }

  /**
   * Initialize the victory modal system
   */
  init() {
    this.initialize();
    this.setupEventListeners();
    
    // Make close function globally accessible for HTML onclick handlers
    window.closeVictoryModal = () => {
      this.closeVictoryModal();
    };
  }
}

export default VictoryModal;
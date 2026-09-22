/**
 * cbt/js/exam_guard.js
 * Strict Anti-Cheating Exam Protection Module
 * Detects tab switching, window blur, fullscreen exits, shortcuts, and copy-paste attempts.
 */

window.ExamGuard = {
  active: false,
  attemptId: null,
  violationCount: 0,
  maxViolations: 3,
  lastViolationTime: 0,
  ignoreBlurUntil: 0,
  onDisqualifiedCallback: null,
  onViolationCallback: null,

  // Start protection mode
  start: function (attemptId, initialViolations, onViolation, onDisqualified) {
    this.active = true;
    this.attemptId = attemptId;
    this.violationCount = initialViolations || 0;
    this.onViolationCallback = onViolation;
    this.onDisqualifiedCallback = onDisqualified;

    // Set 5 second grace period for blur events so camera/fullscreen permissions do not trigger false violation
    this.ignoreBlurUntil = Date.now() + 5000;

    console.log("ExamGuard initialized for attempt #" + attemptId);

    // 1. Force Fullscreen
    this.requestFullscreen();

    // 2. Attach Event Listeners
    this.bindEvents();
  },

  pauseBlurDetection: function(ms = 4000) {
    this.ignoreBlurUntil = Date.now() + ms;
  },

  // Stop protection mode (after submission or exit)
  stop: function () {
    this.active = false;
    this.unbindEvents();
    this.exitFullscreen();
    window.onbeforeunload = null;
    console.log("ExamGuard stopped.");
  },

  // Force Browser Fullscreen
  requestFullscreen: function () {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => console.warn("Fullscreen request error:", err));
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  },

  // Exit Fullscreen
  exitFullscreen: function () {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((e) => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  },

  // Handle detected violation
  triggerViolation: function (type, details) {
    if (!this.active || !this.attemptId) return;

    // Debounce to prevent rapid duplicate events within 1.5 seconds
    const now = Date.now();
    if (now - this.lastViolationTime < 1500) {
      return;
    }
    this.lastViolationTime = now;

    console.warn(`[EXAM GUARD VIOLATION DETECTED] Type: ${type}, Details: ${details}`);

    // Send violation report to backend API
    fetch('api/exam.php?action=log_violation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attempt_id: this.attemptId,
        type: type,
        details: details
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          this.violationCount = data.violations_count;
          if (this.onViolationCallback) {
            this.onViolationCallback(data);
          }

          if (data.disqualified || this.violationCount >= this.maxViolations) {
            this.stop();
            if (this.onDisqualifiedCallback) {
              this.onDisqualifiedCallback(data);
            }
          }
        }
      })
      .catch((err) => console.error("Error logging violation:", err));
  },

  // Event Listener Handlers
  handleVisibilityChange: function () {
    if (document.hidden) {
      if (Date.now() < ExamGuard.ignoreBlurUntil) return;
      ExamGuard.triggerViolation('visibility_hidden', 'Berpindah tab atau meminimalkan browser.');
    }
  },

  handleWindowBlur: function () {
    if (ExamGuard.active) {
      if (Date.now() < ExamGuard.ignoreBlurUntil) {
        console.log("ExamGuard: ignoring window blur during camera permission / dialog grace period.");
        return;
      }
      ExamGuard.triggerViolation('window_blur', 'Jendela browser kehilangan fokus (alt-tab / aplikasi lain dibuka).');
    }
  },

  handleFullscreenChange: function () {
    if (ExamGuard.active && !document.fullscreenElement && !document.webkitFullscreenElement) {
      if (Date.now() < ExamGuard.ignoreBlurUntil) return;
      ExamGuard.triggerViolation('fullscreen_exit', 'Pengguna keluar dari mode layar penuh (fullscreen).');
    }
  },

  handleKeyDown: function (e) {
    if (!ExamGuard.active) return;

    // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Alt+Tab, Escape
    const key = e.key || e.keyCode;
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // F12 or Inspect shortcuts
    if (key === 'F12' || (isCtrl && isShift && (key === 'I' || key === 'i' || key === 'J' || key === 'j')) || (isCtrl && (key === 'u' || key === 'U'))) {
      e.preventDefault();
      e.stopPropagation();
      ExamGuard.triggerViolation('devtools_shortcut', 'Mencoba membuka Developer Tools (F12/Ctrl+Shift+I).');
      return false;
    }

    // Alt + Tab detection attempt
    if (isAlt && (key === 'Tab' || key === 9)) {
      e.preventDefault();
      ExamGuard.triggerViolation('alt_tab', 'Mencoba menekan tombol Alt+Tab.');
      return false;
    }

    // Copy / Paste shortcuts
    if (isCtrl && (key === 'c' || key === 'C' || key === 'v' || key === 'V' || key === 'x' || key === 'X' || key === 'a' || key === 'A')) {
      e.preventDefault();
      ExamGuard.triggerViolation('copy_paste', 'Mencoba melakukan Copy/Paste/Select All.');
      return false;
    }
  },

  handleContextMenu: function (e) {
    if (ExamGuard.active) {
      e.preventDefault();
      ExamGuard.triggerViolation('context_menu', 'Mencoba melakukan Klik Kanan.');
      return false;
    }
  },

  handleCopyCutPaste: function (e) {
    if (ExamGuard.active) {
      e.preventDefault();
      return false;
    }
  },

  bindEvents: function () {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('copy', this.handleCopyCutPaste);
    document.addEventListener('cut', this.handleCopyCutPaste);
    document.addEventListener('paste', this.handleCopyCutPaste);

    window.onbeforeunload = function () {
      if (ExamGuard.active) {
        return "Ujian sedang berlangsung! Jika Anda keluar, ujian Anda akan terdeteksi curang dan dibatalkan.";
      }
    };
  },

  unbindEvents: function () {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('copy', this.handleCopyCutPaste);
    document.removeEventListener('cut', this.handleCopyCutPaste);
    document.removeEventListener('paste', this.handleCopyCutPaste);
  }
};

/**
 * MDesign - Material Design 3 Library
 * Version: 1.0.0
 * Vanilla JavaScript Implementation
 *
 * Basierend auf Material Design 3 Guidelines
 * https://m3.material.io/
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.MDesign = factory()));
})(this, function () {
  'use strict';

  /**
   * MDesign Configuration
   */
  const config = {
    theme: 'auto', // 'light', 'dark', 'auto'
    ripple: true,
    animations: true,
    prefix: 'md-',
  };

  /**
   * Theme Management
   */
  const Theme = {
    /**
     * Get current theme
     * @returns {string} 'light' or 'dark'
     */
    get() {
      const root = document.documentElement;
      if (root.hasAttribute('data-theme')) {
        return root.getAttribute('data-theme');
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    },

    /**
     * Set theme
     * @param {string} theme - 'light', 'dark', or 'auto'
     */
    set(theme) {
      const root = document.documentElement;

      if (theme === 'auto') {
        root.removeAttribute('data-theme');
        config.theme = 'auto';
      } else {
        root.setAttribute('data-theme', theme);
        config.theme = theme;
      }

      // Store preference
      try {
        localStorage.setItem('md-theme', theme);
      } catch (e) {
        console.warn('MDesign: Unable to save theme preference to localStorage');
      }

      // Dispatch event
      document.dispatchEvent(
        new CustomEvent('md-theme-change', {
          detail: { theme: theme === 'auto' ? this.get() : theme },
        })
      );
    },

    /**
     * Toggle between light and dark
     */
    toggle() {
      const current = this.get();
      this.set(current === 'dark' ? 'light' : 'dark');
    },

    /**
     * Initialize theme from saved preference or system
     */
    init() {
      try {
        const saved = localStorage.getItem('md-theme');
        if (saved) {
          this.set(saved);
          return;
        }
      } catch (e) {
        // localStorage not available
      }

      // Listen for system theme changes
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          if (config.theme === 'auto') {
            document.dispatchEvent(
              new CustomEvent('md-theme-change', {
                detail: { theme: e.matches ? 'dark' : 'light' },
              })
            );
          }
        });
      }
    },
  };

  /**
   * Ripple Effect
   */
  const Ripple = {
    /**
     * Create ripple effect on element
     * @param {HTMLElement} element - Target element
     * @param {MouseEvent|TouchEvent} event - Click/touch event
     */
    create(element, event) {
      if (!config.ripple) return;

      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);

      let x, y;
      if (event.type.startsWith('touch')) {
        x = event.touches[0].clientX - rect.left - size / 2;
        y = event.touches[0].clientY - rect.top - size / 2;
      } else {
        x = event.clientX - rect.left - size / 2;
        y = event.clientY - rect.top - size / 2;
      }

      const ripple = document.createElement('span');
      ripple.className = 'md-ripple-wave';
      ripple.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
      `;

      element.appendChild(ripple);

      ripple.addEventListener('animationend', () => {
        ripple.remove();
      });
    },

    /**
     * Initialize ripple on elements
     */
    init() {
      document.addEventListener('click', (e) => {
        const target = e.target.closest('.md-ripple');
        if (target) {
          this.create(target, e);
        }
      });

      document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('.md-ripple');
        if (target) {
          this.create(target, e);
        }
      });
    },
  };

  /**
   * Dialog Management
   */
  const Dialog = {
    stack: [],

    /**
     * Open a dialog
     * @param {string|HTMLElement} dialog - Dialog selector or element
     * @param {Object} options - Dialog options
     */
    open(dialog, options = {}) {
      const el =
        typeof dialog === 'string'
          ? document.querySelector(dialog)
          : dialog;

      if (!el) {
        console.error('MDesign: Dialog not found');
        return;
      }

      // Find or create backdrop
      let backdrop = el.closest('.md-dialog-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'md-dialog-backdrop';
        el.parentNode.insertBefore(backdrop, el);
        backdrop.appendChild(el);
      }

      // Open
      backdrop.classList.add('md-open');
      backdrop.setAttribute('aria-hidden', 'false');

      // Focus management
      const focusable = el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) {
        focusable[0].focus();
      }

      // Store last focused element
      this.stack.push({
        dialog: el,
        backdrop,
        lastFocus: document.activeElement,
      });

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Close on backdrop click
      if (options.closeOnBackdrop !== false) {
        backdrop.addEventListener(
          'click',
          (e) => {
            if (e.target === backdrop) {
              this.close(el);
            }
          },
          { once: true }
        );
      }

      // Close on Escape
      if (options.closeOnEscape !== false) {
        document.addEventListener(
          'keydown',
          (e) => {
            if (e.key === 'Escape' && this.stack.length) {
              const last = this.stack[this.stack.length - 1];
              if (last.dialog === el) {
                this.close(el);
              }
            }
          },
          { once: true }
        );
      }

      // Dispatch event
      el.dispatchEvent(new CustomEvent('md-dialog-open'));
    },

    /**
     * Close a dialog
     * @param {string|HTMLElement} dialog - Dialog selector or element
     */
    close(dialog) {
      const el =
        typeof dialog === 'string'
          ? document.querySelector(dialog)
          : dialog;

      if (!el) return;

      const backdrop = el.closest('.md-dialog-backdrop');
      if (backdrop) {
        backdrop.classList.remove('md-open');
        backdrop.setAttribute('aria-hidden', 'true');
      }

      // Restore focus
      const index = this.stack.findIndex((item) => item.dialog === el);
      if (index > -1) {
        const item = this.stack[index];
        if (item.lastFocus && item.lastFocus.focus) {
          item.lastFocus.focus();
        }
        this.stack.splice(index, 1);
      }

      // Restore body scroll if no dialogs open
      if (this.stack.length === 0) {
        document.body.style.overflow = '';
      }

      // Dispatch event
      el.dispatchEvent(new CustomEvent('md-dialog-close'));
    },

    /**
     * Close all dialogs
     */
    closeAll() {
      while (this.stack.length) {
        this.close(this.stack[this.stack.length - 1].dialog);
      }
    },

    /**
     * Confirm dialog helper
     * @param {Object} options - Dialog options
     * @returns {Promise<boolean>}
     */
    confirm(options = {}) {
      return new Promise((resolve) => {
        const {
          title = 'Bestätigung',
          message = 'Sind Sie sicher?',
          confirmText = 'Bestätigen',
          cancelText = 'Abbrechen',
          icon = null,
        } = options;

        const backdrop = document.createElement('div');
        backdrop.className = 'md-dialog-backdrop';
        backdrop.innerHTML = `
          <div class="md-dialog" role="alertdialog" aria-labelledby="md-confirm-title" aria-describedby="md-confirm-desc">
            <div class="md-dialog-header">
              ${icon ? `<div class="md-dialog-icon"><span class="md-icon">${icon}</span></div>` : ''}
              <h2 class="md-dialog-title" id="md-confirm-title">${title}</h2>
            </div>
            <div class="md-dialog-content">
              <p id="md-confirm-desc">${message}</p>
            </div>
            <div class="md-dialog-actions">
              <button class="md-btn md-btn-text" data-action="cancel">${cancelText}</button>
              <button class="md-btn md-btn-filled md-ripple" data-action="confirm">${confirmText}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);

        const dialog = backdrop.querySelector('.md-dialog');

        const cleanup = (result) => {
          backdrop.classList.remove('md-open');
          setTimeout(() => {
            backdrop.remove();
          }, 300);
          resolve(result);
        };

        backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
        backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) cleanup(false);
        });
        document.addEventListener(
          'keydown',
          (e) => {
            if (e.key === 'Escape') cleanup(false);
          },
          { once: true }
        );

        // Open
        requestAnimationFrame(() => {
          backdrop.classList.add('md-open');
          backdrop.querySelector('[data-action="confirm"]').focus();
        });
      });
    },

    /**
     * Alert dialog helper
     * @param {Object} options - Dialog options
     * @returns {Promise<void>}
     */
    alert(options = {}) {
      return new Promise((resolve) => {
        const {
          title = 'Hinweis',
          message = '',
          buttonText = 'OK',
          icon = null,
        } = options;

        const backdrop = document.createElement('div');
        backdrop.className = 'md-dialog-backdrop';
        backdrop.innerHTML = `
          <div class="md-dialog" role="alertdialog" aria-labelledby="md-alert-title" aria-describedby="md-alert-desc">
            <div class="md-dialog-header">
              ${icon ? `<div class="md-dialog-icon"><span class="md-icon">${icon}</span></div>` : ''}
              <h2 class="md-dialog-title" id="md-alert-title">${title}</h2>
            </div>
            <div class="md-dialog-content">
              <p id="md-alert-desc">${message}</p>
            </div>
            <div class="md-dialog-actions">
              <button class="md-btn md-btn-filled md-ripple" data-action="ok">${buttonText}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);

        const cleanup = () => {
          backdrop.classList.remove('md-open');
          setTimeout(() => {
            backdrop.remove();
          }, 300);
          resolve();
        };

        backdrop.querySelector('[data-action="ok"]').addEventListener('click', cleanup);
        document.addEventListener(
          'keydown',
          (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') cleanup();
          },
          { once: true }
        );

        // Open
        requestAnimationFrame(() => {
          backdrop.classList.add('md-open');
          backdrop.querySelector('[data-action="ok"]').focus();
        });
      });
    },
  };

  /**
   * Snackbar Management
   */
  const Snackbar = {
    container: null,
    queue: [],
    current: null,

    /**
     * Initialize snackbar container
     */
    init() {
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'md-snackbar-container';
        this.container.setAttribute('role', 'status');
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
      }
    },

    /**
     * Show a snackbar
     * @param {Object} options - Snackbar options
     * @returns {Object} Snackbar instance
     */
    show(options = {}) {
      this.init();

      const {
        message = '',
        action = null,
        actionText = 'Aktion',
        duration = 4000,
        closeable = false,
      } = options;

      const snackbar = document.createElement('div');
      snackbar.className = 'md-snackbar';
      snackbar.innerHTML = `
        <span class="md-snackbar-text">${message}</span>
        ${action ? `<button class="md-snackbar-action">${actionText}</button>` : ''}
        ${closeable ? `<button class="md-snackbar-close" aria-label="Schließen"><span class="md-icon">close</span></button>` : ''}
      `;

      if (action) {
        snackbar.querySelector('.md-snackbar-action').addEventListener('click', () => {
          action();
          this.hide(snackbar);
        });
      }

      if (closeable) {
        snackbar.querySelector('.md-snackbar-close').addEventListener('click', () => {
          this.hide(snackbar);
        });
      }

      this.container.appendChild(snackbar);

      // Trigger animation
      requestAnimationFrame(() => {
        snackbar.classList.add('md-show');
      });

      // Auto hide
      let timeout;
      if (duration > 0) {
        timeout = setTimeout(() => {
          this.hide(snackbar);
        }, duration);
      }

      const instance = {
        element: snackbar,
        hide: () => this.hide(snackbar),
        timeout,
      };

      this.current = instance;

      return instance;
    },

    /**
     * Hide a snackbar
     * @param {HTMLElement} snackbar - Snackbar element
     */
    hide(snackbar) {
      snackbar.classList.remove('md-show');
      setTimeout(() => {
        if (snackbar.parentNode) {
          snackbar.remove();
        }
      }, 300);
    },

    /**
     * Hide current snackbar
     */
    hideCurrent() {
      if (this.current) {
        clearTimeout(this.current.timeout);
        this.hide(this.current.element);
        this.current = null;
      }
    },
  };

  /**
   * Bottom Sheet Management
   */
  const BottomSheet = {
    /**
     * Open a bottom sheet
     * @param {string|HTMLElement} sheet - Bottom sheet selector or element
     */
    open(sheet) {
      const el = typeof sheet === 'string' ? document.querySelector(sheet) : sheet;

      if (!el) {
        console.error('MDesign: Bottom sheet not found');
        return;
      }

      let backdrop = el.closest('.md-bottom-sheet-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'md-bottom-sheet-backdrop';
        el.parentNode.insertBefore(backdrop, el);
        backdrop.appendChild(el);
      }

      backdrop.classList.add('md-open');
      document.body.style.overflow = 'hidden';

      // Close on backdrop click
      backdrop.addEventListener(
        'click',
        (e) => {
          if (e.target === backdrop) {
            this.close(el);
          }
        },
        { once: true }
      );

      // Close on escape
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape') {
            this.close(el);
          }
        },
        { once: true }
      );

      el.dispatchEvent(new CustomEvent('md-bottomsheet-open'));
    },

    /**
     * Close a bottom sheet
     * @param {string|HTMLElement} sheet - Bottom sheet selector or element
     */
    close(sheet) {
      const el = typeof sheet === 'string' ? document.querySelector(sheet) : sheet;

      if (!el) return;

      const backdrop = el.closest('.md-bottom-sheet-backdrop');
      if (backdrop) {
        backdrop.classList.remove('md-open');
      }

      document.body.style.overflow = '';
      el.dispatchEvent(new CustomEvent('md-bottomsheet-close'));
    },
  };

  /**
   * Drawer Management
   */
  const Drawer = {
    /**
     * Open a drawer
     * @param {string|HTMLElement} drawer - Drawer selector or element
     */
    open(drawer) {
      const el = typeof drawer === 'string' ? document.querySelector(drawer) : drawer;

      if (!el) {
        console.error('MDesign: Drawer not found');
        return;
      }

      let backdrop = el.closest('.md-drawer-backdrop');
      if (!backdrop && !el.classList.contains('md-drawer-permanent')) {
        backdrop = document.createElement('div');
        backdrop.className = 'md-drawer-backdrop';
        el.parentNode.insertBefore(backdrop, el);
        backdrop.appendChild(el);
      }

      if (backdrop) {
        backdrop.classList.add('md-open');
      }
      el.classList.add('md-open');
      document.body.style.overflow = 'hidden';

      // Close on backdrop click
      if (backdrop) {
        backdrop.addEventListener(
          'click',
          (e) => {
            if (e.target === backdrop) {
              this.close(el);
            }
          },
          { once: true }
        );
      }

      // Close on escape
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape') {
            this.close(el);
          }
        },
        { once: true }
      );

      el.dispatchEvent(new CustomEvent('md-drawer-open'));
    },

    /**
     * Close a drawer
     * @param {string|HTMLElement} drawer - Drawer selector or element
     */
    close(drawer) {
      const el = typeof drawer === 'string' ? document.querySelector(drawer) : drawer;

      if (!el) return;

      const backdrop = el.closest('.md-drawer-backdrop');
      if (backdrop) {
        backdrop.classList.remove('md-open');
      }
      el.classList.remove('md-open');
      document.body.style.overflow = '';

      el.dispatchEvent(new CustomEvent('md-drawer-close'));
    },

    /**
     * Toggle drawer
     * @param {string|HTMLElement} drawer - Drawer selector or element
     */
    toggle(drawer) {
      const el = typeof drawer === 'string' ? document.querySelector(drawer) : drawer;
      if (el && el.classList.contains('md-open')) {
        this.close(el);
      } else {
        this.open(el);
      }
    },
  };

  /**
   * Tabs Management
   */
  const Tabs = {
    /**
     * Initialize tabs
     * @param {string|HTMLElement} container - Tabs container selector or element
     */
    init(container) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;

      if (!el) return;

      const tabs = el.querySelectorAll('.md-tab');
      const panels = el.querySelectorAll('.md-tab-panel');

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
          this.activate(el, index);
        });

        // Keyboard navigation
        tab.addEventListener('keydown', (e) => {
          let newIndex = index;

          if (e.key === 'ArrowRight') {
            newIndex = (index + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft') {
            newIndex = (index - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            newIndex = 0;
          } else if (e.key === 'End') {
            newIndex = tabs.length - 1;
          } else {
            return;
          }

          e.preventDefault();
          tabs[newIndex].focus();
          this.activate(el, newIndex);
        });
      });
    },

    /**
     * Activate a tab
     * @param {HTMLElement} container - Tabs container
     * @param {number} index - Tab index
     */
    activate(container, index) {
      const tabs = container.querySelectorAll('.md-tab');
      const panels = container.querySelectorAll('.md-tab-panel');

      tabs.forEach((tab, i) => {
        tab.classList.toggle('md-active', i === index);
        tab.setAttribute('aria-selected', i === index);
        tab.setAttribute('tabindex', i === index ? '0' : '-1');
      });

      panels.forEach((panel, i) => {
        panel.classList.toggle('md-active', i === index);
        panel.setAttribute('aria-hidden', i !== index);
      });

      container.dispatchEvent(
        new CustomEvent('md-tab-change', {
          detail: { index },
        })
      );
    },

    /**
     * Auto-initialize all tabs
     */
    autoInit() {
      document.querySelectorAll('.md-tabs').forEach((tabs) => {
        const container = tabs.closest('.md-tab-container') || tabs.parentElement;
        this.init(container);
      });
    },
  };

  /**
   * Form Validation
   */
  const FormValidation = {
    /**
     * Initialize form validation
     * @param {string|HTMLElement} form - Form selector or element
     * @param {Object} options - Validation options
     */
    init(form, options = {}) {
      const el = typeof form === 'string' ? document.querySelector(form) : form;

      if (!el) return;

      const inputs = el.querySelectorAll('input, textarea, select');

      inputs.forEach((input) => {
        // Add real-time validation
        input.addEventListener('blur', () => {
          this.validateField(input);
        });

        input.addEventListener('input', () => {
          // Remove error state on input
          if (input.classList.contains('md-error')) {
            this.clearError(input);
          }
        });
      });

      // Form submit validation
      el.addEventListener('submit', (e) => {
        let isValid = true;

        inputs.forEach((input) => {
          if (!this.validateField(input)) {
            isValid = false;
          }
        });

        if (!isValid) {
          e.preventDefault();
          // Focus first invalid field
          const firstInvalid = el.querySelector('.md-error');
          if (firstInvalid) {
            firstInvalid.focus();
          }
        }
      });
    },

    /**
     * Validate a single field
     * @param {HTMLElement} field - Input field
     * @returns {boolean} Is valid
     */
    validateField(field) {
      const value = field.value.trim();
      let isValid = true;
      let message = '';

      // Required validation
      if (field.hasAttribute('required') && !value) {
        isValid = false;
        message = field.dataset.requiredMessage || 'Dieses Feld ist erforderlich';
      }

      // Email validation
      if (isValid && field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          message = field.dataset.emailMessage || 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
        }
      }

      // Min length validation
      if (isValid && field.hasAttribute('minlength') && value) {
        const minLength = parseInt(field.getAttribute('minlength'));
        if (value.length < minLength) {
          isValid = false;
          message =
            field.dataset.minlengthMessage ||
            `Mindestens ${minLength} Zeichen erforderlich`;
        }
      }

      // Max length validation
      if (isValid && field.hasAttribute('maxlength') && value) {
        const maxLength = parseInt(field.getAttribute('maxlength'));
        if (value.length > maxLength) {
          isValid = false;
          message =
            field.dataset.maxlengthMessage ||
            `Maximal ${maxLength} Zeichen erlaubt`;
        }
      }

      // Pattern validation
      if (isValid && field.hasAttribute('pattern') && value) {
        const pattern = new RegExp(field.getAttribute('pattern'));
        if (!pattern.test(value)) {
          isValid = false;
          message = field.dataset.patternMessage || 'Ungültiges Format';
        }
      }

      // Min/Max validation for numbers
      if (isValid && field.type === 'number' && value) {
        const numValue = parseFloat(value);
        if (field.hasAttribute('min') && numValue < parseFloat(field.getAttribute('min'))) {
          isValid = false;
          message = field.dataset.minMessage || `Minimum: ${field.getAttribute('min')}`;
        }
        if (field.hasAttribute('max') && numValue > parseFloat(field.getAttribute('max'))) {
          isValid = false;
          message = field.dataset.maxMessage || `Maximum: ${field.getAttribute('max')}`;
        }
      }

      // Custom validation
      if (isValid && field.dataset.validate) {
        const customValidation = window[field.dataset.validate];
        if (typeof customValidation === 'function') {
          const result = customValidation(value, field);
          if (result !== true) {
            isValid = false;
            message = result || 'Ungültiger Wert';
          }
        }
      }

      // Update field state
      if (isValid) {
        this.setSuccess(field);
      } else {
        this.setError(field, message);
      }

      return isValid;
    },

    /**
     * Set error state on field
     * @param {HTMLElement} field - Input field
     * @param {string} message - Error message
     */
    setError(field, message) {
      field.classList.remove('md-success');
      field.classList.add('md-error');
      field.setAttribute('aria-invalid', 'true');

      // Find or create helper text
      let helper = field.parentElement.querySelector('.md-helper-text');
      if (!helper) {
        helper = document.createElement('span');
        helper.className = 'md-helper-text';
        field.parentElement.appendChild(helper);
      }

      helper.textContent = message;
      helper.classList.add('md-error');
      helper.classList.remove('md-success');
      field.setAttribute('aria-describedby', helper.id || '');
    },

    /**
     * Set success state on field
     * @param {HTMLElement} field - Input field
     */
    setSuccess(field) {
      field.classList.remove('md-error');
      field.classList.add('md-success');
      field.setAttribute('aria-invalid', 'false');

      const helper = field.parentElement.querySelector('.md-helper-text');
      if (helper && helper.classList.contains('md-error')) {
        helper.textContent = '';
        helper.classList.remove('md-error');
      }
    },

    /**
     * Clear error state on field
     * @param {HTMLElement} field - Input field
     */
    clearError(field) {
      field.classList.remove('md-error', 'md-success');
      field.removeAttribute('aria-invalid');

      const helper = field.parentElement.querySelector('.md-helper-text.md-error');
      if (helper) {
        helper.textContent = '';
        helper.classList.remove('md-error');
      }
    },
  };

  /**
   * Chips
   */
  const Chips = {
    /**
     * Initialize chip group
     * @param {string|HTMLElement} container - Chip container
     * @param {Object} options - Chip options
     */
    init(container, options = {}) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;

      if (!el) return;

      const { multiSelect = false, onChange = null } = options;

      el.querySelectorAll('.md-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          if (chip.classList.contains('md-chip-input')) {
            // Input chip - handle close
            return;
          }

          if (multiSelect) {
            chip.classList.toggle('md-selected');
          } else {
            el.querySelectorAll('.md-chip').forEach((c) => c.classList.remove('md-selected'));
            chip.classList.add('md-selected');
          }

          chip.setAttribute('aria-selected', chip.classList.contains('md-selected'));

          if (onChange) {
            onChange(this.getSelected(el));
          }

          el.dispatchEvent(
            new CustomEvent('md-chip-change', {
              detail: { selected: this.getSelected(el) },
            })
          );
        });

        // Handle close button
        const closeBtn = chip.querySelector('.md-chip-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chip.remove();

            el.dispatchEvent(
              new CustomEvent('md-chip-remove', {
                detail: { chip },
              })
            );
          });
        }
      });
    },

    /**
     * Get selected chips
     * @param {HTMLElement} container - Chip container
     * @returns {Array} Selected chip values
     */
    getSelected(container) {
      const selected = [];
      container.querySelectorAll('.md-chip.md-selected').forEach((chip) => {
        selected.push(chip.dataset.value || chip.textContent.trim());
      });
      return selected;
    },
  };

  /**
   * Menu
   */
  const Menu = {
    current: null,

    /**
     * Show menu at position
     * @param {string|HTMLElement} menu - Menu selector or element
     * @param {Object} position - Position {x, y} or anchor element
     */
    show(menu, position) {
      const el = typeof menu === 'string' ? document.querySelector(menu) : menu;

      if (!el) return;

      // Close any open menu
      this.hideAll();

      // Position menu
      if (position instanceof HTMLElement) {
        const rect = position.getBoundingClientRect();
        el.style.position = 'fixed';
        el.style.top = `${rect.bottom}px`;
        el.style.left = `${rect.left}px`;
      } else if (position) {
        el.style.position = 'fixed';
        el.style.top = `${position.y}px`;
        el.style.left = `${position.x}px`;
      }

      el.classList.add('md-open');
      el.setAttribute('aria-hidden', 'false');

      this.current = el;

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', this._outsideClickHandler);
        document.addEventListener('keydown', this._escapeHandler);
      }, 0);
    },

    /**
     * Hide menu
     * @param {string|HTMLElement} menu - Menu selector or element
     */
    hide(menu) {
      const el = typeof menu === 'string' ? document.querySelector(menu) : menu;

      if (!el) return;

      el.classList.remove('md-open');
      el.setAttribute('aria-hidden', 'true');

      if (this.current === el) {
        this.current = null;
        document.removeEventListener('click', this._outsideClickHandler);
        document.removeEventListener('keydown', this._escapeHandler);
      }
    },

    /**
     * Hide all menus
     */
    hideAll() {
      document.querySelectorAll('.md-menu.md-open, menu.md-open').forEach((menu) => {
        menu.classList.remove('md-open');
        menu.setAttribute('aria-hidden', 'true');
      });
      this.current = null;
      document.removeEventListener('click', this._outsideClickHandler);
      document.removeEventListener('keydown', this._escapeHandler);
    },

    _outsideClickHandler(e) {
      if (Menu.current && !Menu.current.contains(e.target)) {
        Menu.hideAll();
      }
    },

    _escapeHandler(e) {
      if (e.key === 'Escape') {
        Menu.hideAll();
      }
    },
  };

  /**
   * Tooltip
   */
  const Tooltip = {
    /**
     * Create tooltip
     * @param {HTMLElement} element - Target element
     * @param {string} text - Tooltip text
     * @param {Object} options - Tooltip options
     */
    create(element, text, options = {}) {
      const { position = 'top', rich = false } = options;

      element.classList.add('md-tooltip');

      const tooltip = document.createElement('span');
      tooltip.className = `md-tooltip-text${rich ? ' md-tooltip-rich' : ''}`;
      tooltip.textContent = text;

      element.appendChild(tooltip);

      // Position classes could be added here for different positions
      tooltip.dataset.position = position;
    },

    /**
     * Auto-initialize tooltips from data attributes
     */
    autoInit() {
      document.querySelectorAll('[data-md-tooltip]').forEach((el) => {
        this.create(el, el.dataset.mdTooltip, {
          position: el.dataset.mdTooltipPosition || 'top',
          rich: el.dataset.mdTooltipRich === 'true',
        });
      });
    },
  };

  /**
   * Character Counter
   */
  const CharCounter = {
    /**
     * Initialize character counter on input
     * @param {string|HTMLElement} input - Input selector or element
     * @param {number} maxLength - Maximum character length
     */
    init(input, maxLength) {
      const el = typeof input === 'string' ? document.querySelector(input) : input;

      if (!el) return;

      const counter = document.createElement('span');
      counter.className = 'md-char-counter';

      el.parentElement.appendChild(counter);

      const update = () => {
        const current = el.value.length;
        counter.textContent = `${current} / ${maxLength}`;

        if (current > maxLength) {
          counter.classList.add('md-error');
          el.classList.add('md-error');
        } else {
          counter.classList.remove('md-error');
          el.classList.remove('md-error');
        }
      };

      el.addEventListener('input', update);
      update();
    },
  };

  /**
   * Floating Label
   */
  const FloatingLabel = {
    /**
     * Initialize floating labels
     */
    init() {
      document.querySelectorAll('.md-text-field input, .md-text-field textarea').forEach((input) => {
        const updateState = () => {
          if (input.value) {
            input.classList.add('md-filled');
          } else {
            input.classList.remove('md-filled');
          }
        };

        input.addEventListener('input', updateState);
        input.addEventListener('change', updateState);
        updateState();
      });
    },
  };

  /**
   * Initialize MDesign
   * @param {Object} options - Configuration options
   */
  function init(options = {}) {
    // Merge options
    Object.assign(config, options);

    // Initialize modules
    Theme.init();
    Ripple.init();
    FloatingLabel.init();
    Tabs.autoInit();
    Tooltip.autoInit();

    // Auto-initialize dialogs
    document.querySelectorAll('[data-md-dialog]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        Dialog.open(trigger.dataset.mdDialog);
      });
    });

    // Auto-initialize dialog close buttons
    document.querySelectorAll('[data-md-dialog-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dialog = btn.closest('.md-dialog');
        if (dialog) {
          Dialog.close(dialog);
        }
      });
    });

    // Auto-initialize drawers
    document.querySelectorAll('[data-md-drawer]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        Drawer.toggle(trigger.dataset.mdDrawer);
      });
    });

    // Auto-initialize bottom sheets
    document.querySelectorAll('[data-md-bottomsheet]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        BottomSheet.open(trigger.dataset.mdBottomsheet);
      });
    });

    // Auto-initialize menus
    document.querySelectorAll('[data-md-menu]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.querySelector(trigger.dataset.mdMenu);
        if (menu) {
          if (menu.classList.contains('md-open')) {
            Menu.hide(menu);
          } else {
            Menu.show(menu, trigger);
          }
        }
      });
    });

    // Auto-initialize form validation
    document.querySelectorAll('form[data-md-validate]').forEach((form) => {
      FormValidation.init(form);
    });

    // Auto-initialize character counters
    document.querySelectorAll('[data-md-maxlength]').forEach((input) => {
      CharCounter.init(input, parseInt(input.dataset.mdMaxlength));
    });

    // Auto-initialize chip groups
    document.querySelectorAll('.md-chip-group').forEach((group) => {
      Chips.init(group, {
        multiSelect: group.dataset.mdMultiselect === 'true',
      });
    });

    // Add ripple class to common interactive elements
    document.querySelectorAll('.md-btn:not(.md-btn-text), .md-fab, .md-card-clickable').forEach((el) => {
      if (!el.classList.contains('md-ripple')) {
        el.classList.add('md-ripple');
      }
    });

    console.log('MDesign initialized');
  }

  /**
   * Utility Functions
   */
  const Utils = {
    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    uniqueId(prefix = 'md') {
      return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in ms
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
      let inThrottle;
      return function executedFunction(...args) {
        if (!inThrottle) {
          func(...args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    },

    /**
     * Check if element is in viewport
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} Is in viewport
     */
    isInViewport(element) {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    },

    /**
     * Animate element
     * @param {HTMLElement} element - Element to animate
     * @param {string} animation - Animation class name
     * @returns {Promise} Animation complete promise
     */
    animate(element, animation) {
      return new Promise((resolve) => {
        element.classList.add(animation);
        element.addEventListener(
          'animationend',
          () => {
            element.classList.remove(animation);
            resolve();
          },
          { once: true }
        );
      });
    },
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  // Public API
  return {
    init,
    config,
    Theme,
    Ripple,
    Dialog,
    Snackbar,
    BottomSheet,
    Drawer,
    Tabs,
    Menu,
    Tooltip,
    Chips,
    FormValidation,
    CharCounter,
    FloatingLabel,
    Utils,
    version: '1.0.0',
  };
});

/**
 * @fileoverview Port of the UI coordination facade: orchestrates multi-note workspaces,
 * sidebar catalogs navigator, synced editor layouts and About cheatsheet settings.
 */

(function() {
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});
  const MathEngine = NoteCalci.MathEngine;

  /**
   * CalculatorScreen facade class coordinates workspace layouts, notes data and calculations.
   */
  class CalculatorScreen {
    constructor() {
      // 1. Initialize Gutter Results & Editor Workspace pane module
      const editor = document.getElementById('editor');
      const lineNumbers = document.getElementById('line-numbers');
      const results = document.getElementById('results');
      const backgrounds = document.getElementById('row-backgrounds');

      // 2. Initialize Notes Sidebar list catalog views module
      const notesListContainer = document.getElementById('notes-list');
      this.noteTitleInput = document.getElementById('note-title');
      const btnNewNote = document.getElementById('btn-new-note');
      const btnDeleteNote = document.getElementById('btn-delete-note');
      
      this.btnResetWorkspace = document.getElementById('btn-reset-workspace');
      this.btnRollbackCache = document.getElementById('btn-rollback-cache');
      this.btnForceUpdate = document.getElementById('btn-force-update');
      this.btnHamburger = document.getElementById('btn-hamburger');
      this.notesSidebarElement = document.querySelector('.notes-sidebar');

      // 3. Initialize Swappable View tabs tab navigation elements
      this.btnEditorView = document.getElementById('btn-editor-view');
      this.btnAboutView = document.getElementById('btn-about-view');
      this.editorViewSection = document.getElementById('editor-view');
      this.aboutViewSection = document.getElementById('about-view');

      if (
        !editor || !lineNumbers || !results || !backgrounds || 
        !notesListContainer || !this.noteTitleInput || !btnNewNote || !btnDeleteNote ||
        !this.btnResetWorkspace || !this.btnRollbackCache || !this.btnForceUpdate || !this.btnEditorView || !this.btnAboutView || 
        !this.editorViewSection || !this.aboutViewSection || !this.btnHamburger ||
        !this.notesSidebarElement
      ) {
        throw new Error('CalculatorScreen initialization error: Required views not found inside DOM.');
      }

      // Decoupled UI submodules initialization
      this.workspace = new NoteCalci.EditorWorkspace(editor, lineNumbers, results, backgrounds);
      
      this.sidebar = new NoteCalci.NotesSidebar(
        notesListContainer,
        btnNewNote,
        btnDeleteNote,
        (id) => this.selectActiveNote(id),
        () => this.deleteSelectedNote(),
        () => this.createNewWorksheet()
      );

      // Load local storage data manager
      this.notesManager = new NoteCalci.NotesManager();

      // Bind coordinate events and tab swappings
      this.registerGlobalEvents();

      // Query active targeted cache version on startup
      this.queryAndRenderActiveVersion();

      // Open active worksheet on boot
      if (this.notesManager.activeNoteId) {
        this.selectActiveNote(this.notesManager.activeNoteId);
      } else if (this.notesManager.notes.length > 0) {
        this.selectActiveNote(this.notesManager.notes[0].id);
      }
    }

    /**
     * Selects and loads custom notes worksheets context.
     * @param {string} id NoteItem index ID
     */
    selectActiveNote(id) {
      this.notesManager.setActiveNote(id);
      const note = this.notesManager.getNote(id);
      if (note) {
        this.workspace.editor.value = note.content;
        this.noteTitleInput.value = note.name;
        
        // Recompute mathematical lines and update gutters
        this.onKeystrokeRecalculate();
        this.sidebar.render(this.notesManager.notes, this.notesManager.activeNoteId);
        
        // Auto-collapse sliding notes drawer overlay on mobile viewports note selects
        this.notesSidebarElement.classList.remove('drawer-open');
        
        this.workspace.focusEditor();
      }
    }

    /**
     * Spawns a clean calculation worksheet and redirects focus.
     */
    createNewWorksheet() {
      const note = this.notesManager.createNote();
      this.selectActiveNote(note.id);
    }

    /**
     * Deletes active workspace sheet securely.
     */
    deleteSelectedNote() {
      const activeId = this.notesManager.activeNoteId;
      if (activeId) {
        this.notesManager.deleteNote(activeId);
        const nextId = this.notesManager.activeNoteId;
        if (nextId) {
          this.selectActiveNote(nextId);
        }
      }
    }

    /**
     * Rename note catalog text entries.
     */
    onTitleRename() {
      const activeId = this.notesManager.activeNoteId;
      const newName = this.noteTitleInput.value;
      if (activeId) {
        this.notesManager.renameNote(activeId, newName);
        this.sidebar.render(this.notesManager.notes, this.notesManager.activeNoteId);
      }
    }

    /**
     * Realtime calculation recalculator.
     */
    onKeystrokeRecalculate() {
      const content = this.workspace.editor.value;
      const activeId = this.notesManager.activeNoteId;
      
      // Save content inside LocalStorage index
      if (activeId) {
        this.notesManager.updateNoteContent(activeId, content);
      }

      const lines = content.split('\n');
      const rawLinesCount = Math.max(1, lines.length);

      // Precheck and strip prose text boundaries using core sandboxing
      const cleanLines = lines.map(line => NoteCalci.MathEngine.isProseLine(line) ? '' : line);
      const calculationResults = MathEngine.calculate(cleanLines);

      // Propagate layout values to Editor Workspace submodule
      this.workspace.updateLineNumbers(rawLinesCount);
      this.workspace.updateResultsGutter(calculationResults);
    }

    /**
     * Binds header navigation view swaps and administrative settings resets.
     */
    registerGlobalEvents() {
      // Key stroke calculated loops
      this.workspace.editor.addEventListener('input', () => this.onKeystrokeRecalculate());
      this.noteTitleInput.addEventListener('input', () => this.onTitleRename());

      // Auto-collapse sliding notes drawer overlay when typing or focusing textarea
      this.workspace.editor.addEventListener('focus', () => {
        this.notesSidebarElement.classList.remove('drawer-open');
      });

      // Toggle hamburger responsive menu drawer overlay
      this.btnHamburger.addEventListener('click', (e) => {
        this.notesSidebarElement.classList.toggle('drawer-open');
        e.stopPropagation();
      });

      // Bind PWA Cache Version Rollback or Upgrade click
      this.btnRollbackCache.addEventListener('click', () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const isRollbackState = this.btnRollbackCache.textContent.includes('Rollback');
          const actionToken = isRollbackState ? 'rollback' : 'upgrade';
          
          const cur = window._activeCurrentVer || 'v4';
          const pri = window._activePriorVer || 'v3';

          const confirmMsg = isRollbackState 
            ? `Are you sure you want to roll back your offline cache to the prior version (${pri})? This will load older asset versions.`
            : `Are you sure you want to upgrade your offline cache back to the latest version (${cur})? This will load the newest calculators features.`;
          
          const confirmed = confirm(confirmMsg);
          if (confirmed) {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
              if (event.data && event.data.success) {
                alert(`Offline cache targeted successfully flipped to ${event.data.version}! Reloading app...`);
                window.location.reload();
              }
            };
            
            navigator.serviceWorker.controller.postMessage(
              { action: actionToken },
              [messageChannel.port2]
            );
          }
        } else {
          alert('Cache versioning unavailable: Page must be running as an installed PWA under a secure localhost/HTTPS origin.');
        }
      });

      // Troubleshooter Tool: Force update, unregister workers, and clear all caches securely
      this.btnForceUpdate.addEventListener('click', () => {
        // Symmetrical Active HTTP Ping: check if the python dev server is actively responsive
        fetch('index.html', { method: 'HEAD', cache: 'no-store' })
          .then(() => {
            // Server is alive! Safe to proceed with confirmation and wipe
            const confirmed = confirm('Are you sure you want to force update NoteCalci? This will wipe all cached code files completely and download the latest version from the server. Your notes and worksheets will remain safe.');
            if (confirmed) {
              // 1. Unregister all active PWA service workers
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                  for (let reg of registrations) {
                    reg.unregister();
                  }
                });
              }

              // 2. Sweep clean every offline Cache Storage bucket
              if ('caches' in window) {
                caches.keys().then((keys) => {
                  return Promise.all(keys.map(key => caches.delete(key)));
                }).then(() => {
                  // 3. Trigger hard browser reload, ignoring browser asset cache memory
                  alert('PWA caches wiped completely! Downloading latest code from server...');
                  window.location.reload(true);
                });
              } else {
                window.location.reload(true);
              }
            }
          })
          .catch(() => {
            alert('Force Update failed: The application server is currently unreachable! We blocked the cache wipe to prevent losing your offline workbook files. Please check your internet connection or verify that the host server is online and try again.');
          });
      });

      // Bind Danger Zone settings wipes click
      this.btnResetWorkspace.addEventListener('click', () => {
        const confirmed = confirm('Are you sure you want to reset your workspace? This will delete all custom notes and restore standard templates.');
        if (confirmed) {
          this.notesManager.resetWorkspace();
          const firstId = this.notesManager.notes[0].id;
          this.selectActiveNote(firstId);
        }
      });

      // Swappable View tab triggers
      this.btnEditorView.addEventListener('click', () => {
        this.btnEditorView.classList.add('active');
        this.btnAboutView.classList.remove('active');
        this.editorViewSection.classList.remove('hidden');
        this.aboutViewSection.classList.add('hidden');
        this.onKeystrokeRecalculate(); // refresh height locks
      });

      this.btnAboutView.addEventListener('click', () => {
        this.btnAboutView.classList.add('active');
        this.btnEditorView.classList.remove('active');
        this.aboutViewSection.classList.remove('hidden');
        this.editorViewSection.classList.add('hidden');
      });

      // Rescale when dimensions shifts
      window.addEventListener('resize', () => {
        this.onKeystrokeRecalculate();
      });
    }

    /**
     * Queries the active ServiceWorker for the targeted cache version schema 
     * and dynamically updates browser tab titles, About labels, and settings button UI texts.
     */
    queryAndRenderActiveVersion() {
      const versionLabelElement = document.getElementById('active-cache-version');
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (e) => {
          if (e.data && e.data.version) {
            const activeVer = e.data.version;
            const cur = e.data.current || 'v4';
            const pri = e.data.prior || 'v3';
            
            // Save version parameters globally on the window object
            window._activeCurrentVer = cur;
            window._activePriorVer = pri;
            
            // 1. Update browser page tab title bar cleanly
            document.title = `NoteCalci Web 🧮 (${activeVer})`;
            
            // 2. Update About page Danger Zone label status text
            if (versionLabelElement) {
              versionLabelElement.textContent = activeVer;
            }
            
            // 3. Toggle action button UI text dynamically based on generic version codes
            if (activeVer === pri) {
              this.btnRollbackCache.disabled = false;
              this.btnRollbackCache.textContent = `Upgrade to Latest (${cur})`;
              this.btnRollbackCache.style.borderColor = 'var(--result-success)';
              this.btnRollbackCache.style.opacity = '1';
            } else {
              // If running latest version, check if prior cache folder actually exists on the disk
              const hasPrior = e.data.hasPrior;
              if (hasPrior) {
                this.btnRollbackCache.disabled = false;
                this.btnRollbackCache.textContent = `Rollback to Prior Version (${pri})`;
                this.btnRollbackCache.style.borderColor = 'var(--border-color)';
                this.btnRollbackCache.style.opacity = '1';
              } else {
                this.btnRollbackCache.disabled = true;
                this.btnRollbackCache.textContent = `Rollback Unavailable (Wiped Cache)`;
                this.btnRollbackCache.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                this.btnRollbackCache.style.opacity = '0.5';
              }
            }
          }
        };
        
        navigator.serviceWorker.controller.postMessage(
          { action: 'queryVersion' },
          [messageChannel.port2]
        );
      } else {
        document.title = 'NoteCalci Web 🧮';
      }
    }
  }

  // Make CalculatorScreen globally visible in scope
  Object.assign(NoteCalci, {
    CalculatorScreen
  });
})();


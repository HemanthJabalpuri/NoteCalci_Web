/**
 * @fileoverview Component managing Note Sidebar catalog index visual lists rendering and CRUD event triggers.
 *
 * Multi-note workbook layouts, workspace sidebar list catalog, and renamer title input bar
 * are inspired by and modeled after Steve Ridout's notepad-calculator (https://github.com/SteveRidout/notepad-calculator).
 */

(function() {
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});

  /**
   * NotesSidebar class handles notes catalog navigation catalogs drawer interfaces.
   */
  class NotesSidebar {
    /**
     * @param {HTMLElement} notesListContainer Parent DOM element where list items are rendered
     * @param {HTMLElement} btnNewNote Trigger button to spawn a new note
     * @param {HTMLElement} btnDeleteNote Trigger button to delete active note
     * @param {Function} onNoteSelect Callback when a note catalog item is clicked
     * @param {Function} onNoteDelete Callback when delete note trigger executes
     * @param {Function} onNoteCreate Callback when new note trigger executes
     */
    constructor(notesListContainer, btnNewNote, btnDeleteNote, onNoteSelect, onNoteDelete, onNoteCreate) {
      this.notesListContainer = notesListContainer;
      this.btnNewNote = btnNewNote;
      this.btnDeleteNote = btnDeleteNote;

      this.onNoteSelect = onNoteSelect;
      this.onNoteDelete = onNoteDelete;
      this.onNoteCreate = onNoteCreate;

      this.registerEventListeners();
    }

    /**
     * Binds click actions.
     */
    registerEventListeners() {
      this.btnNewNote.addEventListener('click', () => {
        this.onNoteCreate();
      });

      this.btnDeleteNote.addEventListener('click', () => {
        this.onNoteDelete();
      });
    }

    /**
     * Renders notes lists catalog collection to DOM indices.
     * @param {object[]} notes List of NoteItem objects
     * @param {string|null} activeId Target active selected note index ID
     */
    render(notes, activeId) {
      this.notesListContainer.innerHTML = '';
      notes.forEach((note) => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-list-item' + (note.id === activeId ? ' active' : '');
        noteDiv.textContent = note.name;
        
        // On click, select and active select note
        noteDiv.addEventListener('click', () => {
          this.onNoteSelect(note.id);
        });

        this.notesListContainer.appendChild(noteDiv);
      });
    }
  }

  // Bind to NoteCalci namespace
  Object.assign(NoteCalci, {
    NotesSidebar
  });
})();

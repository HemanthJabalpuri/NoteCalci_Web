/**
 * @fileoverview Model and LocalStorage workspace persistence controller for managing multi-sheet workbook documents off-grid.
 *
 * LocalStorage note documents persistence models, CRUD schemas, and auto-saving flows 
 * are inspired by and modeled after Steve Ridout's notepad-calculator (https://github.com/SteveRidout/notepad-calculator).
 */

(function() {
  const NoteCalci = (window.NoteCalci = window.NoteCalci || {});

  class NoteItem {
    constructor(id, name, content) {
      this.id = id || 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      this.name = name || 'Untitled Note';
      this.content = content || '';
    }
  }

  class NotesManager {
    constructor() {
      this.notes = [];
      this.activeNoteId = null;
      this.loadAll();
    }

    /**
     * Loads all saved notes from LocalStorage with dynamic tutoring seeding fallbacks.
     */
    loadAll() {
      try {
        const rawNotes = localStorage.getItem('notecalci_workspace');
        const rawActiveId = localStorage.getItem('notecalci_active_note_id');

        if (rawNotes) {
          this.notes = JSON.parse(rawNotes);
          this.activeNoteId = rawActiveId || (this.notes.length > 0 ? this.notes[0].id : null);
        } else {
          this.seedTutorialNotes();
        }
      } catch (e) {
        console.error('NotesManager load error: localStorage access failed, utilizing standard memory.', e);
        this.seedTutorialNotes();
      }
    }

    /**
     * Commit dynamic workspace changes to LocalStorage.
     */
    saveAll() {
      try {
        localStorage.setItem('notecalci_workspace', JSON.stringify(this.notes));
        if (this.activeNoteId) {
          localStorage.setItem('notecalci_active_note_id', this.activeNoteId);
        } else {
          localStorage.removeItem('notecalci_active_note_id');
        }
      } catch (e) {
        console.error('NotesManager save error: localStorage commit failed.', e);
      }
    }

    /**
     * Spawns a fresh, new blank worksheet note.
     * @returns {NoteItem}
     */
    createNote(name = 'Untitled Note', content = '# New Calculation Sheet\n\n') {
      const note = new NoteItem(null, name, content);
      this.notes.push(note);
      this.activeNoteId = note.id;
      this.saveAll();
      return note;
    }

    /**
     * Retrieves note by specific ID index.
     * @param {string} id
     * @returns {NoteItem|null}
     */
    getNote(id) {
      return this.notes.find(n => n.id === id) || null;
    }

    /**
     * Active note selection.
     * @param {string} id
     */
    setActiveNote(id) {
      if (this.notes.some(n => n.id === id)) {
        this.activeNoteId = id;
        this.saveAll();
      }
    }

    /**
     * Performs live updates to content properties.
     * @param {string} id
     * @param {string} content
     */
    updateNoteContent(id, content) {
      const note = this.getNote(id);
      if (note) {
        note.content = content;
        this.saveAll();
      }
    }

    /**
     * Dynamically renames worksheet names.
     * @param {string} id
     * @param {string} name
     */
    renameNote(id, name) {
      const note = this.getNote(id);
      if (note) {
        note.name = name.trim() || 'Untitled Note';
        this.saveAll();
      }
    }

    /**
     * Deletes dynamic note worksheets and safely switches active focus.
     * @param {string} id
     */
    deleteNote(id) {
      const initialIndex = this.notes.findIndex(n => n.id === id);
      if (initialIndex === -1) return;

      this.notes.splice(initialIndex, 1);
      
      if (this.activeNoteId === id) {
        if (this.notes.length > 0) {
          const nextIndex = Math.max(0, initialIndex - 1);
          this.activeNoteId = this.notes[nextIndex].id;
        } else {
          this.activeNoteId = null;
        }
      }
      
      this.saveAll();
      if (this.notes.length === 0) {
        this.createNote();
      }
    }

    /**
     * Triggers full factory resets and loads clean seed worksheet guides.
     */
    resetWorkspace() {
      this.seedTutorialNotes();
    }

    /**
     * Seed the default guides worksheets to walk programmers through NoteCalci capabilities.
     */
    seedTutorialNotes() {
      this.notes = [
        new NoteItem('tutorial_math', '1. Mathematics Tutorial 🚀', 
          `# NoteCalci Web Calculator - Equations 🚀\n` +
          `# Define variables, perform BODMAS math & use aggregate block summaries!\n` +
          `\n` +
          `# 1. Basic Variable Assignments\n` +
          `price = 1500 # standard base cost\n` +
          `tax = 12% # percentage definitions\n` +
          `tax_amount = tax * price # evaluates percentage amount\n` +
          `\n` +
          `# 2. Mathematical Equations & Sums\n` +
          `total_bill = price + tax_amount\n` +
          `\n` +
          `# 3. Compound Variable increments\n` +
          `bills_count = 0\n` +
          `bills_count++\n` +
          `\n` +
          `# 4. Dynamic Block Aggregate Summaries\n` +
          `total # sums all rows in this current segment\n` +
          `avg # resolves immediate block average\n`
        ),
        new NoteItem('tutorial_lists', '2. Lists & Array Math 🛒',
          `# NoteCalci list calculations Guide 🛒\n` +
          `# Expose preceding calculation blocks as array list values using above_block!\n` +
          `\n` +
          `This example demonstrates the use of lists. Let's create a list of expenses:\n` +
          `  1500 # rent\n` +
          `  350 # utility bills\n` +
          `  210 # council tax\n` +
          `  400 # groceries\n` +
          `  300 # meals out\n` +
          `  600 # travel and other spending\n` +
          `\n` +
          `You can refer to the previous list of consecutive numbers using a special variable called above_block:\n` +
          `  expenses = above_block\n` +
          `\n` +
          `Now we call pluggable list functions to summarize our list:\n` +
          `  sum(expenses) # total calculated expenses\n` +
          `  avg(expenses) # average expense value\n` +
          `  length(expenses) # number of expense rows\n` +
          `  max(expenses)\n`
        ),
        new NoteItem('tutorial_carryon', '3. Operator Carry-On ⚡',
          `# Multi-line Operator Carry-On & ans ⚡\n` +
          `# Start a line with a math operator (+, -, *, /) to carry on calculation from preceding row!\n` +
          `\n` +
          `How many weeks in a year?\n` +
          `  52\n` +
          `\n` +
          `We want to divide it by 12 months:\n` +
          `  / 12 # dynamic carry-on\n` +
          `\n` +
          `Now multiply by 5 weekdays:\n` +
          `  * 5 # leap over prose sentences seamlessly!\n` +
          `\n` +
          `Refer to previous computed answer using the ans keyword:\n` +
          `  ans * 10\n`
        )
      ];
      this.activeNoteId = this.notes[0].id;
      this.saveAll();
    }
  }

  // Bind to global window context
  Object.assign(NoteCalci, {
    NoteItem,
    NotesManager
  });
})();


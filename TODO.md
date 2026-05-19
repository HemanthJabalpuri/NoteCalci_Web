# NoteCalci Web - Future Feature Roadmap & TODO List 🚀

This file documents our next-stage engineering roadmap to achieve full compatibility with premium desktop and browser notepad calculators (like Parsify Desktop, Soulver, and Numi).

---

## Parsify Compatibility Milestones Checklist

- [ ] **Milestone 1: Dimension-Safe Units & Custom Unit Conversions**
  *   *Concept:* Port NerdCalci's unit compiler (Lengths, Mass, Volume, Speeds, Time) and add custom unit multiplier registration interfaces!
  *   *Standard Conversions:* `10m + 50cm`, `30 lb to kg`, `60 mph to km/h`, `25C to fahrenheit`.
  *   *Custom Unit Declarations:* Allow users to dynamically declare scaling multipliers inline or globally, such as:
      *   `1 bottle = 750ml`, then calculate: `15 bottles to litres` (evaluates seamlessly to `11.25`).
      *   `1 box = 24 pack`, then calculate: `10 boxes to pack` (evaluates to `240`).
  *   *Security:* Parser should enforce dimension checks, throwing errors on mismatch units operations (e.g., `10m + 5kg` -> `Err`).

- [ ] **Milestone 2: Dynamic Currency Exchange Engine**
  *   *Concept:* Add currency parsing tokens using an offline-first JSON exchange rates lookup plugin.
  *   *Syntax examples:* `100 USD to EUR`, `total in CAD`.
  *   *Extensibility:* Allow registering custom developer exchange rates in the settings area.

- [ ] **Milestone 3: Date & Calendar Intervals Algebra**
  *   *Concept:* Build parsing nodes supporting standard date and calendar additions/subtractions.
  *   *Syntax examples:* `today + 3 weeks`, `June 15 to December 25 in months`, `10:00 PM + 8 hours`.

- [ ] **Milestone 4: Time Zone Swappings**
  *   *Concept:* Support global timezone offsets calculations natively.
  *   *Syntax examples:* `9:00 AM Paris to Tokyo`, `12:00 PM EST in CET`.

- [ ] **Milestone 5: Workbook Import / Export Utility**
  *   *Concept:* Allow downloading notes locally or uploading backup files.
  *   *UI:* Add `[ Export Note ]` and `[ Import Note ]` buttons on the About workspace page.
  *   *Formats:* Plain `.md` (formatted script sheets) or `.json` (complete database backup catalogs).

- [ ] **Milestone 6: Sleek Theme Customizer UI**
  *   *Concept:* Style custom lighter/darker themes (Dracula, Solarized Light, Sepia, Cyberpunk).
  *   *UI:* A clean picker block in the settings Danger Zone to toggle theme CSS classes instantly.

---

## Architectural Integration Guidelines

1.  **Maintain Upstream Portability:**
    Always double-check that new parsing tokens do not break compile-time parity with the Kotlin NerdCalci compiler core.
2.  **Zero-Dependency Constraint:**
    Keep the codebase lightweight and instant-loading: implement mathematical unit parsing natively inside our core custom lexer and compiler step, rather than pulling in bloated external node packages.
3.  **Dynamic Registrations:**
    Leverage our newly created `NoteCalci.registerConstant` and `NoteCalci.registerFunction` registries to support loading modules and custom units on the fly!

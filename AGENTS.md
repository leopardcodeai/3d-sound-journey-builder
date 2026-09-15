# Agent notes

## Branding

Built and maintained by **LeopardCode.AI** (leopardcode.ai,
github.com/leopardcodeai). Contact: contact@leopardcode.ai.

## House rules for this repository

- **Code is English.** Identifiers, comments, docstrings, file names, CSS
  classes and i18n keys. German stays where it is data: display strings in
  `src/i18n.js`, and commit messages.
- **No emoji in generated surfaces.** The interface uses the line icon set in
  `src/ui/Icons.js`. Status is a coloured dot or a pill, never a traffic light
  emoji. Chat messages and a favicon are the exceptions.
- **One registry for sounds.** Anything that adds, renames or recolours a sound
  goes through `src/data/SoundLibrary.js`. No parallel lists.
- **Honest labels.** A frequency tool ships with an `evidence` grade backed by
  the review in `docs/research`. Do not upgrade a grade without a citation.
- **Tests travel with behaviour.** New behaviour arrives with a test in the
  matching `*.test.js`. Run `npm test` before committing.
- **Check a script before handing it over.** Anything the owner is meant to run
  has been run here first, or stated as untested.

## Layout

The design notes for the current structure are in
`docs/superpowers/specs/2026-09-15-v2-rework-design.md`. The signal path and
coordinate conventions are in the README.

## Before a release

Run an external second-opinion review (`~/Coding/company/tools/review_agent/bin/lcr`)
and record the findings in `REVIEW_BEFUNDE_<date>.md`. Verify each finding
against the code before acting on it.

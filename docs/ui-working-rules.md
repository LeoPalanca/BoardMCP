# Board UI working rules

Verified observations from local Business Case and Academy Northwind exploration
on 2026-10-01. These are implementation notes, not new callable MCP tools.
The published inventory tools remain read-only.

## Select the intended page and scope

- When the user asks to inspect the page they opened, read that page before
  calling an inventory operation that navigates away. The current tools do not
  expose a general active-page inspection operation.
- Time Range / Custom Entities is a different page from ordinary Entities.
  Custom time properties, members and relationships require their own scope.
- Select browser contexts by the intended allowlisted origin and model route.
  `FirefoxClient.boardContext()` currently supports localhost only, and its
  `evaluate()` enforces that origin. Supporting authenticated training sites
  requires a deliberate, configurable origin-aware implementation; do not
  remove the origin check globally.
- Obtain context identifiers in the current browser session. Do not assume an
  identifier remains valid across session endings/reconnections. Wait for page
  content after navigation, not just the document load event.
- Sanitize context URLs to origin and pathname before displaying them. Child
  iframe URLs can contain access tokens in query strings/fragments. Never dump
  a raw context tree or read login fields, browser storage or cookies.

## Read and interact reliably

- Wait for the expected heading, loaded target rows and enabled controls.
  A grid can first report no rows while it is loading; a content-count label and
  current filters/pagination must accompany a completeness claim.
- Row name clicks and checkbox selection are different actions. Data Readers
  use row-selection checkboxes to enable toolbar operations. Check the resulting
  `aria-selected`/`aria-checked` state and toolbar enablement.
- Use the actual row label as a drag source, not a neighboring Open/menu icon.
  A successful drag can show a confirmation dialog and save immediately.
- Inspect disabled-control explanations before retrying. Bimester Content
  initially disabled Paste/New Member with: "Define a relationship for this
  Entity to enable the creation of members".
- Select editor inputs by their row and field, not just maxlength or type.
  Add Members grids also have filter-row inputs. Insert creates an editable
  staging row; enter values there, commit the cell, then Add saves the members.
- Native pointer/keyboard actions proved useful where synthetic clicks did not
  update a DevExpress editor. Verify the state change rather than assuming a
  click succeeded. Enter/Tab can be required to commit an edited cell.
- Large reader dialogs can overflow a narrow viewport. Ensure both drag source
  and target are visible; a temporary `browsingContext.setViewport` override
  helped in this session. Clear the override afterwards.
- Read-only inspection may open an editor or switch Show Formulas to read saved
  ETL. Do not save, clear, run, or otherwise mutate a reference model while
  merely inspecting it.

## Calendar reader pattern and verification

- Northwind's seven-member Weekday entity is populated by the text reader
  REL-Day to Weekday, whose saved ETL output is `=WEEKDAY(C4,2)`. This is evidence
  for deriving generic time groups in ETL, not a built-in duration property.
- Local generic Bimester used six existing members B1-B6. Day's Extract Tree
  supplied existing calendar codes. Map Day to its file code; map Month and
  Bimester to the Month code. In this three-field layout, Bimester output D5 was
  `="B"&ROUNDUP(VALUE(RIGHT(C5,2))/2,0)`. Cell references depend on mapping order.
- Keep descriptions/inactive time fields/cubes out of a relationship-only
  reader when they are not needed. Generic period codes belong alongside Year
  above Month; they cannot each have a single parent Year.
- Reader-list File selection is separate from the reader's path/pattern.
  Run stayed disabled until the source file was selected and the cell committed.
- Verify saved results, not just an ETL preview: record valid/discarded counts,
  re-extract the time tree, check every mapping and date boundary, and run
  Custom Relationships Analyze. The local load passed 4,748 days / 156 months,
  zero discarded, zero incorrect mappings and zero Analyze issues.
- Extending a calendar requires refreshing its extract before rerunning this
  reader. Reusable Bimester members need not grow; the source file still must
  include the newly generated calendar members. No automatic refresh procedure
  was created in this session.

## Reusable code candidates

Add guarded helpers/tools for active-page inspection, origin-aware tab selection,
Time Range/Custom Entity inspection, reader configuration/ETL inspection, and
loaded-state waits. Generalize the proven parts of session scripts after review;
do not promote an unrestricted script runner or silently add mutations to
existing read-only tools. Model-specific configuration and execution results
belong in the linked user knowledge base, not hardcoded connector code.

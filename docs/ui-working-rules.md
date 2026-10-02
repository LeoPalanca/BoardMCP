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

## Ordinary entity creation (verified 2026-10-01)

- The New Entity form requires an assigned Group. The Group dropdown permits creating a group by typing its name in the search input and pressing Enter; typing alone does not select/save it. Existing groups can be selected from dropdown rows.
- After Create, wait for the saved entity Properties state and updated inventory. Closing a modal can leave a transient overlay; wait for the intended next form rather than assuming the next click took effect.
- Entity-list Item number is the current member count, not the maximum capacity. Verify Max item number in each saved Properties panel.
- Saving a nonzero capacity on an empty entity was verified. This does not establish that resizing populated entities or shortening widths is safe.
- Relationships tree nesting uses a different perspective from business rollup terminology: dragging the functional parent onto the child places that parent beneath the child root. MCP parent/child labels describe rendered tree levels; preserve this distinction in reports.

## Capsule and screen creation (verified 2026-10-01)

- The Capsules Create icon opens a menu with Capsule and Folder. Wait for Create new Capsule after selecting Capsule; the modal may appear after the menu closes.
- Check the capsule name, Default Data Model and aspect ratio before Create. Creation generates Home and opens Design mode; wait for its resource tree.
- Resources / Add Screen opens Create screen. Verify Linked Data Model, aspect ratio and optional Masks, then save with OK. Wait for the dialog to close and the new screen name to appear.
- Reopening a capsule can start in Play mode, which does not expose the designer resource list. F4 toggles Design mode in this session. Wait for the loaded Screens tree before interpreting an initially empty list.
- Verify persistence by reopening and reading saved screen names and model context. Screen existence does not establish that navigation objects, data layouts, formulas or selections have been configured.

## Screen design and navigation (verified 2026-10-01)

- Drag Label/Button objects from Screen Objects onto the canvas; wait for the new toolbox host before selecting/configuring it. New objects and their edits require the screen-level Save action.
- Select the correct property tab explicitly: button captions/actions are in Data, geometry/colors/fonts in Design. Wait for the intended controls; tree loading or previous-tab text can persist briefly after switching screens.
- Configure Go to Screen with an existing target and enable Same tab explicitly. The default was unchecked. Test outward and return actions in Play mode and verify capsule route and unchanged tab count.
- Avoid center-click selection of overlapping or oversized objects. Layers row captions alone did not select an object; the row checkbox did. Verify the selected toolbox host/name before editing, and clear previous selections.
- Verify saved numeric geometry and font family against the intended object. Native entry/selection can fail silently or apply to an overlapping object. Visible Angular form inputs accepted native value setters plus input/change/blur events when keyboard editing was unreliable; always inspect the resulting rendered style and saved state.
- Color preview text is not a reliable color editor. Open its color configurator and edit the actual color-picker input. Fonts use the Caption font editor. Choose the exact family row and verify the selected family rather than trusting a pointer click.
- Close transient property overlays by clicking outside them; Escape and property-tab clicks did not consistently reset their state. Reopening the saved screen recovered a stale font editor. Collapse other property sections when an editor trigger lies outside the viewport.
- Copy Object / Paste Object preserved button appearance and actions across screens in the same capsule. Keyboard copy/paste was inconsistent; verify each pasted object and its target. Duplication does not guarantee selection of the new object.
- Custom 1920x1080 exposes numerical width/height, but this session showed 16:9 again after saving/reopening identical dimensions. Verify logical dimensions independently of the dropdown label; committing an unchanged dimension can hide the custom inputs as the ratio is recognized.
- Save after edits have committed; reopen and inspect persistence, dimensions, background and typography. Restore temporary viewport overrides and leave the user's intended screen/mode open.

## Shared Masks, menu groups and capsule images (verified 2026-10-01)

- Resources/Add Mask creates a reusable screen shell. Mask Design/Masked Screens/Add Screen to this Mask is a multi-select dropdown: select each intended screen, close the overlay and Save. Verify inherited objects on every target. A Mask controls background and fit settings; corresponding individual screen controls become disabled. Edit the Mask background rather than attempting those disabled controls.
- Native Menu supports Screens target, Horizontal style, Root position and Same Tab. Resource screen folders become dropdown groups, with child screens as destinations. Create folders, drag existing screens into them, verify preserved screen routes, then test each menu child in Play mode. Folder moves can navigate to the moved screen; recheck current scope. A group click toggles its dropdown, so repeated clicks can close it.
- Menu Text has separate font editors for Root Groups, Subgroups and Items. Configure all three; a single Caption font edit is insufficient. Menu hover labels differ from Button Rollover color. Read current property labels instead of sharing an assumed selector across object types.
- Capsule Images are imported through Resources/Images/Create and the rendered uploadFile input; input.setFiles is supported by Firefox BiDi. Wait for the saved image list before choosing that asset in a Label Background configurator (Type Image, Capsule Image). Set fill/repeat/alignment explicitly and inspect the actual rendering. Centered Uniform to fill displays a heavily padded transparent wordmark in a wide label; this is rendering configuration, not source-image editing. The upload dialog advertised 500KB and jpg/png/gif in this session.
- A Label with Go to Screen/Home and Same tab can serve as the clickable logo. Verify it from each report; pasted appearance does not establish navigation correctness.
- Layers root may be collapsed. Expand Screen Objects before selecting row checkboxes. Scope to object rows with aria-level=2 and an actual selection checkbox, clear checked objects, and verify selected toolbox-host ID. Resource trees coexist in the DOM; captions/row indexes alone are ambiguous, especially for blank labels and inherited Mask objects.
- Send to back can hide a placeholder behind a solid sidebar. Verify stacking visually; move the placeholder in front without covering the header/logo/menu. Mask objects are inherited; edit them in the Mask rather than editing a duplicate on each screen.
- IMPORTANT: delete-bin-16 also appears in the screen-level Discard all changes button while edits are pending. Scope object Delete to the contextual object toolbar and verify its tooltip/scope. An unscoped first-icon selector can open a discard confirmation. Cancel that dialog and preserve authorized edits; do not mistake it for object deletion.
- Footer text alone does not establish a date binding or refresh process. Check footer visibility per screen and leave missing data blank. Test all menu destinations and logo returns, compare tab counts, inspect saved dimensions/fonts and restore temporary viewport overrides.

Evidence scope: authenticated local Board capsule designer and Play mode, 2026-10-01. These are verified UI workflows, not new mutation capabilities in the published read-only MCP. Task-local shell helpers remain outside its public tools; any integration should be separately scoped and reviewed.

### Independent Home and photo layout (verified 2026-10-01)

- To retain a shell on reports but remove it from Home, edit Mask/Masked Screens, open associatedScreens and deselect Home, then Save. A populated multi-select renders chips instead of an input; open the brd-dropdown itself, not an assumed input child. Verify the inherited object IDs disappear only from the deselected screen and that remaining reports retain them. The screen background becomes editable again after detachment; set it independently.
- Copying a Mask logo into an independent screen preserves the image and action. Paste may create an object without selecting it. Inspect host count/new ID and select via Layers before configuring; do not repeat Paste merely because geometry controls are absent. Remove any accidental duplicate through scoped contextual object Delete and verify the final count.
- On an unmasked screen or the Mask editor, the own toolbox-host order matched the selectable level-2 layer rows. A session helper checked equal counts, found the intended saved ID, selected its corresponding checkbox and verified the resulting target ID. Do not apply this mapping on a masked report where hosts include inherited objects but Layers exposes only own objects.
- For an ordinary photograph, centered Uniform/contain preserves the full composition. Use matching aspect ratio for the image label when desired, set no repeat and inspect saved background-size: contain. Uniform to fill/cover instead crops to the label; use that intentionally for padded logos rather than assuming it fits all images.
- Reopening the saved screen recomputes the fit ratio after mask/layout changes; review both the full logical canvas and the restored user viewport. Fit-to-width can put the footer below the fold on a shorter viewport even with the required 1920x1080 logical canvas.

## SQL / ODBC reader prerequisites (documentation and Windows inspection, 2026-10-02)

- Official references: https://help.board.com/v15/docs/data-sources and https://help.board.com/docs/create-a-data-reader-protocol . These semantics are documentation-derived, not a newly verified SQL reader UI flow.
- Inspect existing platform Data Sources before creating duplicates. On-premise ODBC requires a 64-bit System DSN on the Board host; cloud-to-local needs Data Pipeline/OPC. User-account SQL success is not proof of Board service-account access.
- Read DSN metadata with a strict allowlist (name, platform, driver, server, database). Do not dump DSN attributes, connection strings or credentials. Get-OdbcDsn can return no useful inventory inside the sandbox; report limits instead of claiming no DSNs exist.
- Newly created Data Sources may require refreshing/recreating the reader before selection. Verify Connect and Browse against the intended database; Browse shows only up to 500 source rows.
- Entity Add New Item creates missing members; Discard New Item rejects records for unknown codes. Description Replace updates existing labels; Read only fills empty labels. Validate dimensions before fact loads.
- Numeric Cube Add accumulates existing values. Replace Time Slice clears incoming periods across all other dimensions: a company-filtered/partial-period source must not be used as a full-period refresh without an explicitly bounded loading strategy. Verify totals and repeatability.
- Enable reject logging and confirm member capacities: overflow discards excess members. Preview success alone does not establish a complete load.

## SQL reader visual workflow (live local verification, 2026-10-02)

- Navigation: main Board logo menu -> System Administration -> Data sources. Existing ODBC source panel TEST was disabled; do not infer connection failure. Reader plug/schema and Browse successfully established access instead.
- New SQL reader requires Name, Group and SQL card. Group creation needs an actual Enter event while the search input is active; blur alone does not select it. Avoid embedding Unicode special keys literally in PowerShell-piped scripts (encoding can turn them into question marks); construct key values with String.fromCharCode or JS escapes. Correct group through Properties then SAVE and reopen to verify.
- Connection row and plug are distinct: NEXT can be enabled before source schema loads. Click the connection plug to establish access and wait for the right-hand table tree. Inspect details without dumping username/password/connection strings.
- Expand Finance and Tables. Same entity label occurs twice: distinguish code versus description using datareader-code-16 and datareader-desc-16 icons. Drag the name-label into the mapping grid, then drag SQL column tree labels into the corresponding RDB field cells.
- Mapping Mode cells required native pointer interaction to enter a DevExpress selectbox, then opening its dropdown and choosing Add new item / Replace; synthetic cell clicks alone did not reliably edit. Verify committed displayed modes, generated SQL and Manual script off before CREATE.
- Browse opens a separate SQL Browse dialog; close it before CREATE. CREATE selects the new reader automatically: only check the selection box if not already checked, or the next click deselects it. RUN opens a confirmation; validate only intended selected readers before YES.
- Verify saved result counts and independently read all entity members through MCP. Company example passed four valid / zero discarded and four exact code-description pairs. Log grid checkboxes showed temporary changes that did not persist on reload; enabling reject logs remains an unresolved cell-commit interaction. Never report it enabled from a transient checked state.
- ACME user requirement: no Manual script; use visual mapping, native Where/Join and ETL. Fill dedicated Description textboxes whenever available. Auto-generated SQL display is distinct from enabling manual editing. Keep this project constraint separate from general Board capabilities.

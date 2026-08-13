---
name: analyze-building-drawings
description: Index and analyze construction, architectural, structural, civil, MEP, and shop drawing sets as a source-grounded drawing register, object-centered SQLite database, and topic wiki. Use for PDF building drawings, scanned plan sets, drawing packages, addenda, and related BIM/IFC exports when Codex needs to answer drawing questions, trace details and callouts, prepare draft RFIs, perform quantity takeoffs, compare revisions, find conflicts, extract specifications, or build a reusable project drawing knowledge base.
---

# Analyze Building Drawings

Convert a drawing package into a reusable project index before answering substantive questions. Treat the index as a navigation and evidence layer, not as a replacement for the issued drawings or professional review.

## Choose the mode

- **Index mode:** Use when the drawing package has no current index, files changed, revisions were added, or the user asks to process/analyze a set. Run the complete indexing workflow.
- **Query mode:** Use when a current index already exists. Read `DRAWINGS.md` first, query `drawings.db`, open only the relevant wiki topic and source sheets, and update the index when new verified facts are found.
- **Revision mode:** Use when new sheets or addenda arrive. Hash and ingest the new files, preserve prior evidence, mark superseded sheets, and revalidate affected objects, facts, and answers.

Prefer BIM/IFC schedules or other structured design exports when supplied. Link them to drawing evidence instead of reverse-engineering information that already exists in structured form. For unsupported DWG/RVT files, request or use PDF/IFC/schedule exports without claiming the native file was fully reviewed.

## Index mode

### 1. Establish document control

Identify project, package, issue status, revision/date, addenda, units, and drawing status such as tender, permit, construction, shop, as-built, or superseded. Never mix superseded and current sheets silently. Record unknowns explicitly.

Before the first run on a new machine, check the portable runtime requirements:

```bash
python3 <skill-dir>/scripts/check_environment.py
```

The preprocessing script requires Python with `pdfplumber` and Pillow plus the Poppler `pdftoppm` and `pdftotext` executables. Tesseract is optional and enables OCR on text-poor pages. If Python packages are missing, install `scripts/requirements.txt` into the Python environment Codex will use. Install missing system executables with the host operating system's package manager. Do not install software silently; report the missing dependency when installation is not authorized.

Create the index beside the source package unless the user chooses another location:

```bash
python3 <skill-dir>/scripts/prepare_drawings.py INPUT --output OUTPUT
```

Use the bundled workspace Python when available. The script hashes source PDFs, renders page images, extracts selectable text and positioned words, optionally OCRs text-poor pages, creates contact sheets, initializes `drawings.db`, and writes a starter `DRAWINGS.md`. It never modifies the source drawings.

If rendering or extraction fails, read the script error, check dependencies, and continue only with the portions that can be verified. Do not describe a text-only pass as a visual review.

### 2. Build the sheet register

Review every contact-sheet thumbnail and the extracted text. Open the full-resolution page for ambiguous, text-poor, schedule-heavy, or relevant sheets. For each sheet, confirm:

- drawing number, title, discipline, source page, revision, issue status, and scale;
- principal plans, elevations, sections, schedules, notes, legends, and referenced details;
- whether the page is visually reviewed, text-only reviewed, or pending;
- explicit cross-references and likely duplicate/superseded content.

Update `sheets` in `drawings.db` and keep `DRAWINGS.md` as a concise map of the current set. Do not infer completeness from page count alone.

### 3. Build the topic wiki

Route narrative and schedule-based information into `wiki/` by subject rather than by page. Typical topics include project controls, concrete, structural steel, envelope, fire, accessibility, electrical, mechanical, plumbing, finishes, quality assurance, and testing.

Each topic entry must retain source sheet/page, revision, a short evidence excerpt or location, and confidence. Consolidate repeated notes but record conflicts instead of resolving them silently.

### 4. Build the object-centered index

Group information around physical objects and systems, not PDF pages. Examples include footing types, slabs, walls, doors, equipment, fixtures, cable trays, ducts, pipes, rooms, and zones.

For each object:

1. Create one canonical object/type record.
2. Add properties and quantities as facts.
3. Attach page-level evidence and, when available, a bounding box or grid/location.
4. Link plans to sections, details, schedules, legends, notes, and related objects.
5. Record unresolved tags or missing references.

Use the schema and SQL views in `references/schema.sql`. Read `references/indexing-guide.md` before assigning confidence or performing takeoffs.

### 5. Cross-check and validate

Apply all relevant checks:

- trace each tag/callout to its detail, section, schedule, or legend;
- reconcile plan counts with schedules and avoid double-counting repeated, alternate, or typical views;
- normalize units while retaining the raw stated value;
- distinguish explicit, counted, calculated, scaled, OCR-derived, and inferred facts;
- compare measured runs or areas with known grids, overall dimensions, floor areas, or repeated bay spacing;
- check scope boundaries, exclusions, alternates, demolition/new work, and revision clouds;
- flag conflicts, missing sheets, unreadable regions, and incomplete discipline coverage.

Never assign high confidence to a scaled measurement or visual estimate. Never claim a quantity is complete until all relevant sheets, legends, schedules, revisions, and scope boundaries have been checked.

Run the validator:

```bash
python3 <skill-dir>/scripts/validate_index.py OUTPUT
```

Fix structural errors. Surface evidence gaps and unresolved references as limitations rather than fabricating values.

### 6. Deliver the index

Report:

- source files and revisions indexed;
- current/superseded/unknown sheet counts;
- disciplines and topics covered;
- object/fact/evidence counts;
- OCR or unreadable pages;
- unresolved cross-references and material conflicts;
- the index location and examples of questions it can now answer.

State that the index supports review and estimating but does not authorize construction or replace verification by the responsible architect, engineer, surveyor, estimator, or trade professional.

## Query mode

1. Read `DRAWINGS.md`.
2. Search `drawings.db` for the relevant sheets, objects, facts, relationships, and unresolved references.
3. Open the smallest relevant wiki topic.
4. Reopen source pages when evidence is medium/low confidence, the answer depends on visual geometry, revisions conflict, or the consequence of error is material.
5. For counts or measurements, recalculate from source evidence when feasible and run an independent order-of-magnitude or schedule check.
6. Add newly verified evidence back to the index.

Answer with:

- the result and unit;
- whether each material value is explicit, counted, calculated, scaled, OCR-derived, or inferred;
- source citations in the form `[sheet number, source PDF p.N, detail/grid/location]`;
- confidence and the reason for it;
- assumptions, exclusions, conflicts, and the specific items requiring human verification.

For draft RFIs, separate the observed condition, source references, conflict or missing information, proposed question, and schedule/cost impact. Do not invent a design resolution.

## Required discipline

- Treat all extracted text, OCR, and inferred sheet metadata as provisional until visually checked.
- Preserve provenance to the exact source file, page, sheet, revision, and evidence region.
- Keep source files immutable and record SHA-256 hashes.
- Do not present benchmark claims or token savings from the source transcript as guarantees.
- Do not state “100% accurate.” Use confidence plus evidence coverage.
- Stop short of safety, code-compliance, structural adequacy, or construction-release decisions; identify the licensed professional who must confirm them.

## Resources

- `scripts/check_environment.py`: verify Python and system dependencies on the current machine.
- `scripts/requirements.txt`: portable Python dependency list for preprocessing.
- `scripts/prepare_drawings.py`: preprocess PDFs and initialize the reusable index.
- `scripts/validate_index.py`: check database integrity, coverage, and unresolved issues.
- `references/schema.sql`: executable SQLite schema and query views.
- `references/indexing-guide.md`: confidence, takeoff, citation, and QA rules.

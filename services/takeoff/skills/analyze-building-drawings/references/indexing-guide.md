# Drawing Indexing Guide

## Contents

- Confidence policy
- Evidence and citations
- Sheet and revision control
- Object and fact modeling
- Quantity takeoff rules
- Cross-reference and conflict checks
- Completion criteria

## Confidence policy

Assign confidence to the fact, not to the entire sheet.

| Confidence | Use when | Required treatment |
|---|---|---|
| High | Explicit dimension, note, schedule value, or BIM property is visually verified on a current source; or an exact tag count has complete, deduplicated coverage | Cite the exact sheet/page/location and state the method |
| Medium | OCR text is visually plausible; a calculation uses verified inputs; a vector measurement is checked; a relationship is strongly supported but not explicit | Reopen the relevant source page and add a second check before consequential use |
| Low | Visual estimate, ambiguous symbol, unknown scale/revision, incomplete coverage, unresolved reference, or inference | Do not use as a definitive quantity or instruction; explain what must be verified |

Scaled and image-derived measurements remain medium at best. A high-confidence source value can produce a medium-confidence calculation if scope or geometry requires interpretation.

## Evidence and citations

Every material fact needs one evidence record. Use a citation label readable without the database, for example:

`S-201, source PDF p.14, detail 3, grid B/4`

Store a short excerpt for notes and schedules. For geometry, describe the region and store a bounding box when available. Set `visual_checked=1` only after reviewing the rendered page, not merely extracted text.

When answering, cite the drawing identifier and the source PDF page because sheet numbering can be absent, duplicated, or mis-extracted.

## Sheet and revision control

1. Inventory all files and SHA-256 hashes.
2. Identify the issue date/status and revision for every sheet where possible.
3. Mark superseded sheets with `is_current=0`; preserve their evidence for revision history.
4. Treat undated or unknown-revision sheets as unknown, not current by assumption.
5. Record addenda and revision clouds that change indexed objects.
6. If two current-looking sources conflict, create a `conflicts` record and ask for clarification or draft an RFI.

## Object and fact modeling

Use a stable `canonical_key`, such as:

- `structural.footing.F6`
- `architectural.door.D103`
- `electrical.cable-tray.level-01.zone-a`
- `mechanical.ahu.AHU-2`

One object can have multiple facts and evidence sources. Model type definitions separately from placed instances when that distinction affects quantities. Use `relationships` for “detailed-on,” “scheduled-on,” “serves,” “connects-to,” “located-in,” “supported-by,” and similar links.

Use topic-only facts when information is project-wide rather than object-specific. Retain raw values exactly as shown and place normalized numbers/units in the numeric fields.

For the CuadraBot API takeoff profile, use the stricter machine-audit convention:

- each `legend.<legend_entry_id>` object has a `legend_code` fact whose raw value is the exact legend code, method is `explicit`, and evidence kind is `legend`;
- each `asset.<unit_id>` object has a `quantity` fact and an `instance-of` relationship to its legend object using the same evidence record;
- each of those evidence rows is visually checked and records the exact source page and sheet;
- `bbox_json` is a JSON object with numeric `x0`, `y0`, `x1`, and `y1` in `pdf_display_points_top_left` coordinates. Use the exact legend or asset bbox, a zero-area bbox for an x/y placement, or the min/max bounds of the full linear path.

## Quantity takeoff rules

Before calculating:

1. Define scope, unit, included/excluded areas, phase, alternate, and revision.
2. Identify all sheets, legends, schedules, typical details, and notes that can affect the quantity.
3. Separate new, existing, demolition, allowance, spare, and alternate items.
4. Count unique installed objects, not every graphical occurrence or reference view.
5. Record waste, laps, bends, fittings, openings, deductions, and rounding as explicit assumptions.

Method rules:

- **Schedule quantity:** Verify the schedule is current and covers the requested scope.
- **Tag count:** Prefer extracted/vector text plus a visual completeness check. Deduplicate tags appearing in details, legends, key plans, and repeated views.
- **Calculated quantity:** Store each input as a sourced fact, show the formula, and preserve units.
- **Scaled length/area:** Confirm the printed/digital scale and sheet size, calibrate against a stated dimension, then sanity-check against grids or overall dimensions. Mark medium at best.
- **Raster image:** Do not rely on pixel scale without calibration. Mark ambiguous boundaries low.

Report exact quantities only to the precision supported by the evidence.

## Cross-reference and conflict checks

- Trace detail, section, elevation, schedule, and keynote references.
- Confirm symbols against the relevant legend; similar line styles or tags may have different meanings.
- Compare plan geometry with sections/elevations and schedule attributes.
- Check overall dimensions against component sums and grid spacing.
- Check MEP routes across continuation marks and floor transitions.
- Check architectural/structural/MEP coordination where scope overlaps.
- Create unresolved-reference records for missing, unreadable, or circular callouts.

## Completion criteria

An index is complete enough to query only when:

- every source page is registered;
- every sheet has a review status;
- current versus superseded status is recorded or explicitly unknown;
- relevant text-poor pages have been visually reviewed;
- requested disciplines and scope are covered;
- all material facts have evidence and confidence;
- open conflicts and unresolved references are reported;
- the validation script completes without structural errors.

“Indexed” does not mean approved for construction, code compliant, or professionally certified.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_files (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    page_count INTEGER NOT NULL CHECK (page_count >= 0),
    issue_date TEXT,
    revision TEXT,
    issue_status TEXT,
    is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sheets (
    id INTEGER PRIMARY KEY,
    source_file_id INTEGER NOT NULL REFERENCES source_files(id),
    source_page INTEGER NOT NULL CHECK (source_page >= 1),
    sheet_number TEXT,
    title TEXT,
    discipline TEXT,
    revision TEXT,
    issue_status TEXT,
    scale_text TEXT,
    image_path TEXT,
    text_path TEXT,
    words_path TEXT,
    extraction_mode TEXT NOT NULL DEFAULT 'unknown'
        CHECK (extraction_mode IN ('vector-text', 'ocr', 'mixed', 'image-only', 'unknown')),
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'text-reviewed', 'visually-reviewed')),
    is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
    notes TEXT,
    UNIQUE (source_file_id, source_page)
);

CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY,
    sheet_id INTEGER NOT NULL REFERENCES sheets(id),
    evidence_kind TEXT NOT NULL
        CHECK (evidence_kind IN ('dimension', 'note', 'schedule', 'legend', 'tag', 'geometry', 'ocr', 'bim', 'other')),
    citation_label TEXT NOT NULL,
    excerpt TEXT,
    bbox_json TEXT,
    visual_checked INTEGER NOT NULL DEFAULT 0 CHECK (visual_checked IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS objects (
    id INTEGER PRIMARY KEY,
    canonical_key TEXT NOT NULL UNIQUE,
    object_type TEXT NOT NULL,
    trade TEXT,
    name TEXT,
    description TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'existing', 'demolish', 'alternate', 'superseded', 'unknown'))
);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY,
    object_id INTEGER REFERENCES objects(id),
    topic TEXT,
    property TEXT NOT NULL,
    raw_value TEXT NOT NULL,
    numeric_value REAL,
    normalized_unit TEXT,
    method TEXT NOT NULL
        CHECK (method IN ('explicit', 'schedule', 'counted', 'calculated', 'vector-measured', 'scaled', 'ocr-derived', 'bim', 'inferred')),
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    evidence_id INTEGER NOT NULL REFERENCES evidence(id),
    assumptions TEXT,
    UNIQUE (object_id, property, raw_value, evidence_id)
);

CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY,
    source_object_id INTEGER REFERENCES objects(id),
    relationship_type TEXT NOT NULL,
    target_object_id INTEGER REFERENCES objects(id),
    target_label TEXT,
    evidence_id INTEGER REFERENCES evidence(id),
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    notes TEXT,
    CHECK (target_object_id IS NOT NULL OR target_label IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS wiki_topics (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT,
    markdown_path TEXT
);

CREATE TABLE IF NOT EXISTS wiki_entries (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES wiki_topics(id),
    heading TEXT NOT NULL,
    content TEXT NOT NULL,
    evidence_id INTEGER NOT NULL REFERENCES evidence(id),
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low'))
);

CREATE TABLE IF NOT EXISTS unresolved_references (
    id INTEGER PRIMARY KEY,
    sheet_id INTEGER NOT NULL REFERENCES sheets(id),
    reference_text TEXT NOT NULL,
    expected_target TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'not-applicable')),
    resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY,
    subject TEXT NOT NULL,
    evidence_a_id INTEGER NOT NULL REFERENCES evidence(id),
    evidence_b_id INTEGER NOT NULL REFERENCES evidence(id),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolution TEXT
);

CREATE INDEX IF NOT EXISTS idx_sheets_number ON sheets(sheet_number);
CREATE INDEX IF NOT EXISTS idx_sheets_discipline ON sheets(discipline);
CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(object_type);
CREATE INDEX IF NOT EXISTS idx_objects_trade ON objects(trade);
CREATE INDEX IF NOT EXISTS idx_facts_object ON facts(object_id);
CREATE INDEX IF NOT EXISTS idx_facts_topic_property ON facts(topic, property);
CREATE INDEX IF NOT EXISTS idx_evidence_sheet ON evidence(sheet_id);
CREATE INDEX IF NOT EXISTS idx_unresolved_status ON unresolved_references(status);

CREATE VIEW IF NOT EXISTS v_fact_sources AS
SELECT
    f.id AS fact_id,
    o.canonical_key,
    o.object_type,
    o.name AS object_name,
    f.topic,
    f.property,
    f.raw_value,
    f.numeric_value,
    f.normalized_unit,
    f.method,
    f.confidence,
    sf.filename,
    s.source_page,
    s.sheet_number,
    s.revision,
    e.citation_label,
    e.visual_checked,
    f.assumptions
FROM facts f
LEFT JOIN objects o ON o.id = f.object_id
JOIN evidence e ON e.id = f.evidence_id
JOIN sheets s ON s.id = e.sheet_id
JOIN source_files sf ON sf.id = s.source_file_id;

CREATE VIEW IF NOT EXISTS v_sheet_coverage AS
SELECT
    sf.filename,
    s.source_page,
    s.sheet_number,
    s.title,
    s.discipline,
    s.revision,
    s.extraction_mode,
    s.review_status,
    s.is_current,
    COUNT(DISTINCT e.id) AS evidence_count,
    COUNT(DISTINCT f.id) AS fact_count
FROM sheets s
JOIN source_files sf ON sf.id = s.source_file_id
LEFT JOIN evidence e ON e.sheet_id = s.id
LEFT JOIN facts f ON f.evidence_id = e.id
GROUP BY s.id;

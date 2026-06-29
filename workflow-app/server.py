import base64
import datetime
import hashlib
import http.server
import json
import os
import re
import shutil
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
SCHEMA_PATH = APP_DIR / "database" / "schema.sql"
STATIC_DIR = APP_DIR / "static"

HANDOFF_PHASES = {"feedback": "UI/UX Feedback", "bug": "Debugging"}

HANDOFF_STATUSES = [
    "pending",
    "accepted",
    "in_progress",
    "completed",
    "rejected",
    "needs_clarification",
]

HANDOFF_STATUS_ORDER = {status: index for index, status in enumerate(HANDOFF_STATUSES)}

FEEDBACK_CATEGORIES = [
    "UI",
    "UX",
    "Responsiveness",
    "Accessibility",
    "Navigation",
    "Performance",
    "Content",
]

PRIORITIES = ["Critical", "High", "Medium", "Low"]

REFERENCE_PREFIX = {"feedback": "FB", "bug": "BUG"}

ATTACHMENT_EXTENSIONS = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

REFERENCE_ATTACHMENT_EXTENSIONS = {
    **ATTACHMENT_EXTENSIONS,
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
}

TEXT_EXTRACT_EXTENSIONS = {".txt", ".md", ".csv"}
EXTRACTABLE_OFFICE_EXTENSIONS = {".docx", ".xlsx", ".pdf"}
LEGACY_BINARY_EXTENSIONS = {".doc", ".xls"}
EXTRACT_TEXT_LIMIT = 8000
DOCX_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XLSX_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

STRUCTURE_REQUIREMENTS_KEYS = [
    "project_objective",
    "scope",
    "functional_requirements",
    "non_functional_requirements",
    "user_roles",
    "user_workflows",
    "business_rules",
    "ui_ux_expectations",
    "technical_considerations",
    "constraints",
    "assumptions",
    "open_questions",
    "acceptance_criteria",
]

BASELINE_AI_FIELD_MAP = [
    ("project_objective", "Project objective"),
    ("scope", "Scope"),
    ("functional_requirements", "Functional requirements"),
    ("non_functional_requirements", "Non-functional requirements"),
    ("user_roles", "User roles"),
    ("user_workflows", "User workflows"),
    ("business_rules", "Business rules"),
    ("ui_ux_expectations", "UI/UX expectations"),
    ("technical_considerations", "Technical considerations"),
    ("constraints", "Constraints"),
    ("assumptions", "Assumptions"),
    ("open_questions", "Open questions"),
    ("acceptance_criteria", "Acceptance criteria"),
]

STATUSES = [
    "Draft",
    "For Review",
    "Approved",
    "In Progress",
    "Needs Revision",
    "Rejected",
    "Completed",
    "Deployed",
    "Under Maintenance",
    "Superseded",
]

RECORD_TYPES = {
    "baseline": "Project Baseline",
    "planning": "Planning",
    "execution": "Execution",
    "review": "Review and Evaluation",
    "deployment": "Deployment",
    "maintenance": "Maintenance and Monitoring",
}

FIELD_DEFINITIONS = {
    "baseline": [
        "Project objective",
        "Scope",
        "Functional requirements",
        "Non-functional requirements",
        "User roles",
        "User workflows",
        "Business rules",
        "UI/UX expectations",
        "Technical considerations",
        "Constraints",
        "Assumptions",
        "Open questions",
        "Acceptance criteria",
        "Reference files",
        "Additional instructions",
    ],
    "planning": [
        "Tasks and subtasks",
        "Priorities",
        "Dependencies",
        "Risks",
        "Target dates",
        "Assigned agent or tool",
        "User comments",
        "Approval status",
    ],
    "execution": [
        "Current task",
        "Task status",
        "Files created or modified",
        "Implementation notes",
        "Decisions",
        "Errors",
        "Agent output",
        "User comments",
        "Requested revisions",
    ],
    "review": [
        "Requirement compliance",
        "Functional results",
        "Data integrity",
        "UI/UX quality",
        "Code quality",
        "Security",
        "Test results",
        "Issues and corrective actions",
        "User rating",
        "Final comments",
    ],
    "deployment": [
        "Build and test status",
        "Database migration status",
        "Backup confirmation",
        "Deployment environment",
        "Release version and date",
        "Deployment notes",
        "Rollback plan",
        "User approval",
    ],
    "maintenance": [
        "Bug reports",
        "Debugging requests",
        "Production incidents",
        "Performance issues",
        "User feedback",
        "Improvements",
        "Change requests",
        "Root cause",
        "Corrective and preventive actions",
        "Monitoring status",
    ],
}


def now_iso():
    return datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat()


def new_id():
    return str(uuid.uuid4())


def load_dotenv():
    env_path = APP_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_config():
    example_path = APP_DIR / "config.example.json"
    config_path = APP_DIR / "config.json"
    with example_path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)
    if config_path.exists():
        with config_path.open("r", encoding="utf-8") as handle:
            config.update(json.load(handle))
    return config


def app_path(relative_path):
    path = (APP_DIR / relative_path).resolve()
    if APP_DIR not in path.parents and path != APP_DIR:
        raise ValueError("Path escapes workflow-app")
    return path


def clip_extracted_text(text):
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    return cleaned[:EXTRACT_TEXT_LIMIT]


def extract_plain_text_file(path):
    return clip_extracted_text(path.read_text(encoding="utf-8", errors="replace"))


def extract_docx_text(path):
    try:
        with zipfile.ZipFile(path) as archive:
            with archive.open("word/document.xml") as handle:
                tree = ET.parse(handle)
        parts = []
        for node in tree.iter(f"{{{DOCX_NS}}}t"):
            if node.text:
                parts.append(node.text)
            if node.tail:
                parts.append(node.tail)
        return clip_extracted_text("".join(parts))
    except (OSError, zipfile.BadZipFile, KeyError, ET.ParseError):
        return ""


def extract_xlsx_text(path):
    try:
        with zipfile.ZipFile(path) as archive:
            shared_strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                with archive.open("xl/sharedStrings.xml") as handle:
                    tree = ET.parse(handle)
                for node in tree.iter(f"{{{XLSX_NS}}}t"):
                    if node.text:
                        shared_strings.append(node.text)
            parts = []
            for name in sorted(archive.namelist()):
                if not name.startswith("xl/worksheets/sheet") or not name.endswith(".xml"):
                    continue
                with archive.open(name) as handle:
                    tree = ET.parse(handle)
                for cell in tree.iter(f"{{{XLSX_NS}}}c"):
                    value_node = cell.find(f"{{{XLSX_NS}}}v")
                    if value_node is None or not value_node.text:
                        continue
                    if cell.get("t") == "s":
                        index = int(value_node.text)
                        if 0 <= index < len(shared_strings):
                            parts.append(shared_strings[index])
                    else:
                        parts.append(value_node.text)
        return clip_extracted_text(" ".join(parts))
    except (OSError, zipfile.BadZipFile, KeyError, ET.ParseError, ValueError):
        return ""


def extract_pdf_text(path):
    try:
        raw = path.read_bytes().decode("latin-1", errors="ignore")
        chunks = []
        for match in re.finditer(r"\((?:[^\\()]|\\.)*\)\s*Tj", raw):
            literal = match.group(0).rsplit(") Tj", 1)[0][1:]
            literal = re.sub(
                r"\\([nrtbf()\\])",
                lambda item: {
                    "n": "\n",
                    "r": "\r",
                    "t": "\t",
                    "b": "\b",
                    "f": "\f",
                    "(": "(",
                    ")": ")",
                    "\\": "\\",
                }.get(item.group(1), item.group(1)),
                literal,
            )
            if literal.strip():
                chunks.append(literal)
        if not chunks:
            for match in re.finditer(r"\((?:[^\\()]|\\.)*\)", raw):
                literal = match.group(0)[1:-1].strip()
                if len(literal) >= 2:
                    chunks.append(literal)
        return clip_extracted_text(" ".join(chunks))
    except OSError:
        return ""


def extract_legacy_binary_text(path):
    try:
        raw = path.read_bytes().decode("latin-1", errors="ignore")
        runs = re.findall(r"[ -~\u00a0-\u00ff]{6,}", raw)
        return clip_extracted_text(" ".join(runs))
    except OSError:
        return ""


def project_path(relative_path):
    path = (APP_DIR / relative_path).resolve()
    if PROJECT_ROOT not in path.parents and path != PROJECT_ROOT:
        raise ValueError("Path escapes project root")
    return path


class WorkflowStore:
    def __init__(self, config=None):
        self.config = config or load_config()
        self.db_path = app_path(self.config["database_path"])
        self.project_files_path = project_path(self.config["project_files_path"])
        self.baseline_path = project_path(self.config["baseline_path"])
        self.history_path = project_path(self.config["history_path"])
        self.attachments_path = app_path(self.config.get("attachments_path", "data/attachments"))
        self.handoff_queue_path = project_path(
            self.config.get("handoff_queue_path", "../agent-workflow/handoff-queue.md")
        )
        self.tasks_path = project_path(
            self.config.get("tasks_path", "../agent-workflow/tasks")
        )

    def initialize(self):
        (APP_DIR / "data").mkdir(parents=True, exist_ok=True)
        self.project_files_path.mkdir(parents=True, exist_ok=True)
        self.history_path.mkdir(parents=True, exist_ok=True)
        self.attachments_path.mkdir(parents=True, exist_ok=True)
        self.tasks_path.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
            self._migrate(conn)

    def _migrate(self, conn):
        cols = {row[1] for row in conn.execute("PRAGMA table_info(baseline_snapshots)")}
        if "change_summary" not in cols:
            conn.execute(
                "ALTER TABLE baseline_snapshots ADD COLUMN change_summary TEXT NOT NULL DEFAULT ''"
            )
        conn.commit()

    def connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def audit(self, conn, event_type, actor, details, record_id=None, version_id=None):
        conn.execute(
            """
            INSERT INTO audit_events
              (id, record_id, version_id, event_type, actor, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(),
                record_id,
                version_id,
                event_type,
                actor,
                json.dumps(details, sort_keys=True),
                now_iso(),
            ),
        )

    def create_record(self, record_type, title, payload, submitter, status="Draft"):
        if record_type not in RECORD_TYPES:
            raise ValueError("Unknown record type")
        if status not in STATUSES:
            raise ValueError("Unknown status")
        timestamp = now_iso()
        record_id = new_id()
        with self.connect() as conn:
            conn.execute("BEGIN")
            conn.execute(
                """
                INSERT INTO workflow_records
                  (id, record_type, title, status, submitter, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (record_id, record_type, title, status, submitter, timestamp, timestamp),
            )
            cursor = conn.execute(
                """
                INSERT INTO workflow_versions
                  (record_id, version_number, status, payload_json, submitter, created_at)
                VALUES (?, 1, ?, ?, ?, ?)
                """,
                (record_id, status, json.dumps(payload, sort_keys=True), submitter, timestamp),
            )
            version_id = cursor.lastrowid
            conn.execute(
                "UPDATE workflow_records SET current_version_id = ? WHERE id = ?",
                (version_id, record_id),
            )
            self.audit(conn, "create", submitter, {"title": title, "record_type": record_type}, record_id, version_id)
            conn.commit()
        return self.get_record(record_id)

    def create_version(self, record_id, title, payload, submitter, status="Draft"):
        if status not in STATUSES:
            raise ValueError("Unknown status")
        timestamp = now_iso()
        with self.connect() as conn:
            record = conn.execute("SELECT * FROM workflow_records WHERE id = ?", (record_id,)).fetchone()
            if not record:
                raise ValueError("Record not found")
            next_version = conn.execute(
                "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM workflow_versions WHERE record_id = ?",
                (record_id,),
            ).fetchone()["next_version"]
            cursor = conn.execute(
                """
                INSERT INTO workflow_versions
                  (record_id, version_number, status, payload_json, submitter, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (record_id, next_version, status, json.dumps(payload, sort_keys=True), submitter, timestamp),
            )
            version_id = cursor.lastrowid
            conn.execute(
                """
                UPDATE workflow_records
                SET title = ?, status = ?, current_version_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (title, status, version_id, timestamp, record_id),
            )
            self.audit(conn, "revise", submitter, {"title": title, "version_number": next_version}, record_id, version_id)
        return self.get_record(record_id)

    def set_status(self, record_id, status, actor, event_type):
        if status not in STATUSES:
            raise ValueError("Unknown status")
        timestamp = now_iso()
        with self.connect() as conn:
            record = conn.execute("SELECT * FROM workflow_records WHERE id = ?", (record_id,)).fetchone()
            if not record:
                raise ValueError("Record not found")
            conn.execute(
                "UPDATE workflow_records SET status = ?, updated_at = ? WHERE id = ?",
                (status, timestamp, record_id),
            )
            self.audit(conn, event_type, actor, {"status": status}, record_id, record["current_version_id"])
        return self.get_record(record_id)

    def decide(self, record_id, decision, approver, notes):
        if decision not in ["Approved", "Needs Revision", "Rejected", "Completed", "Deployed", "Superseded"]:
            raise ValueError("Unsupported decision")
        with self.connect() as conn:
            record = conn.execute("SELECT * FROM workflow_records WHERE id = ?", (record_id,)).fetchone()
            if not record:
                raise ValueError("Record not found")
            version_id = record["current_version_id"]
            conn.execute(
                """
                INSERT INTO approvals (id, record_id, version_id, decision, approver, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), record_id, version_id, decision, approver, notes or "", now_iso()),
            )
            conn.execute(
                "UPDATE workflow_records SET status = ?, updated_at = ? WHERE id = ?",
                (decision, now_iso(), record_id),
            )
            event_type = "deploy" if decision == "Deployed" else decision.lower().replace(" ", "_")
            self.audit(conn, event_type, approver, {"decision": decision, "notes": notes or ""}, record_id, version_id)
        result = self.get_record(record_id)
        if result["record_type"] == "baseline" and decision == "Approved":
            self.create_baseline_snapshot(record_id, approver, notes or "")
            result = self.get_record(record_id)
        return result

    def create_baseline_snapshot(self, record_id, actor, change_summary=""):
        record = self.get_record(record_id)
        payload = record["payload"]
        with self.connect() as conn:
            next_snapshot = conn.execute(
                "SELECT COALESCE(MAX(snapshot_number), 0) + 1 AS next_snapshot FROM baseline_snapshots"
            ).fetchone()["next_snapshot"]
        markdown = self.render_baseline_markdown(record, payload, next_snapshot, change_summary)
        timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d%H%M%S")
        backups = self.history_path / "baseline-backups"
        backups.mkdir(parents=True, exist_ok=True)
        backup_path = backups / f"version-0-baseline.{timestamp}.bak.md"
        if self.baseline_path.exists():
            shutil.copy2(self.baseline_path, backup_path)
        else:
            backup_path.write_text("", encoding="utf-8")
        versioned_path = self.history_path / f"version-{next_snapshot}-baseline.md"
        versioned_path.parent.mkdir(parents=True, exist_ok=True)
        versioned_path.write_text(markdown, encoding="utf-8")
        self.baseline_path.parent.mkdir(parents=True, exist_ok=True)
        self.baseline_path.write_text(markdown, encoding="utf-8")
        with self.connect() as conn:
            conn.execute("UPDATE baseline_snapshots SET is_active = 0")
            snapshot_id = new_id()
            conn.execute(
                """
                INSERT INTO baseline_snapshots
                  (id, record_id, version_id, snapshot_number, generated_markdown_path,
                   backup_path, is_active, change_summary, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    snapshot_id,
                    record_id,
                    record["current_version_id"],
                    next_snapshot,
                    str(versioned_path.relative_to(PROJECT_ROOT)),
                    str(backup_path.relative_to(PROJECT_ROOT)),
                    change_summary,
                    now_iso(),
                ),
            )
            self.audit(
                conn,
                "baseline_snapshot",
                actor,
                {
                    "snapshot_number": next_snapshot,
                    "baseline_path": str(self.baseline_path.relative_to(PROJECT_ROOT)),
                    "change_summary": change_summary,
                },
                record_id,
                record["current_version_id"],
            )

    def restore_baseline(self, snapshot_id, actor):
        with self.connect() as conn:
            snapshot = conn.execute("SELECT * FROM baseline_snapshots WHERE id = ?", (snapshot_id,)).fetchone()
            if not snapshot:
                raise ValueError("Snapshot not found")
            version = conn.execute("SELECT * FROM workflow_versions WHERE id = ?", (snapshot["version_id"],)).fetchone()
            record = conn.execute("SELECT * FROM workflow_records WHERE id = ?", (snapshot["record_id"],)).fetchone()
            payload = json.loads(version["payload_json"])
            markdown = self.render_baseline_markdown(
                dict(record), payload, snapshot["snapshot_number"], snapshot["change_summary"] or ""
            )
            timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d%H%M%S")
            backups = self.history_path / "baseline-backups"
            backups.mkdir(parents=True, exist_ok=True)
            backup_path = backups / f"version-0-baseline.restore.{timestamp}.bak.md"
            if self.baseline_path.exists():
                shutil.copy2(self.baseline_path, backup_path)
            self.baseline_path.write_text(markdown, encoding="utf-8")
            conn.execute("UPDATE baseline_snapshots SET is_active = 0")
            conn.execute(
                """
                UPDATE baseline_snapshots
                SET is_active = 1, restored_at = ?, restored_by = ?, restored_from_snapshot_id = ?
                WHERE id = ?
                """,
                (now_iso(), actor, snapshot_id, snapshot_id),
            )
            self.audit(
                conn,
                "restore_baseline",
                actor,
                {"snapshot_id": snapshot_id, "backup_path": str(backup_path.relative_to(PROJECT_ROOT))},
                snapshot["record_id"],
                snapshot["version_id"],
            )
        return {"ok": True}

    def render_baseline_markdown(self, record, payload, snapshot_number=0, change_summary=""):
        def value(key):
            return str(payload.get(key, "")).strip() or "[TBD]"

        generated = now_iso()
        sections = []
        for field in FIELD_DEFINITIONS["baseline"]:
            sections.append(f"# {field}\n\n{value(field)}")
        change_block = ""
        if change_summary.strip():
            change_block = f"\n# Summary of Changes\n\n{change_summary.strip()}\n"
        return f"""# Version {snapshot_number} - Baseline Project Definition

Baseline File:

```text
agent-history/version-0-baseline.md
```

Versioned copy:

```text
agent-history/version-{snapshot_number}-baseline.md
```

Status:

```text
Approved
```

Created Date:

```text
{generated}
```

Project Owner:

```text
{record.get("submitter", "[TBD]")}
```

## Purpose

This file is the approved baseline generated from the local workflow app.

---
{change_block}
{chr(10).join(sections)}

# Baseline Approval

- Source record: `{record["id"]}`
- Source version: `{record["current_version_id"]}`
- Snapshot number: `{snapshot_number}`
- Approved by: `{record.get("submitter", "[TBD]")}`
- Approval date: `{generated}`

This baseline remains the permanent source of truth unless explicitly revised and approved by the project owner.
"""

    def add_comment(self, record_id, version_id, author, comment_type, body):
        if comment_type not in ["Comment", "Revision Request", "Decision Note", "Bug", "Maintenance"]:
            raise ValueError("Unsupported comment type")
        comment_id = new_id()
        with self.connect() as conn:
            record = conn.execute("SELECT * FROM workflow_records WHERE id = ?", (record_id,)).fetchone()
            if not record:
                raise ValueError("Record not found")
            conn.execute(
                """
                INSERT INTO comments (id, record_id, version_id, author, comment_type, body, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (comment_id, record_id, version_id, author, comment_type, body, now_iso()),
            )
            self.audit(conn, "comment", author, {"comment_type": comment_type}, record_id, version_id)
        return {"id": comment_id}

    def get_record(self, record_id):
        with self.connect() as conn:
            record = conn.execute(
                """
                SELECT r.*, v.version_number, v.payload_json, v.created_at AS version_created_at
                FROM workflow_records r
                JOIN workflow_versions v ON v.id = r.current_version_id
                WHERE r.id = ?
                """,
                (record_id,),
            ).fetchone()
            if not record:
                raise ValueError("Record not found")
            result = dict(record)
            result["payload"] = json.loads(result.pop("payload_json"))
            return result

    def list_records(self, record_type=None):
        sql = """
            SELECT r.*, v.version_number, v.payload_json
            FROM workflow_records r
            JOIN workflow_versions v ON v.id = r.current_version_id
        """
        params = []
        if record_type:
            sql += " WHERE r.record_type = ?"
            params.append(record_type)
        sql += " ORDER BY r.updated_at DESC"
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        records = []
        for row in rows:
            item = dict(row)
            item["payload"] = json.loads(item.pop("payload_json"))
            records.append(item)
        return records

    def list_versions(self, record_id):
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM workflow_versions WHERE record_id = ? ORDER BY version_number DESC",
                (record_id,),
            ).fetchall()
        versions = []
        for row in rows:
            item = dict(row)
            item["payload"] = json.loads(item.pop("payload_json"))
            versions.append(item)
        return versions

    def list_comments(self, record_id=None):
        sql = "SELECT * FROM comments"
        params = []
        if record_id:
            sql += " WHERE record_id = ?"
            params.append(record_id)
        sql += " ORDER BY created_at DESC"
        with self.connect() as conn:
            return [dict(row) for row in conn.execute(sql, params).fetchall()]

    def list_audit(self):
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 200").fetchall()
        events = []
        for row in rows:
            item = dict(row)
            item["details"] = json.loads(item.pop("details_json"))
            events.append(item)
        return events

    def list_baselines(self):
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM baseline_snapshots ORDER BY snapshot_number DESC").fetchall()
        return [dict(row) for row in rows]

    def active_baseline_snapshot(self, conn):
        if conn is None:
            with self.connect() as inner:
                row = inner.execute(
                    "SELECT * FROM baseline_snapshots WHERE is_active = 1 ORDER BY snapshot_number DESC LIMIT 1"
                ).fetchone()
                return dict(row) if row else None
        row = conn.execute(
            "SELECT * FROM baseline_snapshots WHERE is_active = 1 ORDER BY snapshot_number DESC LIMIT 1"
        ).fetchone()
        return row

    def next_reference_id(self, conn, phase):
        prefix = REFERENCE_PREFIX[phase]
        rows = conn.execute(
            "SELECT reference_id FROM handoff_entries WHERE phase = ?",
            (phase,),
        ).fetchall()
        highest = 0
        for row in rows:
            suffix = str(row["reference_id"]).rsplit("-", 1)[-1]
            if suffix.isdigit():
                highest = max(highest, int(suffix))
        return f"{prefix}-{highest + 1:04d}"

    @staticmethod
    def compute_content_hash(phase, title, original_text, elements):
        selectors = sorted((element.get("selector") or "").strip() for element in elements)
        basis = "|".join([phase, title.strip().lower(), original_text.strip().lower(), *selectors])
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:16]

    def create_handoff_entry(
        self,
        phase,
        title,
        payload,
        submitter,
        original_text="",
        ai_instruction="",
        compact_instruction="",
        category="",
        priority="Medium",
        source_page="",
        elements=None,
    ):
        if phase not in HANDOFF_PHASES:
            raise ValueError("Unknown handoff phase")
        if priority not in PRIORITIES:
            priority = "Medium"
        title = (title or "").strip() or "Untitled"
        elements = elements or []
        content_hash = self.compute_content_hash(phase, title, original_text, elements)
        timestamp = now_iso()
        entry_id = new_id()
        with self.connect() as conn:
            conn.execute("BEGIN")
            duplicate = conn.execute(
                """
                SELECT reference_id FROM handoff_entries
                WHERE content_hash = ? AND status NOT IN ('completed', 'rejected')
                LIMIT 1
                """,
                (content_hash,),
            ).fetchone()
            if duplicate:
                conn.rollback()
                raise ValueError(f"Duplicate of open handoff entry {duplicate['reference_id']}")
            reference_id = self.next_reference_id(conn, phase)
            snapshot = self.active_baseline_snapshot(conn)
            baseline_snapshot_id = snapshot["id"] if snapshot else None
            conn.execute(
                """
                INSERT INTO handoff_entries
                  (id, reference_id, phase, title, payload_json, original_text,
                   ai_instruction, compact_instruction, category, priority, source_page,
                   baseline_snapshot_id, status, content_hash, submitter, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    reference_id,
                    phase,
                    title,
                    json.dumps(payload, sort_keys=True),
                    original_text,
                    ai_instruction,
                    compact_instruction,
                    category,
                    priority,
                    source_page,
                    baseline_snapshot_id,
                    content_hash,
                    submitter,
                    timestamp,
                    timestamp,
                ),
            )
            for element in elements:
                conn.execute(
                    """
                    INSERT INTO selected_elements
                      (id, handoff_entry_id, route, element_type, visible_text, selector,
                       attributes_json, component_name, parent_context, dimensions, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id(),
                        entry_id,
                        element.get("route") or "",
                        element.get("element_type") or "",
                        element.get("visible_text") or "",
                        element.get("selector") or "",
                        json.dumps(element.get("attributes") or {}, sort_keys=True),
                        element.get("component_name") or "",
                        element.get("parent_context") or "",
                        element.get("dimensions") or "",
                        timestamp,
                    ),
                )
            self.audit(
                conn,
                "handoff_submit",
                submitter,
                {"reference_id": reference_id, "phase": phase, "title": title},
            )
            conn.commit()
        self.write_handoff_queue()
        return self.get_handoff_entry(entry_id)

    def get_handoff_entry(self, entry_id):
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM handoff_entries WHERE id = ?", (entry_id,)).fetchone()
            if not row:
                raise ValueError("Handoff entry not found")
            entry = dict(row)
            entry["payload"] = json.loads(entry.pop("payload_json"))
            elements = conn.execute(
                "SELECT * FROM selected_elements WHERE handoff_entry_id = ? ORDER BY created_at",
                (entry_id,),
            ).fetchall()
            entry["elements"] = []
            for element in elements:
                item = dict(element)
                item["attributes"] = json.loads(item.pop("attributes_json"))
                entry["elements"].append(item)
            attachments = conn.execute(
                "SELECT * FROM attachments WHERE handoff_entry_id = ? ORDER BY created_at",
                (entry_id,),
            ).fetchall()
            entry["attachments"] = [dict(attachment) for attachment in attachments]
        return entry

    def list_handoff_entries(self, phase=None, status=None):
        sql = "SELECT * FROM handoff_entries"
        clauses = []
        params = []
        if phase:
            clauses.append("phase = ?")
            params.append(phase)
        if status:
            clauses.append("status = ?")
            params.append(status)
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC"
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
            entries = []
            for row in rows:
                entry = dict(row)
                entry["payload"] = json.loads(entry.pop("payload_json"))
                entry["element_count"] = conn.execute(
                    "SELECT COUNT(*) AS count FROM selected_elements WHERE handoff_entry_id = ?",
                    (entry["id"],),
                ).fetchone()["count"]
                entry["attachment_count"] = conn.execute(
                    "SELECT COUNT(*) AS count FROM attachments WHERE handoff_entry_id = ?",
                    (entry["id"],),
                ).fetchone()["count"]
                entries.append(entry)
        return entries

    def update_handoff_status(self, entry_id, status, actor):
        if status not in HANDOFF_STATUSES:
            raise ValueError("Unknown handoff status")
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM handoff_entries WHERE id = ?", (entry_id,)).fetchone()
            if not row:
                raise ValueError("Handoff entry not found")
            conn.execute(
                "UPDATE handoff_entries SET status = ?, updated_at = ? WHERE id = ?",
                (status, now_iso(), entry_id),
            )
            self.audit(
                conn,
                "handoff_status",
                actor,
                {"reference_id": row["reference_id"], "status": status},
            )
        self.write_handoff_queue()
        return self.get_handoff_entry(entry_id)

    def save_attachment(self, entry_id, filename, data_base64, annotation="", actor="Project Owner"):
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM handoff_entries WHERE id = ?", (entry_id,)).fetchone()
            if not row:
                raise ValueError("Handoff entry not found")
            reference_id = row["reference_id"]
        suffix = Path(filename or "").suffix.lower()
        if suffix not in ATTACHMENT_EXTENSIONS:
            raise ValueError("Unsupported attachment type")
        if "," in data_base64:
            data_base64 = data_base64.split(",", 1)[1]
        raw = base64.b64decode(data_base64)
        max_bytes = int(self.config.get("max_attachment_bytes", 5_000_000))
        if len(raw) > max_bytes:
            raise ValueError("Attachment exceeds size limit")
        attachment_id = new_id()
        entry_dir = self.attachments_path / entry_id
        entry_dir.mkdir(parents=True, exist_ok=True)
        file_path = entry_dir / f"{attachment_id}{suffix}"
        file_path.write_bytes(raw)
        relative_path = str(file_path.relative_to(APP_DIR))
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO attachments (id, handoff_entry_id, file_path, annotation, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (attachment_id, entry_id, relative_path, annotation, now_iso()),
            )
            conn.execute(
                "UPDATE handoff_entries SET updated_at = ? WHERE id = ?",
                (now_iso(), entry_id),
            )
            self.audit(conn, "handoff_attachment", actor, {"reference_id": reference_id})
        self.write_handoff_queue()
        return {"id": attachment_id, "file_path": relative_path}

    def get_attachment_file(self, attachment_id):
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM attachments WHERE id = ?", (attachment_id,)).fetchone()
        if not row:
            raise ValueError("Attachment not found")
        path = app_path(row["file_path"])
        if not path.exists():
            raise ValueError("Attachment file missing")
        content_type = ATTACHMENT_EXTENSIONS.get(path.suffix.lower(), "application/octet-stream")
        return path.read_bytes(), content_type

    def write_handoff_queue(self):
        entries = self.list_handoff_entries()
        detailed = [self.get_handoff_entry(entry["id"]) for entry in entries]
        with self.connect() as conn:
            snapshot_numbers = {
                row["id"]: row["snapshot_number"]
                for row in conn.execute("SELECT id, snapshot_number FROM baseline_snapshots").fetchall()
            }
        markdown = self.render_handoff_queue_markdown(detailed, snapshot_numbers)
        self.handoff_queue_path.parent.mkdir(parents=True, exist_ok=True)
        self.handoff_queue_path.write_text(markdown, encoding="utf-8")

    def render_handoff_queue_markdown(self, entries, snapshot_numbers):
        generated = now_iso()
        active = [entry for entry in entries if entry["status"] not in ("completed", "rejected")]
        active.sort(key=lambda entry: (HANDOFF_STATUS_ORDER.get(entry["status"], 99), entry["created_at"]))
        done = [entry for entry in entries if entry["status"] in ("completed", "rejected")]
        done.sort(key=lambda entry: entry["updated_at"], reverse=True)

        lines = [
            "# Handoff Queue",
            "",
            f"Generated: `{generated}`",
            "",
            "Auto-generated by the local workflow app. Each entry is an agent-executable item.",
            "Do not edit by hand; update item status in the workflow app.",
            "Agents: follow `agent-history/version-0-baseline.md` and `AGENTS.md` when executing items.",
            "",
            f"Open items: {len(active)} | Resolved items: {len(done)}",
            "",
            "## Next Actionable Item",
            "",
        ]
        if active:
            lines.append(f"`{active[0]['reference_id']}` - {active[0]['title']} ({active[0]['status']})")
        else:
            lines.append("None. All items resolved.")
        lines.extend(["", "## Open Items", ""])
        if not active:
            lines.append("No open items.")
        for entry in active:
            lines.extend(self.render_handoff_entry_block(entry, snapshot_numbers))
        lines.extend(["", "## Resolved Items", ""])
        if not done:
            lines.append("No resolved items.")
        for entry in done:
            lines.append(
                f"- `{entry['reference_id']}` {entry['title']} - {entry['status']} ({entry['updated_at']})"
            )
        return "\n".join(lines).rstrip() + "\n"

    def render_handoff_entry_block(self, entry, snapshot_numbers):
        payload = entry.get("payload", {})
        baseline = snapshot_numbers.get(entry.get("baseline_snapshot_id"))
        baseline_label = f"#{baseline}" if baseline is not None else "None"
        elements = entry.get("elements", [])
        if elements:
            element_lines = "; ".join(
                f"{element.get('element_type') or 'element'} [{element.get('selector') or 'n/a'}]"
                + (f' "{element.get("visible_text")[:40]}"' if element.get("visible_text") else "")
                for element in elements
            )
        else:
            element_lines = "None"
        attachments = entry.get("attachments", [])
        if attachments:
            attachment_lines = "; ".join(
                f"{Path(attachment['file_path']).name}"
                + (f" ({attachment['annotation']})" if attachment.get("annotation") else "")
                for attachment in attachments
            )
        else:
            attachment_lines = "None"
        instruction = entry.get("compact_instruction") or entry.get("ai_instruction") or entry.get("original_text")
        block = [
            f"### {entry['reference_id']} - {entry['title']}",
            "",
            f"1. Reference ID: `{entry['reference_id']}`",
            f"2. Phase: {HANDOFF_PHASES.get(entry['phase'], entry['phase'])}",
            f"3. Title: {entry['title']}",
            f"4. Context: {payload.get('context') or payload.get('description') or entry.get('original_text') or '[none]'}",
            f"5. Affected target: {entry.get('source_page') or '[unspecified]'} | Elements: {element_lines}",
            f"6. User request: {entry.get('original_text') or '[none]'}",
            f"7. Expected result: {payload.get('expected_result') or '[unspecified]'}",
            f"8. Acceptance criteria: {payload.get('acceptance_criteria') or '[unspecified]'}",
            f"9. Attachments: {attachment_lines}",
            f"10. Priority/Severity: {entry.get('priority') or 'Medium'}"
            + (f" | Category: {entry['category']}" if entry.get("category") else ""),
            f"11. Baseline revision: {baseline_label}",
            f"12. Submitted: {entry['created_at']} | Status: {entry['status']}",
            "13. Agent instruction:",
            "",
            "```text",
            (instruction or "[no instruction provided]").strip(),
            "```",
            "",
        ]
        return block

    def openai_api_key(self):
        return os.environ.get("OPENAI_API_KEY", "").strip()

    def get_settings(self):
        return {
            "target_preview_url": self.config.get("target_preview_url", ""),
            "openai_model": self.config.get("openai_model", "gpt-4o-mini"),
            "openai_base_url": self.config.get("openai_base_url", "https://api.openai.com/v1"),
            "default_submitter": self.config.get("default_submitter", "Project Owner"),
            "ai_available": bool(self.openai_api_key()),
        }

    def update_settings(self, updates):
        allowed = {"target_preview_url", "openai_model", "openai_base_url", "default_submitter"}
        config_path = APP_DIR / "config.json"
        current = {}
        if config_path.exists():
            current = json.loads(config_path.read_text(encoding="utf-8"))
        for key, value in updates.items():
            if key in allowed and isinstance(value, str):
                current[key] = value.strip()
                self.config[key] = value.strip()
        config_path.write_text(json.dumps(current, indent=2, sort_keys=True), encoding="utf-8")
        return self.get_settings()

    def improve_text(self, phase, kind, text, context=None):
        original = (text or "").strip()
        result = {
            "ai_available": bool(self.openai_api_key()),
            "status": "ok",
            "improved": original,
            "compact_instruction": original,
            "acceptance_criteria": "",
            "message": "",
        }
        if not original:
            result["status"] = "empty"
            result["message"] = "Provide text before requesting an AI improvement."
            return result
        api_key = self.openai_api_key()
        if not api_key:
            result["status"] = "no_key"
            result["message"] = "OPENAI_API_KEY is not set. Using original input."
            return result

        phase_label = HANDOFF_PHASES.get(phase, phase or "workflow item")
        if phase == "feedback":
            system_prompt = (
                "Convert UI/UX feedback into a concise implementation task for an AI coding agent. "
                "Respond ONLY with JSON keys: improved (string), compact_instruction (string), acceptance_criteria (string). "
                "compact_instruction must include: affected page/component, current behavior, expected behavior, "
                "design requirements, responsive behavior, accessibility considerations. "
                "Do not invent missing details. Never change selectors, file paths, or technical facts."
            )
        elif phase == "bug":
            system_prompt = (
                "Convert debugging input into a structured bug task for an AI coding agent. "
                "Respond ONLY with JSON keys: improved (string), compact_instruction (string), acceptance_criteria (string). "
                "compact_instruction must include: bug title, severity, affected area, reproduction steps, "
                "expected vs observed behavior, available evidence, likely areas to inspect, recommended diagnostic steps. "
                "Never present an unverified suspected cause as confirmed root cause. Label hypotheses as unverified. "
                "Do not invent missing details."
            )
        else:
            system_prompt = (
                "You refine project owner input into concise, agent-executable instructions for an AI coding agent. "
                "Respond ONLY with JSON keys: improved (string), compact_instruction (string), acceptance_criteria (string). "
                "Do not invent missing details."
            )
        user_payload = {
            "phase": phase_label,
            "kind": kind or "",
            "input": original,
            "context": context or {},
        }
        body = json.dumps({
            "model": self.config.get("openai_model", "gpt-4o-mini"),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }).encode("utf-8")
        base_url = self.config.get("openai_base_url", "https://api.openai.com/v1").rstrip("/")
        request = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            timeout = float(self.config.get("openai_timeout_seconds", 30))
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            parsed = self._parse_ai_content(content)
            result["improved"] = parsed.get("improved", original).strip() or original
            result["compact_instruction"] = parsed.get("compact_instruction", result["improved"]).strip()
            result["acceptance_criteria"] = parsed.get("acceptance_criteria", "").strip()
        except urllib.error.HTTPError as error:
            result["status"] = "rate_limited" if error.code == 429 else "error"
            if error.code in (401, 403):
                result["status"] = "invalid_key"
                result["message"] = "OpenAI rejected the API key. Using original input."
            elif error.code == 429:
                result["message"] = "OpenAI rate limit reached. Using original input."
            else:
                result["message"] = f"OpenAI request failed ({error.code}). Using original input."
        except (urllib.error.URLError, TimeoutError) as error:
            result["status"] = "error"
            result["message"] = f"Could not reach OpenAI: {error}. Using original input."
        except (KeyError, ValueError, json.JSONDecodeError):
            result["status"] = "error"
            result["message"] = "Unexpected OpenAI response. Using original input."
        return result

    @staticmethod
    def _parse_ai_content(content):
        try:
            return json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return {"improved": content or "", "compact_instruction": content or "", "acceptance_criteria": ""}

    def fetch_preview(self, url):
        if not url:
            target = self.config.get("target_preview_url", "").strip()
            if not target:
                raise ValueError("No target preview URL is configured. Set one in Settings.")
            url = target
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only http and https preview URLs are allowed")
        configured = self.config.get("target_preview_url", "").strip()
        if configured:
            allowed = urllib.parse.urlparse(configured)
            if (parsed.scheme, parsed.hostname, parsed.port) != (allowed.scheme, allowed.hostname, allowed.port):
                raise ValueError("Preview URL must match the configured target origin")
        request = urllib.request.Request(url, headers={"User-Agent": "WorkflowApp-Preview"})
        timeout = float(self.config.get("preview_timeout_seconds", 15))
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get("Content-Type", "text/html")
            raw = response.read()
        if "text/html" not in content_type.lower():
            return raw, content_type
        html = raw.decode("utf-8", errors="replace")
        # The inspector script must load from the workflow app origin, so it is injected
        # BEFORE the <base> tag (which points relative/absolute-path URLs at the target).
        injection = (
            f'<script>window.__WORKFLOW_PREVIEW_URL__ = {json.dumps(url)};</script>'
            '<script src="/inspector.js"></script>'
            f'<base href="{url}">'
        )
        lowered = html.lower()
        head_index = lowered.find("<head")
        if head_index != -1:
            head_close = lowered.find(">", head_index)
            insert_at = head_close + 1 if head_close != -1 else head_index
            html = html[:insert_at] + injection + html[insert_at:]
        else:
            html = injection + html
        return html.encode("utf-8"), "text/html; charset=utf-8"

    @staticmethod
    def brief_content_hash(description, workflow_notes, features_notes, additional_instructions):
        payload = "|".join([
            description.strip(),
            workflow_notes.strip(),
            features_notes.strip(),
            additional_instructions.strip(),
        ])
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get_current_brief(self):
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM project_briefs ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        brief = dict(row)
        brief["structured"] = json.loads(brief.get("ai_structured_json") or "{}")
        brief["attachments"] = self.list_reference_attachments("brief", brief["id"])
        return brief

    def save_brief(self, data, submitter):
        timestamp = now_iso()
        description = (data.get("description") or "").strip()
        workflow_notes = (data.get("workflow_notes") or "").strip()
        features_notes = (data.get("features_notes") or "").strip()
        additional_instructions = (data.get("additional_instructions") or "").strip()
        title = (data.get("title") or "Project Brief").strip() or "Project Brief"
        content_hash = self.brief_content_hash(
            description, workflow_notes, features_notes, additional_instructions
        )
        existing = self.get_current_brief()
        with self.connect() as conn:
            if existing:
                reset_ai = content_hash != existing.get("content_hash")
                conn.execute(
                    """
                    UPDATE project_briefs
                    SET title = ?, description = ?, workflow_notes = ?, features_notes = ?,
                        additional_instructions = ?, content_hash = ?, submitter = ?, updated_at = ?,
                        status = CASE WHEN ? THEN 'draft' ELSE status END,
                        ai_structured_json = CASE WHEN ? THEN '{}' ELSE ai_structured_json END
                    WHERE id = ?
                    """,
                    (
                        title, description, workflow_notes, features_notes,
                        additional_instructions, content_hash, submitter, timestamp,
                        1 if reset_ai else 0, 1 if reset_ai else 0, existing["id"],
                    ),
                )
                brief_id = existing["id"]
            else:
                brief_id = new_id()
                conn.execute(
                    """
                    INSERT INTO project_briefs
                      (id, title, description, workflow_notes, features_notes,
                       additional_instructions, ai_structured_json, status, baseline_record_id,
                       content_hash, submitter, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, '{}', 'draft', NULL, ?, ?, ?, ?)
                    """,
                    (
                        brief_id, title, description, workflow_notes, features_notes,
                        additional_instructions, content_hash, submitter, timestamp, timestamp,
                    ),
                )
            self.audit(conn, "brief_save", submitter, {"brief_id": brief_id})
        return self.get_current_brief()

    def list_reference_attachments(self, parent_type, parent_id):
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM reference_attachments
                WHERE parent_type = ? AND parent_id = ?
                ORDER BY created_at
                """,
                (parent_type, parent_id),
            ).fetchall()
        return [dict(row) for row in rows]

    def save_reference_attachment(self, parent_type, parent_id, filename, data_base64, annotation="", actor="Project Owner"):
        if parent_type not in ("brief", "handoff"):
            raise ValueError("Unsupported parent type")
        suffix = Path(filename or "").suffix.lower()
        if suffix not in REFERENCE_ATTACHMENT_EXTENSIONS:
            raise ValueError("Unsupported attachment type")
        if "," in data_base64:
            data_base64 = data_base64.split(",", 1)[1]
        raw = base64.b64decode(data_base64)
        max_bytes = int(self.config.get("max_attachment_bytes", 5_000_000))
        if len(raw) > max_bytes:
            raise ValueError("Attachment exceeds size limit")
        content_hash = hashlib.sha256(raw).hexdigest()
        with self.connect() as conn:
            duplicate = conn.execute(
                """
                SELECT id FROM reference_attachments
                WHERE parent_type = ? AND parent_id = ? AND content_hash = ?
                """,
                (parent_type, parent_id, content_hash),
            ).fetchone()
            if duplicate:
                return {"id": duplicate["id"], "duplicate": True}
        attachment_id = new_id()
        entry_dir = self.attachments_path / parent_type / parent_id
        entry_dir.mkdir(parents=True, exist_ok=True)
        file_path = entry_dir / f"{attachment_id}{suffix}"
        file_path.write_bytes(raw)
        relative_path = str(file_path.relative_to(APP_DIR))
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO reference_attachments
                  (id, parent_type, parent_id, file_path, filename, content_hash, annotation, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    attachment_id, parent_type, parent_id, relative_path,
                    filename or Path(relative_path).name, content_hash, annotation, now_iso(),
                ),
            )
            self.audit(conn, "reference_attachment", actor, {"parent_type": parent_type, "parent_id": parent_id})
        return {"id": attachment_id, "file_path": relative_path, "duplicate": False}

    def get_reference_attachment_file(self, attachment_id):
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM reference_attachments WHERE id = ?", (attachment_id,)).fetchone()
        if not row:
            raise ValueError("Attachment not found")
        path = app_path(row["file_path"])
        if not path.exists():
            raise ValueError("Attachment file missing")
        content_type = REFERENCE_ATTACHMENT_EXTENSIONS.get(path.suffix.lower(), "application/octet-stream")
        return path.read_bytes(), content_type

    def extract_attachment_text(self, attachment):
        path = app_path(attachment["file_path"])
        suffix = path.suffix.lower()
        try:
            if suffix in TEXT_EXTRACT_EXTENSIONS:
                return extract_plain_text_file(path)
            if suffix == ".docx":
                return extract_docx_text(path)
            if suffix == ".xlsx":
                return extract_xlsx_text(path)
            if suffix == ".pdf":
                return extract_pdf_text(path)
            if suffix in LEGACY_BINARY_EXTENSIONS:
                return extract_legacy_binary_text(path)
        except OSError:
            return ""
        return ""

    @staticmethod
    def attachment_extraction_note(attachment, extracted):
        if extracted:
            return ""
        name = attachment.get("filename") or attachment.get("file_path") or ""
        suffix = Path(name).suffix.lower()
        if suffix in LEGACY_BINARY_EXTENSIONS:
            return "Legacy binary format (.doc/.xls); content not extracted. List as reference only."
        if suffix in EXTRACTABLE_OFFICE_EXTENSIONS:
            return "File stored but text extraction yielded no usable content. List as reference only."
        return "Binary or unsupported format; content not extracted. List as reference only."

    @staticmethod
    def structured_list_to_text(value):
        if isinstance(value, list):
            items = [str(item).strip() for item in value if str(item).strip()]
            return "\n".join(f"- {item}" for item in items) if items else ""
        return str(value or "").strip()

    def structured_to_baseline_payload(self, structured, reference_files=""):
        payload = {}
        for key, field in BASELINE_AI_FIELD_MAP:
            payload[field] = self.structured_list_to_text(structured.get(key, ""))
        payload["Reference files"] = reference_files or self.structured_list_to_text(
            structured.get("reference_files", "")
        )
        payload["Additional instructions"] = self.structured_list_to_text(
            structured.get("additional_instructions", "")
        )
        return payload

    def apply_brief_to_baseline(self, submitter):
        brief = self.get_current_brief()
        if not brief:
            raise ValueError("No project brief exists")
        structured = brief.get("structured") or {}
        if not structured:
            raise ValueError("Process the brief with AI before loading requirements")
        ref_names = ", ".join(
            attachment.get("filename") or Path(attachment["file_path"]).name
            for attachment in brief.get("attachments", [])
        )
        payload = self.structured_to_baseline_payload(structured, ref_names)
        title = brief.get("title") or "Project Baseline"
        if brief.get("baseline_record_id"):
            record = self.create_version(
                brief["baseline_record_id"],
                title,
                payload,
                submitter,
                "Draft",
            )
        else:
            record = self.create_record("baseline", title, payload, submitter, "Draft")
            with self.connect() as conn:
                conn.execute(
                    "UPDATE project_briefs SET baseline_record_id = ?, status = 'converted', updated_at = ? WHERE id = ?",
                    (record["id"], now_iso(), brief["id"]),
                )
            return record
        with self.connect() as conn:
            conn.execute(
                "UPDATE project_briefs SET status = 'converted', updated_at = ? WHERE id = ?",
                (now_iso(), brief["id"]),
            )
        return record

    def structure_requirements(self, submitter):
        brief = self.get_current_brief()
        if not brief:
            raise ValueError("Save a project brief before requesting AI structuring")
        attachment_context = []
        for attachment in brief.get("attachments", []):
            extracted = self.extract_attachment_text(attachment)
            name = attachment.get("filename") or attachment["file_path"]
            if extracted:
                attachment_context.append({"filename": name, "extracted_text": extracted})
            else:
                attachment_context.append({
                    "filename": name,
                    "note": self.attachment_extraction_note(attachment, extracted),
                })
        api_key = self.openai_api_key()
        result = {
            "ai_available": bool(api_key),
            "status": "ok",
            "structured": {},
            "message": "",
        }
        if not api_key:
            result["status"] = "no_key"
            result["message"] = "OPENAI_API_KEY is not set."
            return result
        system_prompt = (
            "You convert a project owner's natural-language brief into structured requirements. "
            "Respond ONLY with JSON containing these keys: project_objective (string), scope (string), "
            "functional_requirements, non_functional_requirements, user_roles, user_workflows, business_rules, "
            "ui_ux_expectations, technical_considerations, constraints, assumptions, open_questions, "
            "acceptance_criteria (arrays of strings). "
            "Never invent missing facts. Put uncertainty in open_questions or assumptions. "
            "Do not silently fill gaps."
        )
        user_payload = {
            "title": brief.get("title"),
            "description": brief.get("description"),
            "workflow_notes": brief.get("workflow_notes"),
            "features_notes": brief.get("features_notes"),
            "additional_instructions": brief.get("additional_instructions"),
            "attachments": attachment_context,
        }
        parsed = self._call_openai_json(system_prompt, user_payload)
        if parsed:
            result["structured"] = parsed
            with self.connect() as conn:
                conn.execute(
                    """
                    UPDATE project_briefs
                    SET ai_structured_json = ?, status = 'processed', updated_at = ?
                    WHERE id = ?
                    """,
                    (json.dumps(parsed, sort_keys=True), now_iso(), brief["id"]),
                )
                self.audit(conn, "brief_structured", submitter, {"brief_id": brief["id"]})
        else:
            result["status"] = "error"
            result["message"] = "AI structuring failed. Edit requirements manually."
        return result

    def _call_openai_json(self, system_prompt, user_payload):
        api_key = self.openai_api_key()
        if not api_key:
            return None
        body = json.dumps({
            "model": self.config.get("openai_model", "gpt-4o-mini"),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }).encode("utf-8")
        base_url = self.config.get("openai_base_url", "https://api.openai.com/v1").rstrip("/")
        request = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            timeout = float(self.config.get("openai_timeout_seconds", 30))
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            return self._parse_ai_content(content)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError):
            return None

    def export_handoff_task(self, entry_id, actor):
        entry = self.get_handoff_entry(entry_id)
        baseline_sections = []
        active = self.active_baseline_snapshot(None)
        if active:
            record = self.get_record(active["record_id"]) if active.get("record_id") else None
            if record:
                payload = record.get("payload", {})
                for field in ("Project objective", "Scope", "Functional requirements", "Acceptance criteria"):
                    value = str(payload.get(field, "")).strip()
                    if value:
                        baseline_sections.append(f"### {field}\n{value}")
        instruction = entry.get("compact_instruction") or entry.get("ai_instruction") or entry.get("original_text")
        attachments = entry.get("attachments", [])
        attachment_lines = "\n".join(
            f"- `{Path(item['file_path']).name}`"
            for item in attachments
        ) or "- None"
        lines = [
            f"# Task: {entry['reference_id']} - {entry['title']}",
            "",
            "## Objective",
            instruction or entry.get("title", ""),
            "",
            "## Context",
            f"- Phase: {HANDOFF_PHASES.get(entry['phase'], entry['phase'])}",
            f"- Source page: {entry.get('source_page') or 'unspecified'}",
            f"- Priority: {entry.get('priority') or 'Medium'}",
            "",
            "## Relevant baseline sections",
            "\n".join(baseline_sections) if baseline_sections else "No approved baseline sections available.",
            "",
            "## User request",
            entry.get("original_text") or "",
            "",
            "## Expected result",
            str(entry.get("payload", {}).get("expected_result") or ""),
            "",
            "## Acceptance criteria",
            str(entry.get("payload", {}).get("acceptance_criteria") or ""),
            "",
            "## Attachments",
            attachment_lines,
            "",
            "## Constraints",
            "- Follow `AGENTS.md` and approved baseline.",
            "- Do not weaken audit, auth, or data-integrity controls.",
            "",
            "## Validation commands",
            "- Run applicable project lint, test, and build commands before completion.",
            "",
            f"## Status",
            entry.get("status", "pending"),
            "",
        ]
        self.tasks_path.mkdir(parents=True, exist_ok=True)
        task_path = self.tasks_path / f"{entry['reference_id']}.md"
        task_path.write_text("\n".join(lines), encoding="utf-8")
        with self.connect() as conn:
            self.audit(conn, "handoff_export", actor, {
                "reference_id": entry["reference_id"],
                "path": str(task_path.relative_to(PROJECT_ROOT)),
            })
        return {"path": str(task_path.relative_to(PROJECT_ROOT)), "reference_id": entry["reference_id"]}

    def recommend_workflow(self):
        brief = self.get_current_brief()
        if not brief or not (brief.get("description") or "").strip():
            return {"view": "brief", "label": "Describe your project in the Project Brief"}
        structured = brief.get("structured") or {}
        if brief.get("status") == "draft" or not structured:
            return {"view": "brief", "label": "Process your brief with AI to generate requirements"}
        baselines = self.list_records("baseline")
        approved = self.active_baseline_snapshot(None)
        if not baselines:
            return {"view": "baseline", "label": "Load AI requirements into the baseline for review"}
        current = baselines[0]
        if current.get("status") != "Approved" or not approved:
            return {"view": "baseline", "label": "Review and submit the approved baseline"}
        with self.connect() as conn:
            feedback_open = conn.execute(
                "SELECT COUNT(*) AS count FROM handoff_entries WHERE phase = 'feedback' AND status NOT IN ('completed', 'rejected')"
            ).fetchone()["count"]
            bugs_open = conn.execute(
                "SELECT COUNT(*) AS count FROM handoff_entries WHERE phase = 'bug' AND status NOT IN ('completed', 'rejected')"
            ).fetchone()["count"]
            handoff_open = conn.execute(
                "SELECT COUNT(*) AS count FROM handoff_entries WHERE status NOT IN ('completed', 'rejected')"
            ).fetchone()["count"]
        if feedback_open:
            return {"view": "feedback", "label": "Review or submit UI/UX feedback"}
        if bugs_open:
            return {"view": "bug", "label": "Document or triage debugging items"}
        if handoff_open:
            return {"view": "tasks", "label": "Review generated tasks for agent handoff"}
        return {"view": "dashboard", "label": "Workflow is up to date"}

    def recent_activity(self, limit=10):
        items = []
        with self.connect() as conn:
            audits = conn.execute(
                "SELECT event_type, actor, created_at, details_json FROM audit_events ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            handoffs = conn.execute(
                "SELECT reference_id, title, status, created_at FROM handoff_entries ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        for row in audits:
            items.append({
                "type": "audit",
                "label": row["event_type"],
                "detail": row["actor"],
                "created_at": row["created_at"],
            })
        for row in handoffs:
            items.append({
                "type": "handoff",
                "label": row["reference_id"],
                "detail": row["title"],
                "created_at": row["created_at"],
            })
        items.sort(key=lambda item: item["created_at"], reverse=True)
        return items[:limit]

    def dashboard(self):
        with self.connect() as conn:
            status_counts = [dict(row) for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM workflow_records GROUP BY status ORDER BY status"
            ).fetchall()]
            type_counts = [dict(row) for row in conn.execute(
                "SELECT record_type, COUNT(*) AS count FROM workflow_records GROUP BY record_type ORDER BY record_type"
            ).fetchall()]
            approved_baseline = conn.execute(
                "SELECT * FROM baseline_snapshots WHERE is_active = 1 ORDER BY snapshot_number DESC LIMIT 1"
            ).fetchone()
            open_revisions = conn.execute(
                "SELECT COUNT(*) AS count FROM workflow_records WHERE status = 'Needs Revision'"
            ).fetchone()["count"]
            deployment_ready = conn.execute(
                "SELECT COUNT(*) AS count FROM workflow_records WHERE record_type = 'deployment' AND status = 'Approved'"
            ).fetchone()["count"]
            maintenance_open = conn.execute(
                "SELECT COUNT(*) AS count FROM workflow_records WHERE record_type = 'maintenance' AND status != 'Completed'"
            ).fetchone()["count"]
            handoff_open = conn.execute(
                "SELECT COUNT(*) AS count FROM handoff_entries WHERE status NOT IN ('completed', 'rejected')"
            ).fetchone()["count"]
            feedback_open = conn.execute(
                "SELECT COUNT(*) AS count FROM handoff_entries WHERE phase = 'feedback' AND status NOT IN ('completed', 'rejected')"
            ).fetchone()["count"]
            bugs_open = conn.execute(
                "SELECT COUNT(*) AS count FROM handoff_entries WHERE phase = 'bug' AND status NOT IN ('completed', 'rejected')"
            ).fetchone()["count"]
            handoff_status_counts = [dict(row) for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM handoff_entries GROUP BY status ORDER BY status"
            ).fetchall()]
        brief = self.get_current_brief()
        baselines = self.list_records("baseline")
        recommendation = self.recommend_workflow()
        return {
            "status_counts": status_counts,
            "type_counts": type_counts,
            "approved_baseline": dict(approved_baseline) if approved_baseline else None,
            "open_revisions": open_revisions,
            "deployment_ready": deployment_ready,
            "maintenance_open": maintenance_open,
            "handoff_open": handoff_open,
            "feedback_open": feedback_open,
            "bugs_open": bugs_open,
            "handoff_status_counts": handoff_status_counts,
            "project_title": (brief or {}).get("title") or (baselines[0]["title"] if baselines else "New Project"),
            "baseline_status": baselines[0]["status"] if baselines else "Not started",
            "brief_status": (brief or {}).get("status") or "none",
            "recommended_view": recommendation["view"],
            "recommended_action": recommendation["label"],
            "recent_activity": self.recent_activity(),
        }


def parse_query(path):
    if "?" not in path:
        return path, {}
    clean_path, query = path.split("?", 1)
    params = {}
    for part in query.split("&"):
        if not part:
            continue
        if "=" in part:
            key, value = part.split("=", 1)
        else:
            key, value = part, ""
        params[urllib.parse.unquote_plus(key)] = urllib.parse.unquote_plus(value)
    return clean_path, params


class WorkflowHandler(http.server.BaseHTTPRequestHandler):
    store = None

    def log_message(self, format, *args):
        return

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def send_json(self, data, status=200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"error": message}, status)

    def send_bytes(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            path, query = parse_query(self.path)
            if path.startswith("/api/"):
                return self.handle_api_get(path, query)
            return self.serve_static(path)
        except Exception as error:
            self.send_error_json(str(error), 500)

    def do_POST(self):
        try:
            path, _query = parse_query(self.path)
            body = self.read_json()
            return self.handle_api_post(path, body)
        except Exception as error:
            self.send_error_json(str(error), 400)

    def do_PUT(self):
        try:
            path, _query = parse_query(self.path)
            body = self.read_json()
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[:2] == ["api", "records"]:
                result = self.store.create_version(
                    parts[2],
                    body.get("title", "Untitled"),
                    body.get("payload", {}),
                    body.get("submitter") or self.store.config.get("default_submitter", "Project Owner"),
                    body.get("status", "Draft"),
                )
                return self.send_json(result)
            self.send_error_json("Not found", 404)
        except Exception as error:
            self.send_error_json(str(error), 400)

    def handle_api_get(self, path, query):
        parts = path.strip("/").split("/")
        if path == "/api/config":
            return self.send_json({
                "statuses": STATUSES,
                "record_types": RECORD_TYPES,
                "field_definitions": FIELD_DEFINITIONS,
                "default_submitter": self.store.config.get("default_submitter", "Project Owner"),
                "handoff_phases": HANDOFF_PHASES,
                "handoff_statuses": HANDOFF_STATUSES,
                "feedback_categories": FEEDBACK_CATEGORIES,
                "priorities": PRIORITIES,
                "target_preview_url": self.store.config.get("target_preview_url", ""),
                "ai_available": bool(self.store.openai_api_key()),
            })
        if path == "/api/preview":
            body, content_type = self.store.fetch_preview(query.get("url", ""))
            return self.send_bytes(body, content_type)
        if path == "/api/settings":
            return self.send_json(self.store.get_settings())
        if path == "/api/handoff":
            return self.send_json(self.store.list_handoff_entries(query.get("phase"), query.get("status")))
        if len(parts) == 3 and parts[:2] == ["api", "handoff"]:
            return self.send_json(self.store.get_handoff_entry(parts[2]))
        if len(parts) == 4 and parts[:2] == ["api", "attachments"] and parts[3] == "file":
            body, content_type = self.store.get_attachment_file(parts[2])
            return self.send_bytes(body, content_type)
        if len(parts) == 4 and parts[:2] == ["api", "references"] and parts[3] == "file":
            body, content_type = self.store.get_reference_attachment_file(parts[2])
            return self.send_bytes(body, content_type)
        if path == "/api/brief":
            brief = self.store.get_current_brief()
            return self.send_json(brief or {})
        if path == "/api/dashboard":
            return self.send_json(self.store.dashboard())
        if path == "/api/records":
            return self.send_json(self.store.list_records(query.get("type")))
        if len(parts) == 3 and parts[:2] == ["api", "records"]:
            return self.send_json(self.store.get_record(parts[2]))
        if len(parts) == 4 and parts[:2] == ["api", "records"] and parts[3] == "versions":
            return self.send_json(self.store.list_versions(parts[2]))
        if path == "/api/comments":
            return self.send_json(self.store.list_comments(query.get("record_id")))
        if path == "/api/audit":
            return self.send_json(self.store.list_audit())
        if path == "/api/baselines":
            return self.send_json(self.store.list_baselines())
        self.send_error_json("Not found", 404)

    def handle_api_post(self, path, body):
        parts = path.strip("/").split("/")
        actor = body.get("submitter") or body.get("actor") or self.store.config.get("default_submitter", "Project Owner")
        if path == "/api/records":
            return self.send_json(self.store.create_record(
                body.get("record_type"),
                body.get("title", "Untitled"),
                body.get("payload", {}),
                actor,
                body.get("status", "Draft"),
            ), 201)
        if len(parts) == 4 and parts[:2] == ["api", "records"] and parts[3] == "submit":
            return self.send_json(self.store.set_status(parts[2], "For Review", actor, "submit_for_review"))
        if len(parts) == 4 and parts[:2] == ["api", "records"] and parts[3] == "decision":
            return self.send_json(self.store.decide(
                parts[2],
                body.get("decision", "Approved"),
                body.get("approver") or actor,
                body.get("notes", ""),
            ))
        if path == "/api/comments":
            return self.send_json(self.store.add_comment(
                body.get("record_id"),
                body.get("version_id"),
                body.get("author") or actor,
                body.get("comment_type", "Comment"),
                body.get("body", ""),
            ), 201)
        if len(parts) == 4 and parts[:2] == ["api", "baselines"] and parts[3] == "restore":
            return self.send_json(self.store.restore_baseline(parts[2], actor))
        if path == "/api/handoff":
            return self.send_json(self.store.create_handoff_entry(
                body.get("phase"),
                body.get("title", "Untitled"),
                body.get("payload", {}),
                actor,
                original_text=body.get("original_text", ""),
                ai_instruction=body.get("ai_instruction", ""),
                compact_instruction=body.get("compact_instruction", ""),
                category=body.get("category", ""),
                priority=body.get("priority", "Medium"),
                source_page=body.get("source_page", ""),
                elements=body.get("elements", []),
            ), 201)
        if len(parts) == 4 and parts[:2] == ["api", "handoff"] and parts[3] == "status":
            return self.send_json(self.store.update_handoff_status(parts[2], body.get("status"), actor))
        if len(parts) == 4 and parts[:2] == ["api", "handoff"] and parts[3] == "attachments":
            return self.send_json(self.store.save_attachment(
                parts[2],
                body.get("filename", ""),
                body.get("data", ""),
                body.get("annotation", ""),
                actor,
            ), 201)
        if path == "/api/ai/improve":
            return self.send_json(self.store.improve_text(
                body.get("phase", ""),
                body.get("kind", ""),
                body.get("text", ""),
                body.get("context"),
            ))
        if path == "/api/ai/structure-requirements":
            return self.send_json(self.store.structure_requirements(actor))
        if path == "/api/brief":
            return self.send_json(self.store.save_brief(body, actor))
        if len(parts) == 3 and parts[:2] == ["api", "brief"] and parts[2] == "attachments":
            brief = self.store.get_current_brief()
            if not brief:
                return self.send_error_json("Save the brief before attaching files", 400)
            return self.send_json(self.store.save_reference_attachment(
                "brief", brief["id"], body.get("filename", ""), body.get("data", ""),
                body.get("annotation", ""), actor,
            ), 201)
        if len(parts) == 3 and parts[:2] == ["api", "brief"] and parts[2] == "apply-baseline":
            return self.send_json(self.store.apply_brief_to_baseline(actor))
        if len(parts) == 4 and parts[:2] == ["api", "handoff"] and parts[3] == "export":
            return self.send_json(self.store.export_handoff_task(parts[2], actor))
        if path == "/api/settings":
            return self.send_json(self.store.update_settings(body))
        self.send_error_json("Not found", 404)

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"
        target = (STATIC_DIR / path.lstrip("/")).resolve()
        if STATIC_DIR not in target.parents and target != STATIC_DIR:
            return self.send_error(404)
        if not target.exists() or not target.is_file():
            return self.send_error(404)
        content_type = "text/plain"
        if target.suffix == ".html":
            content_type = "text/html; charset=utf-8"
        elif target.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif target.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def create_server():
    load_dotenv()
    config = load_config()
    store = WorkflowStore(config)
    store.initialize()
    WorkflowHandler.store = store
    return http.server.ThreadingHTTPServer((config["host"], int(config["port"])), WorkflowHandler)


if __name__ == "__main__":
    load_dotenv()
    config = load_config()
    server = create_server()
    print(f"Workflow app running at http://{config['host']}:{config['port']}")
    server.serve_forever()

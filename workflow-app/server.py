import datetime
import http.server
import json
import shutil
import sqlite3
import uuid
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
SCHEMA_PATH = APP_DIR / "database" / "schema.sql"
STATIC_DIR = APP_DIR / "static"

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
        "Requirements",
        "Scope and exclusions",
        "Technical requirements",
        "Constraints",
        "Deliverables",
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

    def initialize(self):
        (APP_DIR / "data").mkdir(parents=True, exist_ok=True)
        self.project_files_path.mkdir(parents=True, exist_ok=True)
        self.history_path.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

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
            self.create_baseline_snapshot(record_id, approver)
            result = self.get_record(record_id)
        return result

    def create_baseline_snapshot(self, record_id, actor):
        record = self.get_record(record_id)
        payload = record["payload"]
        markdown = self.render_baseline_markdown(record, payload)
        timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d%H%M%S")
        backups = self.history_path / "baseline-backups"
        backups.mkdir(parents=True, exist_ok=True)
        backup_path = backups / f"version-0-baseline.{timestamp}.bak.md"
        if self.baseline_path.exists():
            shutil.copy2(self.baseline_path, backup_path)
        else:
            backup_path.write_text("", encoding="utf-8")
        self.baseline_path.parent.mkdir(parents=True, exist_ok=True)
        self.baseline_path.write_text(markdown, encoding="utf-8")
        with self.connect() as conn:
            next_snapshot = conn.execute(
                "SELECT COALESCE(MAX(snapshot_number), 0) + 1 AS next_snapshot FROM baseline_snapshots"
            ).fetchone()["next_snapshot"]
            conn.execute("UPDATE baseline_snapshots SET is_active = 0")
            snapshot_id = new_id()
            conn.execute(
                """
                INSERT INTO baseline_snapshots
                  (id, record_id, version_id, snapshot_number, generated_markdown_path, backup_path, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    snapshot_id,
                    record_id,
                    record["current_version_id"],
                    next_snapshot,
                    str(self.baseline_path.relative_to(PROJECT_ROOT)),
                    str(backup_path.relative_to(PROJECT_ROOT)),
                    now_iso(),
                ),
            )
            self.audit(
                conn,
                "baseline_snapshot",
                actor,
                {"snapshot_number": next_snapshot, "baseline_path": str(self.baseline_path.relative_to(PROJECT_ROOT))},
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
            markdown = self.render_baseline_markdown(dict(record), payload)
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

    def render_baseline_markdown(self, record, payload):
        def value(key):
            return str(payload.get(key, "")).strip() or "[TBD]"

        generated = now_iso()
        return f"""# Version 0 - Baseline Project Definition

Baseline File:

```text
agent-history/version-0-baseline.md
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

# Project Objective

{value("Project objective")}

# Requirements

{value("Requirements")}

# Scope and Exclusions

{value("Scope and exclusions")}

# Technical Requirements

{value("Technical requirements")}

# Constraints

{value("Constraints")}

# Deliverables

{value("Deliverables")}

# Acceptance Criteria

{value("Acceptance criteria")}

# Reference Files

{value("Reference files")}

# Additional Instructions

{value("Additional instructions")}

# Baseline Approval

- Source record: `{record["id"]}`
- Source version: `{record["current_version_id"]}`
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
        return {
            "status_counts": status_counts,
            "type_counts": type_counts,
            "approved_baseline": dict(approved_baseline) if approved_baseline else None,
            "open_revisions": open_revisions,
            "deployment_ready": deployment_ready,
            "maintenance_open": maintenance_open,
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
        params[key] = value.replace("+", " ")
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
            })
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
    config = load_config()
    store = WorkflowStore(config)
    store.initialize()
    WorkflowHandler.store = store
    return http.server.ThreadingHTTPServer((config["host"], int(config["port"])), WorkflowHandler)


if __name__ == "__main__":
    config = load_config()
    server = create_server()
    print(f"Workflow app running at http://{config['host']}:{config['port']}")
    server.serve_forever()

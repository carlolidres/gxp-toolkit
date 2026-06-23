import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "database" / "schema.sql"


def main():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))

    tables = {
        row["name"]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    required = {
        "workflow_records",
        "workflow_versions",
        "comments",
        "approvals",
        "audit_events",
        "baseline_snapshots",
    }
    missing = required - tables
    if missing:
        raise AssertionError(f"Missing tables: {sorted(missing)}")

    record_id = "record-1"
    conn.execute(
        """
        INSERT INTO workflow_records
          (id, record_type, title, status, submitter, created_at, updated_at)
        VALUES (?, 'baseline', 'Baseline', 'Draft', 'Tester', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        """,
        (record_id,),
    )
    cursor = conn.execute(
        """
        INSERT INTO workflow_versions
          (record_id, version_number, status, payload_json, submitter, created_at)
        VALUES (?, 1, 'Draft', ?, 'Tester', '2026-01-01T00:00:00Z')
        """,
        (record_id, json.dumps({"Project objective": "Validate schema"})),
    )
    version_id = cursor.lastrowid
    conn.execute("UPDATE workflow_records SET current_version_id = ? WHERE id = ?", (version_id, record_id))
    conn.execute(
        """
        INSERT INTO approvals
          (id, record_id, version_id, decision, approver, notes, created_at)
        VALUES ('approval-1', ?, ?, 'Approved', 'Tester', 'ok', '2026-01-01T00:00:00Z')
        """,
        (record_id, version_id),
    )
    conn.execute(
        """
        INSERT INTO audit_events
          (id, record_id, version_id, event_type, actor, details_json, created_at)
        VALUES ('audit-1', ?, ?, 'approved', 'Tester', '{}', '2026-01-01T00:00:00Z')
        """,
        (record_id, version_id),
    )

    try:
        conn.execute("UPDATE workflow_versions SET status = 'Approved' WHERE id = ?", (version_id,))
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("workflow_versions update trigger did not fire")

    try:
        conn.execute("DELETE FROM audit_events WHERE id = 'audit-1'")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("audit_events delete trigger did not fire")

    fk_errors = conn.execute("PRAGMA foreign_key_check").fetchall()
    if fk_errors:
        raise AssertionError(f"Foreign key errors: {fk_errors}")

    print("PASS: workflow SQLite schema validates.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise

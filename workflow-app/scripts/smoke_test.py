import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(ROOT))

from server import WorkflowStore


def main():
    temp_dir = ROOT / "data" / "smoke-test"
    shutil.rmtree(temp_dir, ignore_errors=True)
    try:
        config = {
            "host": "127.0.0.1",
            "port": 8765,
            "database_path": "data/smoke-test/workflow.sqlite3",
            "project_files_path": "data/smoke-test/project-files",
            "baseline_path": "data/smoke-test/agent-history/version-0-baseline.md",
            "history_path": "data/smoke-test/agent-history",
            "default_submitter": "Smoke Tester",
        }
        store = WorkflowStore(config)
        store.initialize()
        record = store.create_record(
            "baseline",
            "Smoke baseline",
            {
                "Project objective": "Verify the reusable workflow app",
                "Requirements": "Create, approve, comment, restore",
                "Scope and exclusions": "Local smoke test only",
                "Technical requirements": "Python stdlib and SQLite",
                "Constraints": "No external dependencies",
                "Deliverables": "Working baseline approval",
                "Acceptance criteria": "Baseline markdown is written",
                "Reference files": "N/A",
                "Additional instructions": "N/A",
            },
            "Smoke Tester",
        )
        store.set_status(record["id"], "For Review", "Smoke Tester", "submit_for_review")
        approved = store.decide(record["id"], "Approved", "Smoke Tester", "Approved in smoke test")
        store.add_comment(approved["id"], approved["current_version_id"], "Smoke Tester", "Comment", "Looks good")
        revised = store.create_version(
            approved["id"],
            "Smoke baseline revision",
            {**approved["payload"], "Additional instructions": "Revision creates a draft"},
            "Smoke Tester",
        )
        snapshots = store.list_baselines()
        if len(snapshots) != 1:
            raise AssertionError("Expected one baseline snapshot")
        if not store.baseline_path.exists():
            raise AssertionError("Approved baseline markdown was not written")
        store.restore_baseline(snapshots[0]["id"], "Smoke Tester")
        dashboard = store.dashboard()
        if dashboard["approved_baseline"] is None:
            raise AssertionError("Dashboard did not report approved baseline")
        if revised["version_number"] != 2:
            raise AssertionError("Revision did not create version 2")
        if not store.list_comments(approved["id"]):
            raise AssertionError("Comment was not recorded")
        if not store.list_audit():
            raise AssertionError("Audit events were not recorded")
        print("PASS: workflow app smoke test completed.")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()

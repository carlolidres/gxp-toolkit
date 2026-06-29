import os
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(ROOT))

from server import WorkflowStore, extract_docx_text, extract_xlsx_text

ONE_PX_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def write_min_docx(path, text):
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("word/document.xml", document_xml)


def write_min_xlsx(path, text):
    shared_strings = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">'
        f"<si><t>{text}</t></si></sst>"
    )
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData>'
        "</worksheet>"
    )
    content_types = (
        '<?xml version="1.0"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        "</Types>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/sharedStrings.xml", shared_strings)
        archive.writestr("xl/worksheets/sheet1.xml", sheet)


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
            "handoff_queue_path": "data/smoke-test/agent-workflow/handoff-queue.md",
            "tasks_path": "data/smoke-test/agent-workflow/tasks",
            "attachments_path": "data/smoke-test/attachments",
            "default_submitter": "Smoke Tester",
        }
        store = WorkflowStore(config)
        store.initialize()
        brief = store.save_brief({
            "title": "Smoke project",
            "description": "Verify the reusable workflow app",
            "workflow_notes": "Brief to baseline to handoff",
            "features_notes": "Dashboard, brief, baseline, feedback, debugging",
            "additional_instructions": "Keep stdlib only",
        }, "Smoke Tester")
        if not brief or not brief.get("id"):
            raise AssertionError("Project brief was not saved")

        docx_path = temp_dir / "sample.docx"
        xlsx_path = temp_dir / "sample.xlsx"
        write_min_docx(docx_path, "Smoke docx requirement")
        write_min_xlsx(xlsx_path, "Smoke xlsx requirement")
        if "Smoke docx requirement" not in extract_docx_text(docx_path):
            raise AssertionError("DOCX text was not extracted")
        if "Smoke xlsx requirement" not in extract_xlsx_text(xlsx_path):
            raise AssertionError("XLSX text was not extracted")

        record = store.create_record(
            "baseline",
            "Smoke baseline",
            {
                "Project objective": "Verify the reusable workflow app",
                "Scope": "Local smoke test only",
                "Functional requirements": "Create, approve, comment, restore",
                "Non-functional requirements": "No external dependencies",
                "User roles": "Project owner",
                "User workflows": "Brief to baseline to handoff",
                "Business rules": "Preserve audit trail",
                "UI/UX expectations": "Simple navigation",
                "Technical considerations": "Python stdlib and SQLite",
                "Constraints": "No external dependencies",
                "Assumptions": "Local single user",
                "Open questions": "None",
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

        feedback = store.create_handoff_entry(
            "feedback",
            "Improve primary button contrast",
            {"description": "Button is hard to read", "expected_result": "WCAG AA contrast"},
            "Smoke Tester",
            original_text="Button is hard to read",
            category="Accessibility",
            priority="High",
            source_page="http://localhost:3000/",
            elements=[{
                "route": "http://localhost:3000/",
                "element_type": "button",
                "visible_text": "Save",
                "selector": '[data-testid="save"]',
                "attributes": {"role": "button"},
            }],
        )
        if not feedback["reference_id"].startswith("FB-"):
            raise AssertionError("Feedback reference id was not generated")
        if feedback["baseline_snapshot_id"] is None:
            raise AssertionError("Feedback was not linked to the active baseline snapshot")

        try:
            store.create_handoff_entry(
                "feedback",
                "Improve primary button contrast",
                {"description": "Button is hard to read"},
                "Smoke Tester",
                original_text="Button is hard to read",
                elements=[{"selector": '[data-testid="save"]', "route": "http://localhost:3000/"}],
            )
        except ValueError:
            pass
        else:
            raise AssertionError("Duplicate handoff entry was not blocked")

        attachment = store.save_attachment(feedback["id"], "shot.png", ONE_PX_PNG, "Button area")
        saved = store.get_handoff_entry(feedback["id"])
        if not saved["attachments"]:
            raise AssertionError("Attachment was not recorded")
        if not (ROOT / attachment["file_path"]).exists():
            raise AssertionError("Attachment file was not written")

        bug = store.create_handoff_entry(
            "bug",
            "Save button throws on empty form",
            {"description": "Console error on submit", "console_error": "TypeError: x is undefined"},
            "Smoke Tester",
            original_text="Console error on submit",
            priority="Critical",
            source_page="http://localhost:3000/form",
        )
        if not bug["reference_id"].startswith("BUG-"):
            raise AssertionError("Bug reference id was not generated")

        store.update_handoff_status(feedback["id"], "in_progress", "Smoke Tester")
        in_progress = store.get_handoff_entry(feedback["id"])
        if in_progress["status"] != "in_progress":
            raise AssertionError("Handoff status was not updated")

        if not store.handoff_queue_path.exists():
            raise AssertionError("Handoff queue markdown was not generated")
        queue_text = store.handoff_queue_path.read_text(encoding="utf-8")
        if feedback["reference_id"] not in queue_text or bug["reference_id"] not in queue_text:
            raise AssertionError("Handoff queue is missing submitted entries")

        os.environ.pop("OPENAI_API_KEY", None)
        ai_result = store.improve_text("feedback", "feedback", "make it nicer")
        if ai_result["ai_available"] or ai_result["status"] != "no_key":
            raise AssertionError("AI fallback did not report missing key")
        if ai_result["improved"] != "make it nicer":
            raise AssertionError("AI fallback did not preserve original input")

        settings = store.get_settings()
        if "ai_available" not in settings:
            raise AssertionError("Settings did not report AI availability")

        dashboard = store.dashboard()
        if dashboard["feedback_open"] < 1 or dashboard["bugs_open"] < 1:
            raise AssertionError("Dashboard did not count open handoff items")
        if dashboard.get("recommended_view") not in ("dashboard", "brief", "baseline", "feedback", "bug", "tasks"):
            raise AssertionError("Dashboard did not return a recommended view")

        exported = store.export_handoff_task(feedback["id"], "Smoke Tester")
        task_path = store.tasks_path / f"{feedback['reference_id']}.md"
        if not task_path.exists():
            raise AssertionError("Exported task file was not written")

        print("PASS: workflow app smoke test completed.")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()

# Version v[X] Handoff

Baseline Reference:

```text
agent-history/version-0-baseline.md
```

Version: `v[X]`
Date: `[YYYY-MM-DD]`
Status: `[DRAFT | COMPLETE | DEPLOYED | ROLLED_BACK]`
Prepared By: `[USER_OR_AGENT]`

## Objective

`[OBJECTIVE_OF_THIS_VERSION]`

## Scope of Changes

Included:

- `[CHANGE_1]`
- `[CHANGE_2]`
- `[CHANGE_3]`

Not included:

- `[EXCLUDED_ITEM_1]`
- `[EXCLUDED_ITEM_2]`

## Files Changed

| Path | Change |
|---|---|
| `[FILE_PATH_1]` | `[CHANGE_DESCRIPTION]` |
| `[FILE_PATH_2]` | `[CHANGE_DESCRIPTION]` |

## Business Rules

- Added: `[RULE_OR_NONE]`
- Changed: `[RULE_OR_NONE]`
- Removed: `[RULE_OR_NONE]`
- Baseline impact: `[NONE | APPROVED_BASELINE_CHANGE_REFERENCE]`

## Database and Migration

- Migration file: `[PATH_OR_NONE]`
- Schema impact: `[DESCRIPTION_OR_NONE]`
- Data migration: `[DESCRIPTION_OR_NONE]`
- RLS or permission impact: `[DESCRIPTION_OR_NONE]`
- Reconciliation result: `[RESULT_OR_NOT_APPLICABLE]`
- Rollback method: `[METHOD_OR_NOT_APPLICABLE]`

## Security and Compliance Impact

```text
[NONE | AUTHENTICATION | AUTHORIZATION | AUDIT | DATA_INTEGRITY | PRIVACY | OTHER]
```

Details:

`[DETAILS]`

## Verification Performed

| Check | Command or Method | Result |
|---|---|---|
| Lint | `[COMMAND]` | `[PASSED | FAILED | NOT_RUN]` |
| Type-check | `[COMMAND]` | `[PASSED | FAILED | NOT_RUN]` |
| Tests | `[COMMAND]` | `[PASSED | FAILED | NOT_RUN]` |
| Build | `[COMMAND]` | `[PASSED | FAILED | NOT_RUN]` |
| Smoke test | `[COMMAND_OR_METHOD]` | `[PASSED | FAILED | NOT_RUN]` |
| Manual verification | `[METHOD]` | `[PASSED | FAILED | NOT_RUN]` |

## Results

Implemented:

- `[IMPLEMENTED_RESULT_1]`
- `[IMPLEMENTED_RESULT_2]`

Not implemented:

- `[UNFINISHED_ITEM_OR_NONE]`

## Known Issues and Risks

| Severity | Issue or Risk | Impact | Recommended Action |
|---|---|---|---|
| `[SEVERITY]` | `[ISSUE]` | `[IMPACT]` | `[ACTION]` |

## Lessons Learned

- `[LESSON_1]`
- `[LESSON_2]`

## Git Traceability

- Branch: `[BRANCH]`
- Commit message: `[COMMIT_MESSAGE]`
- Commit hash: `[COMMIT_HASH]`
- Pull request: `[URL_OR_NOT_APPLICABLE]`

## Deployment

- Environment: `[ENVIRONMENT]`
- Status: `[NOT_DEPLOYED | DEPLOYED | FAILED | ROLLED_BACK]`
- Deployment reference: `[URL_OR_WORKFLOW_RUN]`
- Production URL: `[URL_OR_NOT_APPLICABLE]`
- Rollback reference: `[REFERENCE_OR_NOT_APPLICABLE]`

## Next Steps

1. `[NEXT_STEP_1]`
2. `[NEXT_STEP_2]`
3. `[NEXT_STEP_3]`

## Current Handoff Update

Confirm that the concise operational summary was updated at:

```text
agent-workflow/HANDOFF.md
```

## Reviewer Feedback

- Reviewers: `[REVIEWER_LIST]`
- Comments: `[COMMENTS]`

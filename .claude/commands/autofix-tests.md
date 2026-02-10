---
description: Autonomous test-fix pipeline - runs tests, classifies failures, iterates fixes until green
---

You are an autonomous test-fix pipeline. Your job is to get the test suite green by iterating through a structured detect-run-classify-fix loop. You operate methodically, prioritize correctly, and never break passing tests.

## Arguments

The user may pass: `$ARGUMENTS`

Parse these optional flags from the arguments:
- A **file path or glob pattern** to focus on specific tests (e.g., `src/utils/*.test.ts`)
- `--max-iterations N` to override the default max of 5 fix iterations
- `--dry-run` to only detect, run, and classify failures without applying fixes
- `--workspace <name>` to target a specific workspace in a monorepo

If no arguments are provided, run against the entire test suite with default settings.

---

## Phase 1: Detect Test Framework and Project Structure

Inspect the project root to determine the tech stack and test runner.

### Node.js / TypeScript Detection
1. Read `package.json` at the project root.
2. Check `scripts` for test commands. Look for:
   - `vitest` (preferred in known projects: HotshotTrucking, autoTradeDanelfin, Tci, DbConversion frontend)
   - `jest`
   - `mocha`
3. Check for monorepo indicators:
   - `workspaces` field in `package.json`
   - `pnpm-workspace.yaml`
   - `lerna.json`
   - `turbo.json`
4. If monorepo detected, map each workspace to its test command. If `--workspace` was specified, scope to that workspace only.

### Python Detection
1. Check for `pyproject.toml`, `pytest.ini`, `setup.cfg`, or `tox.ini`.
2. Look for pytest configuration sections.
3. Known Python projects: dax (pytest), DbConversion backend (pytest).

### Framework Summary
After detection, state clearly:
- **Language/Runtime**: Node.js / Python / other
- **Test Runner**: vitest / jest / mocha / pytest / other
- **Project Type**: monorepo / single-package
- **Test Command**: the exact command that will be used
- **Workspaces** (if monorepo): list each with its test command

---

## Phase 2: Run the Full Test Suite

Execute the test suite and capture all output.

### Execution Strategy
- **Single package Node.js**: Run `npm run test -- --reporter=verbose` or equivalent for the detected runner. For vitest, use `npx vitest run --reporter=verbose`. For jest, use `npx jest --verbose`.
- **Monorepo Node.js**: If a workspace is targeted, run tests only there. Otherwise run `npm run test --workspaces` or the turbo/lerna equivalent.
- **Python**: Run `python -m pytest -v --tb=long` to get verbose output with full tracebacks.

### Capture Requirements
- Capture both stdout and stderr.
- Note the total count of: passed, failed, skipped, errored tests.
- If the entire suite passes, report success and stop.
- If the test command itself fails to execute (missing dependencies, config error), report that as a Phase 2 blocker and suggest remediation.

---

## Phase 3: Parse and Classify Failures

Analyze every failing test and assign it to exactly one failure category.

### Failure Categories (in priority order)

**Priority 1 - Configuration Errors**
- Missing environment variables
- Bad test setup/teardown (beforeAll, beforeEach failures)
- Missing test fixtures or data files
- Database connection failures in test environment
- Signals: `ENOENT`, `ECONNREFUSED`, `env is not defined`, setup hook errors

**Priority 2 - Import/Module Errors**
- Missing modules (`Cannot find module`)
- Wrong import paths (`Module not found`)
- Circular dependency issues
- Missing exports from source files
- Signals: `ERR_MODULE_NOT_FOUND`, `ImportError`, `ModuleNotFoundError`, `Cannot find module`

**Priority 3 - Type Errors**
- TypeScript compilation errors in test or source
- Type mismatches in function arguments
- Missing or incorrect type annotations
- Signals: `TS2345`, `TS2322`, `TS2339`, `TypeError: ... is not a function` (when caused by wrong types)

**Priority 4 - Runtime Errors**
- Null/undefined reference errors
- Property access on undefined
- Unhandled exceptions in source code
- Signals: `TypeError: Cannot read properties of`, `ReferenceError`, `AttributeError`, `NoneType`

**Priority 5 - Timeout/Async Errors**
- Unresolved promises
- Test timeout exceeded
- Missing `await` keywords
- Signals: `Timeout`, `exceeded`, `ASYNC`, `did not resolve`, `open handles`

**Priority 6 - Assertion Failures**
- Wrong return values (logic bugs)
- Incorrect expected values in tests
- Missing or extra items in collections
- Signals: `AssertionError`, `expect(received).toBe(expected)`, `assert`, `toEqual`, `toMatchSnapshot`

### Classification Output
For each failing test, record:
- **Test file**: full path
- **Test name**: the `it`/`test`/`def test_` description
- **Category**: one of the six above
- **Error message**: the key error line
- **Stack trace hint**: the source file and line number implicated
- **Estimated fix location**: test file, source file, config file, or both

### Dry Run Stop Point
If `--dry-run` was specified, output the full classification report in a structured format and STOP here. Do not proceed to fixing.

---

## Phase 4: Prioritize and Plan Fixes

Group failures by category and plan the fix order.

### Prioritization Rules
1. Fix **Configuration** errors first. These often unblock entire suites.
2. Fix **Import/Module** errors next. A single missing export can cascade into dozens of failures.
3. Fix **Type** errors. TypeScript fixes often resolve multiple downstream failures.
4. Fix **Runtime** errors. These indicate real bugs in source code.
5. Fix **Timeout/Async** errors. These may need careful source or test changes.
6. Fix **Assertion** failures last. These are isolated logic issues.

### Within Each Category
- Fix errors in shared/utility files before domain-specific files.
- Fix errors that appear in multiple test files before single-occurrence errors.
- Prefer fixing the source file over the test file (see Safety Rules).

---

## Phase 5: Fix Loop

Execute the iterative fix cycle. Default max iterations: 5 (override with `--max-iterations`).

### Before Starting: Git Checkpoint
```
git stash push -m "autofix-tests-checkpoint-$(date +%s)" --include-untracked
git stash pop
```
This creates a recoverable checkpoint. If the working directory is dirty, stash and immediately pop so the stash entry exists as a backup.

Alternatively, if on a clean state, simply note the current HEAD commit hash as the rollback point.

### Change Log
Maintain a running log of every change made. For each change record:
- Iteration number
- File modified (absolute path)
- What was changed (brief description)
- Which failing test this addresses
- Whether the fix was in source code or test code

### Each Iteration

**Step 1: Select the next batch of failures**
Pick all failures from the highest-priority unfixed category. If there are more than 5 in a batch, take the 5 most impactful (most cascading) first.

**Step 2: For each failure in the batch**
1. Read the failing test file completely.
2. Read the source file(s) being tested completely.
3. Read any relevant shared utilities, types, or fixtures.
4. Determine the root cause.
5. Decide the fix: modify source, modify test setup (NOT assertions), or modify config.
6. Apply the fix using the Edit tool. Make minimal, targeted changes.
7. Run ONLY the affected test file to verify the fix:
   - Vitest: `npx vitest run <file>`
   - Jest: `npx jest <file>`
   - Pytest: `python -m pytest <file> -v`
8. If the single-file run passes, mark this failure as fixed and move on.
9. If it still fails, re-analyze. You get one retry per failure. If it fails twice, mark it as "needs human review" and move on.

**Step 3: After completing a batch**
Re-run the full test suite to check:
- Previously passing tests still pass (no regressions).
- Fixed tests remain green.
- Get updated failure count.

**Step 4: Assess progress**
- If all tests pass: STOP. Proceed to Phase 6 reporting.
- If failure count decreased: continue to next iteration.
- If failure count stayed the same or increased for 2 consecutive iterations: STOP. The remaining failures need human intervention. Proceed to Phase 6 reporting.
- If max iterations reached: STOP. Proceed to Phase 6 reporting.

**Step 5: Handle regressions**
If the full suite run reveals NEW failures (tests that were passing before):
- Immediately classify the new failures.
- If clearly caused by a fix just applied, revert that specific fix.
- Add the new failures to the queue with elevated priority.

---

## Phase 6: Report Results

Generate a comprehensive report.

### Summary Block
```
=== AUTOFIX-TESTS REPORT ===
Project: <project name>
Test Runner: <framework>
Iterations Used: N / max
Total Tests: X
Passing: Y (was Z before autofix)
Failing: A (was B before autofix)
Fixed: C tests across D files
```

### Fixed Tests
For each test that was fixed:
- Test name and file
- Failure category
- What was changed (source file, test file, or config)
- Brief description of the fix

### Still Failing
For each test still failing:
- Test name and file
- Failure category
- Why it could not be auto-fixed
- Suggested manual fix approach

### Skipped / Needs Human Review
For tests flagged for human review:
- Test name and file
- Reason it was flagged (ambiguous intent, complex refactor needed, etc.)

### Change Log
Full list of all file modifications made, in order, suitable for manual review or rollback.

### Rollback Instructions
If the fixes need to be undone:
```
git checkout -- <list of modified files>
```
Or if a stash checkpoint was created:
```
git stash list  # find the autofix-tests-checkpoint entry
git stash apply stash@{N}
```

---

## Safety Rules (MANDATORY)

These rules are non-negotiable. Violating them is worse than leaving a test failing.

1. **NEVER modify test assertions to match buggy source code.** If a test expects `calculateTotal(items)` to return `150` and the function returns `145`, fix the function, not the expected value. The test represents the specification.

2. **Exception to Rule 1**: If the test expectation is clearly wrong (e.g., a typo in the test, a copy-paste error, or the test was written against an outdated spec), you MAY update the test. But you MUST explicitly flag this in the report with your reasoning.

3. **NEVER delete or skip a failing test** to make the suite green. This defeats the purpose entirely.

4. **NEVER introduce new dependencies** without flagging it. If a fix requires a new package, report it as needing human approval.

5. **Preserve test intent.** If a test is checking a specific edge case or behavior, ensure your fix preserves that behavior. If you are unsure what the test intends, flag it for human review rather than guessing.

6. **Minimize blast radius.** Make the smallest change that fixes the failure. Do not refactor, reorganize, or "improve" code beyond what is needed for the fix.

7. **Do not touch passing tests.** Unless a passing test is masking a bug that causes another test to fail, leave passing tests untouched.

8. **Log everything.** Every file read, every change made, every test run. The user must be able to trace exactly what happened.

---

## Known Project Context

Use this context to make better decisions about project-specific patterns:

### Node.js / TypeScript (Vitest)
- **HotshotTrucking**: Monorepo. Transport/logistics domain. Likely has API route tests and service layer tests.
- **autoTradeDanelfin**: Monorepo. Trading automation. May have tests with mock API responses and time-sensitive logic.
- **Tci**: Monorepo. May have workspace-specific test configurations.
- **DbConversion frontend**: Single package. UI component tests and utility tests.

### Python (pytest)
- **dax**: Python project. Check for conftest.py fixtures and pytest plugins.
- **DbConversion backend**: Python backend. Likely has API endpoint tests and database migration tests.

### No Tests Yet
- **PPE**: No test infrastructure. If this project is targeted, report that no test framework was detected and suggest setting one up.

When working in these projects, respect their existing patterns for mocking, fixtures, test organization, and naming conventions.

---
description: Self-healing MSSQL-to-PostgreSQL translation - translates, validates, and self-corrects in a loop
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

---

## Self-Healing MSSQL-to-PostgreSQL Translation Pipeline

This command orchestrates a full translate-validate-fix loop that converts MSSQL (T-SQL) schema files to PostgreSQL, validates the output, and automatically corrects translation errors up to 10 times before flagging anything unresolvable for human review.

---

### Phase 0: Resolve Input Target

Determine which SQL file(s) to process:

1. If `$ARGUMENTS` is **non-empty**, treat it as a file path or directory path.
   - If it points to a single `.sql` file, process that file.
   - If it points to a directory, collect **all** `.sql` files in that directory (non-recursive) for batch processing.
2. If `$ARGUMENTS` is **empty**, look for `.sql` files in the **project root** (`/e/AI_Development/Alitho/DbConversion/`).
   - Present the discovered files and ask the user which to translate, or offer "all".
   - Known project SQL files: `GPMGT.sql`, `schemaBad.sql`, `schemaNEW.sql`, `skippedtables.sql`.
   - Exclude any file that already ends with `.pg.sql` (previously translated output).

For each file selected, run Phases 1 through 4 sequentially. Track a **per-file** report and a **batch summary** at the end.

---

### Phase 1: Translation

For each input file, perform the MSSQL-to-PostgreSQL translation.

#### Strategy A: Use the Project Backend (preferred when running inside the DbConversion project)

The project has a full translation pipeline. Use it via the CLI entry point:

```bash
cd /e/AI_Development/Alitho/DbConversion
python cli_schema_translate.py --input <INPUT_FILE> --schema-out <INPUT_NAME>.pg.sql --skipped-out <INPUT_NAME>.skipped.sql
```

This invokes:
- `backend/src/parsers/mssql_parser.py` -- MSSQLParser to parse the source
- `backend/src/translators/translator.py` -- SQLGlotTranslator with `source_db=MSSQL`, `target_db=POSTGRESQL`
- `backend/src/generators/postgresql_generator.py` -- PostgreSQLGenerator for output
- `backend/src/translators/rules/data_types.py` -- MSSQL_TO_POSTGRES type mapping

If the CLI script fails or is unavailable, fall back to Strategy B.

#### Strategy B: Direct SQLGlot Translation (standalone / fallback)

Read the SQL file content and translate using SQLGlot directly:

```python
import sqlglot
from sqlglot.errors import ParseError

sql_content = open("<INPUT_FILE>").read()

# Split on GO statements (MSSQL batch separator)
import re
batches = re.split(r'^\s*GO\s*$', sql_content, flags=re.MULTILINE | re.IGNORECASE)

translated_statements = []
errors = []

for i, batch in enumerate(batches):
    batch = batch.strip()
    if not batch or batch.startswith('--'):
        # Preserve comments and blank batches
        if batch:
            translated_statements.append(batch)
        continue
    try:
        results = sqlglot.transpile(batch, read="tsql", write="postgres", pretty=True)
        for result in results:
            translated_statements.append(result + ";")
    except ParseError as e:
        errors.append({"batch": i, "sql": batch[:200], "error": str(e)})
        # Preserve as comment so nothing is silently dropped
        translated_statements.append(f"-- [TRANSLATION ERROR] Batch {i}: {str(e)}\n-- Original SQL:\n/*\n{batch}\n*/")
```

Write the combined output to `<INPUT_NAME>.pg.sql`.

#### Post-Translation Fixups (apply regardless of strategy)

After initial translation, apply these known MSSQL-to-PG corrections to the output file. These address issues that SQLGlot and the project generator sometimes miss:

| MSSQL Construct | PostgreSQL Equivalent | Regex / Replacement |
|---|---|---|
| `[identifier]` | `identifier` (lowercase, unquoted) | `\[([^\]]+)\]` -> lowercase, underscores for spaces |
| `dbo.` / `[dbo].` | `public.` or remove | `\[?dbo\]?\.` -> `public.` |
| `NVARCHAR(n)` | `VARCHAR(n)` | Already handled by type map but verify |
| `NCHAR(n)` | `CHAR(n)` | Already handled by type map but verify |
| `NVARCHAR(MAX)` / `VARCHAR(MAX)` | `TEXT` | Check for leftover `MAX` |
| `DATETIME` / `DATETIME2` | `TIMESTAMP` | Already handled but verify |
| `BIT` | `BOOLEAN` | Already handled but verify |
| `UNIQUEIDENTIFIER` | `UUID` | Already handled but verify |
| `IDENTITY(seed,increment)` | `SERIAL` / `BIGSERIAL` / `GENERATED ALWAYS AS IDENTITY` | Check for leftover IDENTITY syntax |
| `TOP N` | `LIMIT N` (moved to end of SELECT) | `SELECT\s+TOP\s+(\d+)` -> `SELECT ... LIMIT \1` |
| `GETDATE()` | `NOW()` or `CURRENT_TIMESTAMP` | Case-insensitive replace |
| `ISNULL(a, b)` | `COALESCE(a, b)` | `\bISNULL\s*\(` -> `COALESCE(` |
| `NEWID()` | `gen_random_uuid()` | Direct replace |
| `GO` batch separators | Remove entirely | `^\s*GO\s*$` -> remove |
| `SET ANSI_NULLS ON` etc. | Remove (PG does not use) | `^\s*SET\s+(ANSI_NULLS|QUOTED_IDENTIFIER|NOCOUNT).*$` -> remove |
| `EXEC` / `EXECUTE` | Direct call or `CALL` | Context-dependent |
| `@@IDENTITY` | `lastval()` | Direct replace |
| `@@ROWCOUNT` | `ROW_COUNT` (in PL/pgSQL: `GET DIAGNOSTICS count = ROW_COUNT`) | Flag for review |
| `PRINT` | `RAISE NOTICE` | `PRINT\s+(.+)` -> `RAISE NOTICE '%', \1;` |
| `@variable` | Prefix with underscore `_variable` (PL/pgSQL convention) | `@(\w+)` -> `_\1` |
| Computed columns `AS (expr) PERSISTED` | `GENERATED ALWAYS AS (expr) STORED` | Pattern match and transform |
| `WITH (PAD_INDEX = ...)` index options | Remove (PG does not support) | `\bWITH\s*\([^)]*PAD_INDEX[^)]*\)` -> remove |
| `ON [PRIMARY]` / `ON [filegroup]` | Remove (PG does not use filegroups) | `\bON\s+\[?\w+\]?\s*$` at end of CREATE TABLE -> remove |
| `TEXTIMAGE_ON` | Remove | Strip entirely |
| `CLUSTERED` / `NONCLUSTERED` on indexes | Remove keyword (PG uses different syntax) | `\b(NON)?CLUSTERED\b` -> remove |
| `ASC` / `DESC` in PK definitions | Keep (valid in PG) | No change needed |
| `CONSTRAINT [name]` with brackets | Clean bracket syntax | Already handled by identifier cleanup |

---

### Phase 2: Validation

Run a multi-layer validation on the translated output.

#### Layer 1: SQLGlot Parse Check

```python
import sqlglot

with open("<OUTPUT_FILE>") as f:
    pg_sql = f.read()

# Split into individual statements
statements = sqlglot.parse(pg_sql, read="postgres")
parse_errors = []
valid_count = 0

for i, stmt in enumerate(statements):
    if stmt is None:
        parse_errors.append({"index": i, "error": "Null parse result"})
    else:
        valid_count += 1
```

If `sqlglot.parse` itself throws, catch the exception and record which portion of the SQL caused the failure.

#### Layer 2: psql Syntax Check (optional, if psql is available)

```bash
# Check if psql is available
which psql 2>/dev/null

# If available and a test database is configured:
psql -d postgres -c "\i <OUTPUT_FILE>" --set ON_ERROR_STOP=on 2>&1
# Capture stderr for error messages
```

If `psql` is not available, skip this layer and note it in the report. Do NOT fail the pipeline for missing psql.

#### Layer 3: Pattern-Based Issue Detection

Scan the translated output for residual MSSQL patterns that should not appear in valid PostgreSQL:

```python
import re

residual_patterns = {
    "Square brackets": r"\[[A-Za-z_]\w*\]",
    "GO statement": r"^\s*GO\s*$",
    "IDENTITY keyword": r"\bIDENTITY\s*\(\d+\s*,\s*\d+\)",
    "GETDATE()": r"\bGETDATE\s*\(\)",
    "ISNULL()": r"\bISNULL\s*\(",
    "NEWID()": r"\bNEWID\s*\(\)",
    "NVARCHAR": r"\bNVARCHAR\b",
    "NCHAR": r"\bNCHAR\b",
    "DATETIME2": r"\bDATETIME2\b",
    "TOP N": r"\bSELECT\s+TOP\s+\d+",
    "SET ANSI_NULLS": r"\bSET\s+ANSI_NULLS\b",
    "SET QUOTED_IDENTIFIER": r"\bSET\s+QUOTED_IDENTIFIER\b",
    "SET NOCOUNT": r"\bSET\s+NOCOUNT\b",
    "dbo. schema": r"\bdbo\.",
    "@@IDENTITY": r"@@IDENTITY",
    "@@ROWCOUNT": r"@@ROWCOUNT",
    "EXEC/EXECUTE": r"\bEXEC(UTE)?\s+",
    "CLUSTERED": r"\b(NON)?CLUSTERED\b",
    "ON PRIMARY": r"\bON\s+\[?PRIMARY\]?",
    "TEXTIMAGE_ON": r"\bTEXTIMAGE_ON\b",
    "WITH PAD_INDEX": r"\bWITH\s*\([^)]*PAD_INDEX",
    "UNIQUEIDENTIFIER": r"\bUNIQUEIDENTIFIER\b",
}

issues = {}
for name, pattern in residual_patterns.items():
    matches = re.findall(pattern, pg_sql, re.MULTILINE | re.IGNORECASE)
    if matches:
        issues[name] = len(matches)
```

Collect all issues from all three layers into a unified issue list.

---

### Phase 3: Self-Correction Loop

**Maximum 10 iterations.** Each iteration attempts to fix one or more issues found in Phase 2.

```
correction_log = []
max_iterations = 10
stuck_counter = {}  # Track how many times each error pattern recurs

for iteration in range(1, max_iterations + 1):
    # Re-run validation (Phase 2)
    issues = validate(output_file)

    if not issues:
        # All clean
        break

    for issue_name, issue_details in issues.items():
        # Check if we are stuck on this issue
        stuck_counter[issue_name] = stuck_counter.get(issue_name, 0) + 1

        if stuck_counter[issue_name] > 2:
            # Flag for human review, stop trying to fix this one
            correction_log.append({
                "iteration": iteration,
                "issue": issue_name,
                "action": "FLAGGED FOR HUMAN REVIEW - fix attempted twice without resolution",
                "details": issue_details,
            })
            continue

        # Apply targeted fix
        fix_applied = apply_fix(output_file, issue_name, issue_details)
        correction_log.append({
            "iteration": iteration,
            "issue": issue_name,
            "action": fix_applied,
        })
```

#### Fix Application Rules

When applying fixes, use **targeted regex replacements** on the output file. NEVER rewrite the entire file from scratch. Each fix should be surgical:

1. **Read the current file content**
2. **Apply the specific regex** for the identified issue (see the table in Phase 1)
3. **Write back** only if the content actually changed
4. **Log exactly what changed** (line numbers, before/after snippets)

If a fix introduces NEW errors (detected on the next validation pass), **revert that fix** and flag it for human review.

#### Critical Safety Rules for Self-Correction

- **NEVER silently drop SQL statements.** If a statement cannot be fixed, wrap it in a comment block with an explanation:
  ```sql
  -- [AUTOFIX: UNABLE TO TRANSLATE] Original MSSQL construct could not be converted.
  -- Reason: <specific reason>
  -- Please manually review and convert:
  /*
  <original SQL>
  */
  ```
- **Preserve ALL comments** from the original source file.
- **NEVER modify the original input file.** All changes go to the `.pg.sql` output only.
- **Track every modification** with before/after pairs for the diff report.

---

### Phase 4: Output and Reporting

After the correction loop completes (either all issues resolved or max iterations reached), generate the final deliverables.

#### File Outputs

For each input file `<name>.sql`:

| Output File | Contents |
|---|---|
| `<name>.pg.sql` | The final corrected PostgreSQL translation |
| `<name>.skipped.sql` | Tables/objects that could not be translated (from Strategy A) |
| `<name>.translation-report.md` | Full translation report (see below) |
| `<name>.translation.diff` | Diff between initial translation and final corrected version |

#### Generate the Diff

```bash
# Compare the initial translation (before corrections) to the final version
diff -u <name>.pg.initial.sql <name>.pg.sql > <name>.translation.diff
```

To enable this, **save a copy of the initial translation** before entering the correction loop:
```bash
cp <name>.pg.sql <name>.pg.initial.sql
```

After the diff is generated, the `.pg.initial.sql` file can be deleted (or kept, per user preference).

#### Translation Report Format

Write `<name>.translation-report.md` with the following structure:

```markdown
# Translation Report: <filename>

**Source**: <input file path>
**Target**: <output file path>
**Date**: <timestamp>
**Strategy Used**: Backend CLI / Direct SQLGlot

## Summary

| Metric | Value |
|---|---|
| Total statements in source | <count> |
| Successfully translated | <count> |
| Fixed by self-correction | <count> |
| Flagged for human review | <count> |
| Skipped (untranslatable) | <count> |
| Translation confidence | <percentage>% |

## Confidence Score Calculation

Confidence = (successfully_translated + fixed_by_correction) / total_statements * 100

- 95-100%: High confidence -- review recommended but likely production-ready
- 80-94%: Medium confidence -- targeted manual review needed
- Below 80%: Low confidence -- significant manual review required

## Corrections Applied

| Iteration | Issue | Fix Applied | Lines Affected |
|---|---|---|---|
| 1 | Square brackets found | Removed brackets, lowercased identifiers | 12, 45, 67 |
| 2 | GETDATE() residual | Replaced with CURRENT_TIMESTAMP | 89 |
| ... | ... | ... | ... |

## Items Flagged for Human Review

### 1. <Issue Title>
- **Location**: Line <n>
- **Original SQL**:
  ```sql
  <original construct>
  ```
- **Reason**: <why automated fix failed>
- **Suggested fix**: <if possible, suggest what the human should do>

## Data Type Mappings Applied

| MSSQL Type | PostgreSQL Type | Occurrences |
|---|---|---|
| NVARCHAR(n) | VARCHAR(n) | 45 |
| BIT | BOOLEAN | 12 |
| DATETIME | TIMESTAMP | 23 |
| ... | ... | ... |

## Skipped Tables

| Table Name | Reason Category | Reason |
|---|---|---|
| <name> | parse_error | <details> |
| ... | ... | ... |
```

---

### Batch Mode Summary

If multiple files were processed, after all individual reports, generate a **batch summary**:

```markdown
# Batch Translation Summary

| File | Statements | Translated | Fixed | Flagged | Confidence |
|---|---|---|---|---|---|
| GPMGT.sql | 150 | 142 | 5 | 3 | 98% |
| schemaBad.sql | 80 | 60 | 10 | 10 | 87.5% |
| ... | ... | ... | ... | ... | ... |
| **TOTAL** | **230** | **202** | **15** | **13** | **94.3%** |
```

---

### Important Behavioral Rules

1. **Be verbose during execution.** Report each phase as you enter it, each file as you process it, each fix as you apply it.
2. **Ask before overwriting.** If a `.pg.sql` output file already exists, ask the user whether to overwrite or create a versioned copy (e.g., `.pg.v2.sql`).
3. **Use the project's existing infrastructure first.** The DbConversion backend has battle-tested parsers, generators, and type mappings. Only fall back to raw SQLGlot when the backend is unavailable.
4. **Respect the project's conventions.** The project uses `public.` schema prefix for PostgreSQL output, lowercase unquoted identifiers, and SERIAL for identity columns. Follow these conventions.
5. **Do not hallucinate SQL.** If you are unsure about a translation, flag it for human review rather than guessing.
6. **Preserve execution order.** PostgreSQL is sensitive to object creation order (e.g., tables referenced by foreign keys must exist first). Maintain or fix the order.
7. **Handle encoding.** Read and write all files as UTF-8.

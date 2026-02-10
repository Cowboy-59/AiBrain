---
description: Run the full speckit pipeline: specify → clarify → plan → tasks in one command
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Speckit Pipeline Orchestrator

This command orchestrates the full speckit specification workflow in a single session. The user typed their feature description after `/speckit.pipeline`. The pipeline runs four phases sequentially, with interactive checkpoints between each phase.

**Pipeline**: Specify → Clarify → Plan → Tasks

---

## Pre-Flight Validation

Before starting any phase, validate the input:

1. **Check for empty arguments**: If `$ARGUMENTS` is empty or only whitespace, immediately halt with:
   ```
   ERROR: No feature description provided.

   Usage: /speckit.pipeline <feature description>

   Example: /speckit.pipeline Add user authentication with OAuth2 and JWT tokens

   The feature description should be a natural language description of the feature
   you want to specify, plan, and decompose into tasks.
   ```
   Do NOT proceed further.

2. **Parse skip directives**: Check if `$ARGUMENTS` contains any skip directives before the feature description. Supported patterns (case-insensitive):
   - `--skip-clarify` or `--skip clarify` : Skip Phase 2 (Clarify)
   - `--skip-plan` or `--skip plan` : Skip Phase 3 (Plan) AND Phase 4 (Tasks, since tasks depend on plan)
   - `--skip-tasks` or `--skip tasks` : Skip Phase 4 (Tasks)
   - Multiple skips can be combined: `--skip-clarify --skip-tasks <description>`

   Strip skip directives from the arguments before passing the remaining text as the feature description.

3. **Extract the feature description**: After removing any skip directives, the remaining text is the feature description. If the remaining text is empty after stripping directives, halt with the same error as step 1.

---

## Phase Tracking

Maintain an internal pipeline state throughout execution:

```
Pipeline State:
  Phase 1 (Specify):  [pending | in_progress | completed | failed | skipped]
  Phase 2 (Clarify):  [pending | in_progress | completed | failed | skipped]
  Phase 3 (Plan):     [pending | in_progress | completed | failed | skipped]
  Phase 4 (Tasks):    [pending | in_progress | completed | failed | skipped]

  Feature Description: <extracted from arguments>
  Branch Name: <set after Phase 1>
  Feature Directory: <set after Phase 1>
  Spec File: <set after Phase 1>
  Artifacts Created: <accumulated list>
  Current Phase: <1-4>
  Skip Directives: <list of phases to skip>
```

---

## Phase 1: Specify

**Goal**: Create the feature branch, spec file, quality checklist, and initial specification from the user's feature description.

**Execute the full `/speckit.specify` workflow**:

This phase runs the identical logic defined in the `speckit.specify` command. Specifically:

1. **Generate a concise short name** (2-4 words) for the branch from the feature description. Use action-noun format when possible (e.g., "add-user-auth", "fix-payment-bug"). Preserve technical terms and acronyms.

2. **Check for existing branches before creating new one**:
   a. Fetch all remote branches: `git fetch --all --prune`
   b. Find the highest feature number across remote branches, local branches, and `specs/` directories for the short-name.
   c. Determine the next available number (N+1, or 1 if none found).
   d. Run `.specify/scripts/powershell/create-new-feature.ps1 -Json "<feature description>"` with the calculated number and short-name.
   e. Parse the JSON output for BRANCH_NAME and SPEC_FILE.

3. **Load the spec template** at `.specify/templates/spec-template.md`.

4. **Generate the specification** following the specify workflow execution flow:
   - Parse feature description, extract key concepts (actors, actions, data, constraints).
   - Make informed guesses for unclear aspects; only mark with `[NEEDS CLARIFICATION]` for critical decisions (max 3 markers).
   - Fill User Scenarios & Testing, Functional Requirements, Success Criteria, Key Entities.
   - Write the specification to SPEC_FILE.

5. **Create and run the Spec Quality Checklist** at `FEATURE_DIR/checklists/requirements.md`:
   - Validate content quality, requirement completeness, feature readiness.
   - If items fail (excluding `[NEEDS CLARIFICATION]`): update spec and re-validate (max 3 iterations).
   - If `[NEEDS CLARIFICATION]` markers remain: present clarification questions to the user with options tables and wait for responses. Update the spec with answers.

6. **Record artifacts**: Store BRANCH_NAME, SPEC_FILE, FEATURE_DIR, and checklist path in pipeline state.

### Phase 1 Completion Report

After Phase 1 completes, report:

```
---------------------------------------------------
PIPELINE PHASE 1 COMPLETE: Specify
---------------------------------------------------
Branch:     <branch name>
Spec File:  <absolute path to spec.md>
Checklist:  <absolute path to requirements.md>
Feature Dir: <absolute path to feature directory>
Status:     SUCCESS
---------------------------------------------------
```

Then ask the user:

```
Phase 2 (Clarify) is next. This will analyze the spec for ambiguities and ask
up to 5 targeted clarification questions to strengthen the specification.

Options:
  - "continue" or "next"  : Proceed to Phase 2 (Clarify)
  - "skip"                : Skip Clarify, proceed to Phase 3 (Plan)
  - "stop" or "done"      : Halt pipeline here
```

Wait for user response before proceeding. If the user previously set `--skip-clarify`, report that Phase 2 is being skipped and move directly to Phase 3 (still ask about continuing to Phase 3).

---

## Phase 2: Clarify

**Goal**: Detect and reduce ambiguity in the spec by asking up to 5 targeted clarification questions and encoding answers back into the spec.

**Execute the full `/speckit.clarify` workflow**:

This phase runs the identical logic defined in the `speckit.clarify` command. Specifically:

1. **Setup**: Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly` from repo root. Parse JSON for FEATURE_DIR, FEATURE_SPEC. If parsing fails, report the failure and halt the pipeline.

2. **Load the current spec** and perform a structured ambiguity & coverage scan using the full taxonomy:
   - Functional Scope & Behavior
   - Domain & Data Model
   - Interaction & UX Flow
   - Non-Functional Quality Attributes
   - Integration & External Dependencies
   - Edge Cases & Failure Handling
   - Constraints & Tradeoffs
   - Terminology & Consistency
   - Completion Signals
   - Misc / Placeholders

   For each category, mark status: Clear / Partial / Missing. Produce an internal coverage map.

3. **Generate prioritized clarification questions** (max 5):
   - Each question must be answerable with multiple-choice (2-5 options) OR short answer (<=5 words).
   - Only include questions whose answers materially impact architecture, data modeling, task decomposition, test design, UX behavior, operational readiness, or compliance validation.
   - Provide a recommended option with reasoning for each question.

4. **Sequential questioning loop (INTERACTIVE)**:
   - Present ONE question at a time with recommended option and options table.
   - Wait for user answer before presenting next question.
   - If user replies "yes" or "recommended", use the stated recommendation.
   - Stop when: all critical ambiguities resolved, user signals "done"/"stop"/"no more", or 5 questions asked.
   - If no valid questions exist: report "No critical ambiguities detected" and proceed.

5. **Integrate answers into spec** after each accepted answer:
   - Maintain `## Clarifications` section with `### Session YYYY-MM-DD` subheading.
   - Apply each clarification to the most appropriate spec section.
   - Save spec after each integration.

6. **Validate** after each write: no duplicates, no lingering vague placeholders, consistent terminology.

7. **Write updated spec** back to FEATURE_SPEC.

### Phase 2 Completion Report

After Phase 2 completes, report:

```
---------------------------------------------------
PIPELINE PHASE 2 COMPLETE: Clarify
---------------------------------------------------
Questions Asked:    <N>
Questions Answered: <N>
Spec Updated:       <absolute path>
Sections Touched:   <list of section names>
Coverage Summary:
  - Resolved:    <count> categories
  - Clear:       <count> categories
  - Deferred:    <count> categories
  - Outstanding: <count> categories
Status:            SUCCESS
---------------------------------------------------
```

Then ask the user:

```
Phase 3 (Plan) is next. This will generate the implementation plan including
research.md, data-model.md, API contracts, and quickstart.md.

Options:
  - "continue" or "next"  : Proceed to Phase 3 (Plan)
  - "skip"                : Skip Plan (this also skips Tasks since they depend on the plan)
  - "stop" or "done"      : Halt pipeline here
```

Wait for user response before proceeding.

---

## Phase 3: Plan

**Goal**: Generate the implementation plan with design artifacts (research.md, data-model.md, contracts, quickstart.md).

**Execute the full `/speckit.plan` workflow**:

This phase runs the identical logic defined in the `speckit.plan` command. Specifically:

1. **Setup**: Run `.specify/scripts/powershell/setup-plan.ps1 -Json` from repo root. Parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. This copies the plan template and prepares the feature directory.

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load the IMPL_PLAN template (already copied by setup script).

3. **Execute plan workflow** following the IMPL_PLAN template structure:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION").
   - Fill Constitution Check section from constitution.
   - Evaluate gates (ERROR if violations unjustified).
   - **Phase 0**: Generate `research.md` -- resolve all NEEDS CLARIFICATION items through research.
   - **Phase 1**: Generate `data-model.md`, `contracts/`, `quickstart.md`.
   - **Phase 1**: Update agent context by running `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude`.
   - Re-evaluate Constitution Check post-design.

4. **Record artifacts**: Add plan.md, research.md, data-model.md, contracts/, quickstart.md to pipeline state.

### Phase 3 Completion Report

After Phase 3 completes, report:

```
---------------------------------------------------
PIPELINE PHASE 3 COMPLETE: Plan
---------------------------------------------------
Branch:        <branch name>
Plan File:     <absolute path to plan.md>
Research:      <absolute path to research.md>
Data Model:    <absolute path to data-model.md>
Contracts:     <absolute path to contracts/>
Quickstart:    <absolute path to quickstart.md>
Agent Context: Updated
Status:        SUCCESS
---------------------------------------------------
```

Then ask the user:

```
Phase 4 (Tasks) is next. This will generate the dependency-ordered task list
(tasks.md) based on all the design artifacts created so far.

Options:
  - "continue" or "next"  : Proceed to Phase 4 (Tasks)
  - "stop" or "done"      : Halt pipeline here
```

Wait for user response before proceeding.

---

## Phase 4: Tasks

**Goal**: Generate the actionable, dependency-ordered task list based on all available design artifacts.

**Execute the full `/speckit.tasks` workflow**:

This phase runs the identical logic defined in the `speckit.tasks` command. Specifically:

1. **Setup**: Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json` from repo root. Parse FEATURE_DIR and AVAILABLE_DOCS list.

2. **Load design documents** from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities).
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios).

3. **Execute task generation workflow**:
   - Extract tech stack, libraries, project structure from plan.md.
   - Extract user stories with priorities (P1, P2, P3) from spec.md.
   - Map entities from data-model.md and endpoints from contracts/ to user stories.
   - Extract decisions from research.md for setup tasks.
   - Generate tasks organized by user story following the strict checklist format:
     ```
     - [ ] [TaskID] [P?] [Story?] Description with file path
     ```
   - Generate dependency graph and parallel execution examples.
   - Validate task completeness.

4. **Generate tasks.md** using `.specify/templates/tasks-template.md` as structure:
   - Phase 1: Setup tasks (project initialization).
   - Phase 2: Foundational tasks (blocking prerequisites).
   - Phase 3+: One phase per user story (in priority order).
   - Final Phase: Polish & cross-cutting concerns.
   - Dependencies section, parallel execution examples, implementation strategy.

5. **Record artifacts**: Add tasks.md to pipeline state.

### Phase 4 Completion Report

After Phase 4 completes, report:

```
---------------------------------------------------
PIPELINE PHASE 4 COMPLETE: Tasks
---------------------------------------------------
Tasks File:      <absolute path to tasks.md>
Total Tasks:     <count>
Tasks per Story: <breakdown>
Parallel Opps:   <count of parallelizable tasks>
Suggested MVP:   <scope recommendation>
Status:          SUCCESS
---------------------------------------------------
```

---

## Final Pipeline Report

After all phases complete (or the user halts the pipeline), produce a comprehensive final report:

```
===================================================
SPECKIT PIPELINE COMPLETE
===================================================

Feature:        <feature description (first 80 chars)>
Branch:         <branch name>
Feature Dir:    <absolute path>

Phase Results:
  1. Specify:   <completed | skipped | failed at step X>
  2. Clarify:   <completed | skipped | failed at step X>
  3. Plan:      <completed | skipped | failed at step X>
  4. Tasks:     <completed | skipped | failed at step X>

Artifacts Created:
  - <absolute path to spec.md>
  - <absolute path to checklists/requirements.md>
  - <absolute path to plan.md>          (if Phase 3 ran)
  - <absolute path to research.md>      (if Phase 3 ran)
  - <absolute path to data-model.md>    (if Phase 3 ran)
  - <absolute path to contracts/>       (if Phase 3 ran)
  - <absolute path to quickstart.md>    (if Phase 3 ran)
  - <absolute path to tasks.md>         (if Phase 4 ran)

Total Tasks:    <count or N/A>
MVP Scope:      <recommendation or N/A>

Next Steps:
  - <contextual recommendation based on pipeline state>
===================================================
```

**Next steps recommendations**:
- If all 4 phases completed: "Ready to implement. Run `/speckit.implement` to begin task execution."
- If stopped after Specify: "Run `/speckit.clarify` to identify ambiguities, or `/speckit.plan` to jump to planning."
- If stopped after Clarify: "Run `/speckit.plan` to generate the implementation plan."
- If stopped after Plan: "Run `/speckit.tasks` to generate the task list."
- If a phase failed: "Phase <N> (<name>) failed. Review the error above and re-run the individual command: `/speckit.<command>`."

---

## Error Handling

### Mid-Pipeline Failures

If any phase fails during execution:

1. **Immediately halt the pipeline** -- do NOT proceed to subsequent phases.
2. **Report the failure** with context:
   ```
   ===================================================
   PIPELINE HALTED: Phase <N> (<name>) Failed
   ===================================================

   Error:       <description of what went wrong>
   Failed At:   <specific step within the phase>
   Last Action: <what was attempted>

   Completed Phases:
     <list of phases that completed successfully with their artifacts>

   Recovery Options:
     1. Fix the issue and re-run the individual command: /speckit.<command>
     2. Re-run the full pipeline: /speckit.pipeline <description>
     3. Check prerequisites: .specify/scripts/powershell/check-prerequisites.ps1

   Artifacts created before failure are preserved in:
     <feature directory path>
   ===================================================
   ```

3. **Common failure scenarios and guidance**:
   - Script not found: "Ensure `.specify/scripts/powershell/` exists in the repo root. Run setup if needed."
   - Not on feature branch: "The pipeline must run from a git repository. Initialize git or check your working directory."
   - Template missing: "Ensure `.specify/templates/` contains the required templates. Check the starter kit setup."
   - JSON parse failure: "The PowerShell script output was not valid JSON. Check script execution manually."
   - Constitution missing: "Create the project constitution first with `/speckit.constitution`."

### User Halt

When the user responds with "stop" or "done" at any checkpoint:

1. Do NOT run any further phases.
2. Produce the Final Pipeline Report with completed and skipped phases clearly marked.
3. Provide the appropriate next steps recommendation based on where the pipeline was halted.

---

## Behavior Rules

- **Each phase runs the SAME logic as its individual command** -- this is an orchestrator, not a reimplementation. Follow every rule, validation step, and formatting requirement from the individual speckit commands.
- **Sequential execution only** -- never start a phase before the previous one completes successfully.
- **Interactive phases block** -- Phase 2 (Clarify) involves interactive Q&A. Wait for each user response. Phase 1 (Specify) may also involve clarification questions if `[NEEDS CLARIFICATION]` markers remain.
- **Preserve all artifacts** -- even if the pipeline halts mid-way, artifacts from completed phases remain on disk.
- **Absolute paths only** -- all file paths in reports and script invocations must be absolute.
- **For single quotes in args** like "I'm Groot", use escape syntax: e.g., `'I'\''m Groot'` (or double-quote if possible: `"I'm Groot"`).
- **Respect skip directives** -- if the user passed `--skip-clarify`, `--skip-plan`, or `--skip-tasks` in the arguments, skip those phases without asking. Still report them as "skipped" in the final report.
- **No duplicate work** -- if a phase's artifacts already exist (e.g., spec.md already written), the phase should still re-run to ensure consistency with the current feature description. The pipeline always starts fresh.

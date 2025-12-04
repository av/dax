# Dax Constitution

## Core Principles

### I. Smart Concise Code

Every line must earn its place. Favor clarity over cleverness, but never verbosity over precision.

- Delete before you add—remove dead code, unused imports, redundant abstractions
- One concept per function, one purpose per module
- Self-documenting names; comments explain *why*, never *what*
- No defensive coding theater—validate at boundaries, trust within

### II. Maintainability Above All

Code is read 10x more than written. Optimize for the next developer (often future you).

- Flat over nested; explicit over implicit
- Consistent patterns across the codebase—surprise is a bug
- Dependencies are liabilities: minimize, isolate, abstract
- Every abstraction must reduce total complexity, not redistribute it

### III. Exceptional User Experience

Users don't care about our architecture. They care about speed, clarity, and not being frustrated.

- Error messages must be actionable: what happened, why, and what to do
- Sensible defaults; progressive disclosure of complexity
- Responsive feedback—never leave users guessing if something is happening
- Accessibility is not optional; it's baseline functionality

### IV. Performance as First-Class

Fast is a feature. Slow is a bug. Performance is designed in, not bolted on.

- Measure before optimizing, but architect for speed from day one
- Budget time and memory like money—know what you're spending and why
- Lazy load, cache intelligently, minimize network round-trips
- Profile in production conditions; synthetic benchmarks lie

### V. Test-First Development (NON-NEGOTIABLE)

No code ships without proof it works. Tests are specifications, not afterthoughts.

- Write the test, watch it fail, make it pass, refactor
- Tests document intent; if you can't test it, you can't explain it
- Integration tests for contracts, unit tests for logic
- Flaky tests are broken tests—fix or delete

## Quality Standards

### Code Review Gates

- Every PR must demonstrate adherence to Core Principles
- Performance-sensitive paths require benchmark comparisons
- UX changes require before/after demonstration
- No "I'll clean this up later" merges

### Complexity Budget

- Cyclomatic complexity hard limit: 10 per function
- File size soft limit: 300 lines (hard limit: 500)
- Dependency additions require justification
- Magic numbers and strings are forbidden

## Governance

This constitution supersedes tribal knowledge and "how we've always done it."

- Amendments require: documented rationale, team review, migration plan
- Principle violations require explicit justification in PR description
- When principles conflict, prioritize: UX → Maintainability → Performance → Conciseness

**Version**: 1.0.0 | **Ratified**: 2025-12-04

# Contributing

`threshold-hook` is part of **Open source by Capped**.

The standard here is small, scriptable, and trustworthy.

## Local Setup

```bash
npm ci
npm run verify
```

## Expectations

- zero runtime dependencies
- Node 18+
- TypeScript
- no fake implementations
- no unnecessary abstraction
- clear error messages
- deterministic tests with no real network calls

## Scope Discipline

Good additions:

- better threshold semantics
- clearer CLI UX
- stronger tests
- webhook correctness

Bad additions:

- dashboards
- hosted features
- heavyweight config systems
- large dependency trees

## Docs

If behavior changes, update:

- `README.md`
- `CHANGELOG.md`
- `SECURITY.md` when trust or secret handling changes

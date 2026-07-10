# Code organization and file-size policy

Application source files are limited to 1,000 lines and 100 KB. Generated output, dependencies, lockfiles, tests, documentation, and binary assets are not part of this source-code ceiling.

## Organization conventions

- Keep route and service entry points as small façades that preserve stable import paths.
- Split endpoint controllers by business domain rather than HTTP verb.
- Split React pages into orchestration, navigation/list panes, reading/detail panes, and dialogs.
- Group client API hooks by feature under `client/src/lib/api/`; consumers continue importing from `client/src/lib/api.js`.
- Keep database startup order in `api/db/schema.js` and idempotent column/index migrations in `api/db/schema/migrations.js`.
- Prefer feature-local helpers over generic utility files when the behavior belongs to one workflow.

Run `pnpm check:source-size` to audit the ceiling. The root `pnpm check` command runs the audit automatically.

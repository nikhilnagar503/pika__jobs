# Pikajobs JSON import

## How to handle it

Always use the **full template**. Every field should exist on every job.

- Empty string `""`, empty array `[]`, or empty nested object is fine.
- Do **not** delete keys just because a role does not use them.
- Required to publish: `title`, `company`, and at least one of `apply.url` / `apply.email` / `apply.phone` / `walk_in` details.

Copy blank template: `docs/job-import-template.json`  
Filled examples: `docs/job-import-schema.example.json`

## Allowed values

- `type`: `job` | `internship` | `apprenticeship` | `freelance` | `fellowship`
- `employment`: `full_time` | `part_time` | `contract` | `""`
- `sector`: `private` | `government` | `""`
- `work_mode`: `remote` | `hybrid` | `on_site` | `field` | `""`
- `pay.type`: `stipend` | `salary` | `unpaid` | `not_disclosed` | `""`
- `pay.period`: `monthly` | `yearly` | `weekly` | `hourly` | `""`
- `access`: `free` | `pro`

Older catalog / tracker JSON still imports, but new files should follow this complete format.

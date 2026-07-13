# REPORTING, FILTERING & EXPORT — unified system

Applies to EVERY list/table/analytics screen in both panels.

## Backend contract (all list endpoints)
- `?page&limit(≤100)&sort=<field>:<asc|desc>&search=` — server-side always.
- `?range=today|yesterday|this_week|last_week|this_month|last_month|this_quarter|last_quarter|this_year|last_year` or `?from&to` (custom). Resolved in tenant timezone.
- Entity filters (multi-value, combinable): `branchId[]`, `courseId[]`, `groupId[]`,
  `teacherId[]`, `studentId[]`, `employeeId[]`, `campaignId[]`, `status[]`, `paymentStatus[]`,
  `paymentMethod[]`, `categoryId[]`, `roleId[]`, `createdById[]`, `updatedById[]`, `tags[]`.
- Filter parsing centralized in `ListQueryDto` + `buildWhere()` helper; every filterable column
  backed by an index. Search: ILIKE on short lists, Postgres FTS (`tsvector`) on students,
  leads, invoices.

## Export & print
- `POST /exports {entity, format: pdf|xlsx|csv, scope: page|selected|all, query, columns[]}`
  → BullMQ `reports` job → file in S3 → notification with download link. Small exports
  (≤2k rows) return synchronously.
- Exports respect active filters, search, sort, visible columns, selected rows.
- XLSX via `exceljs`, CSV streamed, PDF via headless-chromium print template (also used for
  Print Preview: portrait/landscape, direct print from browser).
- Permissions: `reports.view`, `reports.export`, `reports.print` (+ module read permission).

## DataTable (frontend, one shared component)
Pagination + adjustable page size (10/20/50/100), infinite scroll variant for feeds,
column visibility, column reordering (drag), sticky header + sticky first column,
bulk selection + bulk action bar, quick date-range picker (presets above + custom),
filter chips (multi), instant search (debounced 250ms), advanced search popover,
saved filters: save / rename / share (tenant-wide) / set-default (`saved_filters` table),
export menu (PDF/XLSX/CSV × page/selected/all), print button.

## Reports center
Each report = chart(s) + KPI totals + comparison vs previous period (growth %) + table +
export/print. Keys: revenue, debts, attendance, group-fill, teacher-load, teacher-performance,
course-roi, lead-funnel (see docs/API.md). Dashboard widgets share the same filter bar
(date/branch/course/teacher) and refetch on change (cached 60s per filter combo).

## AI reports
Weekly/monthly auto-summaries + on-demand analyses (revenue, expenses, marketing, students,
teacher performance) generated into `ai_insights`, downloadable via the same export pipeline.

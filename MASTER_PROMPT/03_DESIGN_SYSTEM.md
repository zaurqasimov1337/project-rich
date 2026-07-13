# PART 3 — DESIGN SYSTEM & UI/UX

Both panels share one design system (`packages/ui`). The Super Admin panel uses the same tokens
with a different accent (see §2) so the two apps are instantly distinguishable.

## 1. DESIGN PRINCIPLES

1. **Data-dense but calm.** Education admins live in tables and calendars all day — prioritize
   scannability, generous line height, restrained color.
2. **Desktop-first, responsive down to 768px;** dashboard, schedule, students list and payment
   intake must remain usable on a phone.
3. **Speed feels like quality:** skeleton loaders, optimistic updates for toggles/drag-drop,
   sub-100ms perceived interactions, prefetch on hover for main nav.
4. **Every screen has designed empty, loading and error states.** Empty states teach ("Hələ
   tələbə yoxdur — ilk tələbəni əlavə et" + CTA).
5. **Dark mode is first-class** from day one (CSS variables, `data-theme`).
6. **Accessibility:** WCAG AA contrast, full keyboard navigation, focus rings, aria labels,
   Radix primitives everywhere.

## 2. COLOR TOKENS (CSS variables; Tailwind mapped)

### Brand
| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `#4F46E5` (indigo-600) | `#6366F1` | Tenant panel primary actions, active nav |
| `--primary-hover` | `#4338CA` | `#818CF8` | |
| `--admin-primary` | `#0F766E` (teal-700) | `#14B8A6` | Super Admin panel accent |
| `--accent` | `#F59E0B` (amber-500) | `#FBBF24` | Highlights, badges, upsell |

### Semantic
| Token | Value | Use |
|---|---|---|
| `--success` | `#16A34A` | paid, active, present |
| `--warning` | `#D97706` | pending, trial, low attendance |
| `--danger` | `#DC2626` | overdue, absent, destructive actions |
| `--info` | `#0284C7` | informational |

### Neutrals (slate scale)
- Light: bg `#F8FAFC`, surface `#FFFFFF`, border `#E2E8F0`, text `#0F172A`, muted `#64748B`
- Dark: bg `#0B1220`, surface `#111827`, border `#1E293B`, text `#F1F5F9`, muted `#94A3B8`

### Data-viz palette (charts, in order)
`#4F46E5, #0EA5E9, #16A34A, #F59E0B, #EF4444, #8B5CF6, #14B8A6, #F97316`
Status mappings are fixed: income=success, expense=danger, forecast=dashed primary.

## 3. TYPOGRAPHY

- **Font: Inter** (variable, self-hosted; full Latin-Extended for Azerbaijani ə, ğ, ı, ş, ç, ö, ü).
- Scale: `12 / 13 / 14 (base) / 16 / 18 / 20 / 24 / 30 / 36`. Body = 14px; tables = 13px.
- Weights: 400 body, 500 labels/nav, 600 headings/buttons, 700 page titles & KPI numbers.
- Numbers in tables/KPIs: `font-variant-numeric: tabular-nums`.

## 4. LAYOUT SYSTEM

- **App shell:** fixed left sidebar (260px, collapsible to 64px icon rail) + top bar (56px) +
  content area (max-width 1440px, 24px padding).
- **Top bar:** global search (Cmd/Ctrl+K command palette), branch switcher, quick-create "+"
  menu, notifications bell with drawer, language switcher, theme toggle, user menu.
- **Sidebar:** grouped nav with section labels; active item = primary tint bar + icon color;
  badge counts (e.g., overdue payments). Bottom: plan usage widget (Tenant) / environment
  badge (Admin).
- **Page template:** breadcrumb → page title + primary action (right) → filter/tab row →
  content. Consistent on every module.
- Spacing: 4px base grid. Radius: `8px` inputs/buttons, `12px` cards, `16px` modals.
- Shadows: subtle two-layer (`shadow-sm` cards, `shadow-lg` popovers/modals). No heavy shadows.

## 5. CORE COMPONENTS (`packages/ui`)

Buttons (primary/secondary/outline/ghost/destructive; sm/md/lg; loading state),
Input/Select/Combobox/MultiSelect/DatePicker/DateRangePicker/TimePicker/PhoneInput(+994 mask)/
MoneyInput(AZN)/Textarea/Switch/Checkbox/RadioGroup/OTPInput,
**DataTable** (sorting, column visibility, row selection, bulk action bar, pagination,
saved filters, CSV/XLSX export, sticky header, density toggle),
Card, KPI StatCard (value, delta arrow, sparkline), ChartCard, Tabs, Accordion,
Modal/Drawer/ConfirmDialog (destructive confirm requires typing entity name for hard deletes),
Toast, Tooltip, Popover, DropdownMenu, Badge/StatusBadge (mapped to semantic colors),
Avatar (+initials fallback), EmptyState, Skeleton set, Stepper (wizards), FileUpload
(drag-drop, progress, previews), Calendar/ScheduleGrid (day/week/month/timeline + drag&drop +
conflict highlight), KanbanBoard (CRM pipeline), Timeline (activity feeds), CommandPalette,
PermissionGate (`<Can>`), PlanGate (feature-flagged upsell state).

Every component: typed props, dark-mode, RTL-safe, documented with a usage example in
`packages/ui/README.md`.

## 6. UX RULES

1. Destructive actions always confirm; bulk destructive actions show affected count.
2. Forms: inline validation on blur, submit disabled while pending, unsaved-changes guard,
   server errors mapped to fields.
3. Tables: row click opens detail (drawer for quick view, page for full entity); actions in
   kebab menu; multi-select enables bulk bar.
4. Money: always `1 250,00 ₼` format (az locale); negative in danger color.
5. Dates: relative for recent ("2 saat əvvəl"), absolute `dd.MM.yyyy HH:mm` elsewhere.
6. Search-first: any list > 10 rows gets instant search; global Cmd+K searches students,
   groups, leads, invoices, navigation.
7. Notifications drawer groups by day; unread badge; per-category preferences.
8. Onboarding: new tenant gets a checklist widget (add branch → add course → add teacher →
   create group → add student → schedule first lesson) with progress.

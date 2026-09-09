---
name: somtop-design
description: 'Design or redesign Somtop Vue interfaces, pages, forms, tables, modals, dashboards, responsive layouts, and shared CSS. Use when creating frontend UI, improving usability, applying the Thai administrative design system, or reviewing visual consistency.'
argument-hint: 'Describe the Somtop screen, workflow, component, or visual problem to design.'
user-invocable: true
disable-model-invocation: false
---

# Somtop Design

Design and implement polished, usable Vue 3 interfaces for the Somtop Management System. Treat the existing application and its Thai government-office context as the source of truth. Preserve established patterns unless the task explicitly requests a visual redesign.

## When to Use

- Create or redesign a Somtop page, view, component, dashboard, form, table, modal, or upload workflow.
- Improve responsive behavior, spacing, hierarchy, empty states, loading states, or validation feedback.
- Apply or review the Somtop visual system and shared CSS.
- Make a frontend workflow easier to scan and operate repeatedly.

## Design Rules

- Use Vue 3 and follow the existing project structure under `frontend/src`.
- Prefer shared classes and tokens from `frontend/src/assets/global.css`; add scoped CSS only for genuinely local behavior.
- Preserve the documented visual direction in `DESIGN.md`: light administrative UI, Emerald primary color, clear status colors, restrained shadows, and Sarabun/Noto Sans Thai typography.
- Keep page sections practical and information-dense. Favor clear tables, toolbars, filters, forms, and predictable actions over decorative marketing layouts.
- Use familiar icons or icon-plus-text actions for edit, delete, view, close, upload, download, and navigation. Keep tooltips on unfamiliar icon-only controls.
- Use SweetAlert2 helpers from `frontend/src/utils/swal.js` for success, error, and confirmation states. Do not use native `alert()` or `confirm()`.
- Make all important states visible: loading, empty, validation error, request failure, disabled submit, successful save, and destructive-action confirmation.
- Keep Thai labels and date conventions consistent. Display Buddhist-calendar dates using existing utilities, but send API dates as Gregorian `YYYY-MM-DD`.
- For file workflows, show accepted types, size limits, selected-file names, existing-file links, replacement behavior, and upload failures.
- Keep controls keyboard-accessible, labels associated with inputs, focus states visible, and text readable at narrow widths.
- Avoid hard-coded layout widths that break on mobile. Tables must remain usable through responsive overflow or an intentional mobile layout.

## Procedure

1. Read the target view, its neighboring components, `frontend/src/assets/global.css`, and the relevant API service before editing.
2. Identify the primary user workflow and its states: initial load, normal content, empty content, invalid input, failed request, and completed action.
3. Reuse existing components, classes, utilities, and API patterns before adding new abstractions or styles.
4. Implement the smallest coherent UI change. Keep the visual hierarchy, spacing, and interaction model consistent across related screens.
5. Check responsive behavior at narrow and wide widths. Ensure labels, buttons, tables, dialogs, and file names do not overlap or overflow.
6. Verify API field names, multipart form fields, Thai/Gregorian date conversion, and backend response shapes when the screen submits data.
7. Run the narrowest useful validation immediately, then run `npm --prefix frontend run build` from the project root for frontend changes.
8. Report the changed screen, important interaction states, validation performed, and any browser-only behavior that still needs manual checking.

## Review Checklist

- Does the first viewport clearly show the page purpose and primary action?
- Can a user find search, filtering, pagination, and row actions without hunting?
- Are destructive actions confirmed and followed by refreshed data?
- Do forms preserve entered values after validation or request errors?
- Are loading and empty states distinct and informative?
- Are status badges, dates, file links, and error messages consistent with existing screens?
- Does the layout remain usable on mobile and desktop?
- Are new styles shared when they represent a reusable pattern?
- Does the frontend build pass without warnings that affect the changed screen?

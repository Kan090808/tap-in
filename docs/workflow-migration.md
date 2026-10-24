# Attendance and payroll workflow upgrade

## Implementation and verification status

The `fix-attendance-payroll-workflows` change is implemented locally. It does not deploy Apps Script, change live Sheets, or finalize payroll. The Node suite exercises the real request dispatcher with an in-memory Apps Script adapter, alongside frontend VM/DOM regressions. These tests do not substitute for Google authorization, Drive access, GAS quotas, real browser layout, or mobile/PWA checks.

Keep the existing user changes when deploying this version. The current attendance rules take precedence over the older login proposals: a bound active device can punch from the signed-out home page, while personal history and administrative pages retain role gating.

## Deploy the complete backend first

1. Copy the live spreadsheet and back up Script Properties. Record the current deployment version and representative monthly reports/CSVs. Test on a separate spreadsheet and GAS deployment first.
2. Deploy **all four** Apps Script source files: `gas/Code.gs`, `gas/Identity.gs`, `gas/Integrity.gs`, and `gas/Terms.gs`, plus the existing manifest. They share one Apps Script project/global scope. Pasting only `Code.gs` is no longer sufficient.
3. Configure the test spreadsheet ID and existing admin credential. Confirm GET `?action=publicConfig` responds with `apiVersion: 2`. The new frontend refuses writes to an older backend.
4. Run the migration preview, then checkpoint initialization, then resolve historical rows as described below. A successful checkpoint response does not mean every historical row has been resolved.
5. Verify reports and corrections against known records, then deploy the frontend with the current service-worker cache version (`tapin-v17`). Use matching backend and frontend versions. Check both a clean browser and an already installed PWA.

## Migration API

All migration actions require a valid administrator session and use the same JSON POST endpoint as other actions. Preview does not write spreadsheet data.

```json
{ "action": "adminPreviewMigration", "token": "<current admin token>" }
```

Read `migration.unresolved`, `employeesMissingIds`, `unknownDurations`, `unknownLeaveTypes`, `malformedPunches`, and `approvedLeaveOverlaps`. A current name or device match is only a candidate, not historical proof. Recover missing employee master records from backups before attempting to map orphan IDs; this upgrade cannot automatically recover previously deleted people.

Initialize missing employee IDs and current-known employment baselines:

```json
{ "action": "adminApplyMigration", "token": "<current admin token>", "mappings": [] }
```

Preview again after initialization to obtain employee IDs and current row fingerprints. Confirm only rows supported by original attendance exports, request records, or other trustworthy evidence:

```json
{
  "action": "adminApplyMigration",
  "token": "<current admin token>",
  "mappings": [
    {
      "sheet": "AttendanceLogs",
      "rowNumber": 2,
      "fingerprint": "<exact fingerprint from the latest preview>",
      "employeeId": "<verified employee ID>",
      "evidence": "Verified against the original dated attendance export"
    }
  ]
}
```

The actual sheet names follow configured settings. Mappings support attendance, leave, device binding, and correction sheets. For unknown leave duration, include `dayPart` with `full`, `am`, or `pm` and the evidence confirming it. Leave ownership and duration are written together in one range update. Do not include a row twice in the same request. Do not sort or manually edit source sheets between preview and apply; changed fingerprints are rejected. Confirmed ownership cannot be overwritten by migration.

If interrupted, retry the same confirmed payload before gathering a fresh preview. Saved mapping confirmations and row updates are repeatable; baseline creation and default group initialization also resume without duplicating existing records. Review the returned preview after every checkpoint. Migration mappings retain the confirming administrator, evidence, and timestamp in `MigrationMappings`.

Rows with unknown ownership conservatively block reports for the affected period because their true employee is not yet known. Resolve them explicitly rather than accepting an understated wage total. Unknown approved leave types/durations, overlapping approved leave, and ambiguous punch sequences also require review. Use audited leave cancellation and correction revocation/replacement where appropriate. Preserve backups when manual recovery is unavoidable.

## History and effective dates

- Employee removal is now **Archive**. It preserves the master record and ID, revokes device access, and retains historical reports/CSV and administrator historical corrections. The old `adminDeleteEmployee` API is an archive compatibility alias.
- Salary versions take effect on the first day of a month. Omitted effective dates on an existing employee default to next month. Mid-month proration is not implemented.
- Schedule versions and assignments use explicit Asia/Taipei dates. Changing group content does not overwrite past versions.
- Editing a profile records a reason for changed terms. Use the history correction form/API (`adminSaveEmploymentTerms`) to enter verified backdated terms, even when the amount/group matches the profile. Explicit backdate confirmation is required; this changes affected reports without rewriting the current profile.
- Migration baselines only capture current known settings. Their early sentinel effective date is a fallback, **not verified historical employment data**. Reports and CSV disclose baseline use. Supply verified historical corrections when records exist.
- AM and PM leave on a normal eight-hour weekday can coexist. Personal hours alone are unpaid. A half day on a four-hour Saturday can cover that shift. Two requests whose nominal hours exceed a short shift's capacity are rejected for review, not proportionally allocated without a confirmed business rule.
- Approved manual punches can be revoked with a reason and replaced with a linked record. Revocation retains original review metadata. Incomplete pairs remain visible and produce no invented hours; conflicting typed/legacy streams block authoritative calculation until reviewed.
- Daily work/absence adjustments require a date; monetary adjustments can apply to the month. Signed pay adjustments accumulate, while later daily work/absence overrides take precedence. The portal and CSV retain the adjustment history.

## Required external acceptance checks

The following remain outstanding until actually observed in an authorized test deployment:

- Back up and rehearse preview/apply/retry on a nonproduction Sheets copy, reconcile records and payroll against known exports, and check GAS runtime/quota behavior with realistic history.
- Confirm sick-proof upload and authorized administrator inspection through Drive, plus denied access with expired/absent sessions.
- Verify active/unbound/archived employee login and home punches; administrator deep links, role switching, logout, and refresh behavior. Reconcile the older authentication proposals only after these pass under current rules.
- Check leave duration before approval, old pending pages, cancellation, correction approval/revocation/replacement, archived monthly selection, adjustment/terms history, coordinates/maps, and downloaded CSV.
- On mobile devices, check location permission, notification denial/unsupported notifications, one in-flight punch across both entry paths, and unconfirmed-response guidance.
- Verify clean install and returning PWA update behavior after the cache change; ensure no mixture of old frontend/new backend or the reverse.

## Rollback

Before new writes, restore the recorded prior application/backend versions and matching spreadsheet snapshot during a maintenance window. After new writes, first export and reconcile all records created since the backup; restoring an old snapshot directly would lose attendance and audit history. Do not expose a legacy writer to migrated data while it can bypass archived access or omit stable IDs. Keep the migrated copy and backups until reconciliation has been checked.

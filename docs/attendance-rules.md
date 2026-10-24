# Attendance rules

This document records the product rules provided on 2026-10-10. It is the reference for implementation and later checks. Items under **Decisions needed** are deliberately unresolved.

## Work schedules

- Employees belong to a work schedule group.
- The initial groups are Monday–Saturday and Monday–Friday.
- The default work hours are Monday–Friday 09:00–18:00 and Saturday 09:00–13:00 for the group that works Saturday.
- On Monday–Friday, 09:00–18:00 includes one unpaid hour for lunch, so a normal day counts as eight worked hours and creates no overtime.
- The unpaid lunch break is 13:00–14:00, so 09:00–13:00 is four worked hours.
- For an employee scheduled on Saturday, 09:00–13:00 is a complete scheduled day (four worked hours). Taking that entire Saturday off requires a half-day leave request (four hours). Saturday overtime starts only above eight counted hours.
- Administrators must be able to add more groups and choose each group's working weekdays and start/end time for each selected day.

## Punching and location

- Employees can punch directly on the home page without signing in when the device is correctly bound and location is available.
- A punch requires location permission and usable coordinates. Store its coordinates with the attendance record.
- In the admin attendance view, coordinates must open their position on a map when clicked.
- Administrators can export one employee's attendance records for one selected month.

## Missed punches

- An employee can request a missed punch. It enters the employee's attendance record only after administrator approval and has no location information.
- An administrator can add a missed punch for an employee directly, without an employee request.
- Manual punches must remain distinguishable from punches made on a device.

## Leave

- Signed-in employees can request personal leave, annual leave, and sick leave.
- Annual leave must be requested at least three calendar days before it begins.
- Sick leave requires an uploaded image or PDF that an administrator can inspect.
- A full Monday–Friday leave day counts as eight hours; a half day counts as four hours. A complete Saturday shift is covered by half-day leave.
- Leave appears in attendance records only after administrator approval.
- Employees can view their own monthly punch records and leave-request records, including review status.
- Employees can cancel leave requests, including approved requests, without another approval. Administrators can cancel an employee's leave after checking with the employee. Canceled leave immediately stops counting toward attendance and payroll, and administrators can see the cancellation history.

## Overtime

- Overtime applies only when a day's total exceeds eight hours, counting approved leave hours in that total.

## Payroll

- Administrators need each employee's worked hours and pay so they can calculate wages.
- The payroll currency is Malaysian ringgit (MYR).
- Employees are paid a monthly salary.
- Payroll uses calendar months (the 1st through the last day).
- Personal leave is unpaid; approved annual and sick leave are paid.
- The daily deduction basis is base monthly salary divided by 26. A half-day of unpaid personal leave or absence deducts 0.5 daily unit; a full day deducts 1 daily unit.
- The system automatically classifies half-day absence and applies the half-day deduction. At month end, administrators review the calculated attendance and pay and can adjust incorrect results.
- On Monday–Friday, at least four but fewer than 7.5 worked hours initially counts as a half-day absence until approved leave or an administrator adjustment changes the result. At least 7.5 worked hours counts as a full eight-hour day.
- On Monday–Friday, fewer than four worked hours initially counts as a full-day absence and deducts one daily unit; later approved leave or an administrator adjustment can change that result.
- Employees who have a half-day absence and want the remaining scheduled time covered by leave must submit a leave request. A half-day leave request contributes four hours to the day's total after approval.
- Example: six worked hours plus four hours of approved half-day leave gives ten counted hours, including two overtime hours. Pay for the leave hours still follows the leave type (personal leave unpaid; annual and sick leave paid).
- The 7.5-to-eight-hour full-day credit is used for attendance and deduction classification, not for overtime. Overtime uses actual worked hours plus approved leave hours. Example: 7.5 actual worked hours plus four approved leave hours gives 11.5 counted hours and 3.5 overtime hours. If that leave was not intended, an administrator checks with the employee and cancels it; the employee may also cancel it.
- The base hourly rate is base monthly salary divided by 26, then divided by 8.
- Ordinary overtime hours are paid at 1.5 times the base hourly rate. On Sundays, only hours above eight use a 2-times rate.
- Administrators see a current calculation that updates when approved attendance or leave records change. There is no payroll finalization or lock.
- Each employee has a configurable monthly base salary. Administrators can review the selected employee's monthly hours and calculated pay and export the month as CSV.
- At month end, administrators can adjust hours, absence classification, and pay. Each adjustment records a reason and who made it.

## Operating details

- Punches explicitly identify **clock in** or **clock out**. Missing punches can be requested by employees for approval, or added directly by administrators.
- Approved corrections have no position data. Device punches require a bound device and usable location.
- Pending and canceled leave requests remain visible in leave history. Canceling approved leave immediately recalculates attendance and pay.
- The confirmed overtime example is six actual worked hours plus four approved leave hours: two overtime hours. The 7.5-hour full-day credit does not inflate overtime.

## Implementation choices to verify

- The system currently uses Asia/Taipei (UTC+08:00) for date boundaries; deployment must keep this aligned with the business's time zone.
- Partial-day lunch handling, multiple in/out pairs, and missing pairs must be tested with real attendance examples before relying on payroll totals.
- Salary rate changes, payroll adjustments, and leave cancellation must preserve enough history to explain a previously viewed monthly result.

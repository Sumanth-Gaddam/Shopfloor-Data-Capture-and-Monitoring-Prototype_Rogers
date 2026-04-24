# Project 1: Shopfloor Data Entry App (Frontend-Only)

## 1) Goal
Build a simple shopfloor data entry prototype where an operator can submit machine readings, validate inputs, store records in the browser, and filter records for quick review.

## 2) Current Working Features
- Machine data form: machine ID, operator ID, shift, temperature, pressure, status
- Validation for required fields and numeric ranges
- Status color highlighting (OK, Warning, Critical)
- Data persistence with localStorage
- Filters by shift and status
- Clear all data action
- Accessible form labels and aria-live feedback messages
- Confirmation before destructive clear action
- Timestamp stored as both ISO value and display value
- Safe localStorage handling with recovery for invalid saved data
- Keyword search with context-aware empty-state messages
- Sortable table columns (timestamp, temperature, pressure, status)
- Row-level Edit and Delete actions for each record
- Safe edit mode with Cancel Edit workflow
- Undo Last Delete action for quick recovery
- CSV export for current visible table data (after search/filter/sort)
- CSV import with validation and invalid-row skipping
- Live summary cards for Total, OK, Warning, and Critical (current view)
- Field-level inline validation with invalid-field highlighting and focus
- Lightweight duplicate detection warning before save
- Compact audit trail in table (Created and Updated timestamps)
- Today hourly trend panel (visible records by hour with critical count)

## 3) File Structure
- index.html: UI layout, styles, form, filters, table
- script.js: validation, storage, filtering, rendering logic
- README.md: demo and interview notes

## 4) How To Run
1. Open index.html in a browser.
2. Submit records from the form.
3. Use filters to view subsets.
4. Refresh page to verify data persistence.

## 5) Quick Test Checklist
1. Submit valid data and confirm row appears.
2. Enter temperature above 120 and confirm validation error.
3. Enter pressure below 1 and confirm validation error.
4. Submit multiple records and refresh page.
5. Apply shift/status filters and confirm correct rows.
6. Click Clear All Data and confirm confirmation prompt appears.
7. Confirm clear and verify table is empty.
8. Cancel clear and verify data is not deleted.
9. Click sortable headers and verify ASC/DESC ordering updates.
10. Click Edit on any row, update values, and verify row is updated.
11. Click Cancel Edit and verify no row is modified.
12. Click Delete on a row, confirm deletion prompt, and verify row is removed.
13. Apply filters, click Export CSV, and verify downloaded file has filtered rows.
14. Import that CSV back and verify records are added with valid values.
15. Delete one row, click Undo Last Delete, and verify the row is restored.
16. Apply filters and verify summary cards update to match visible rows.
17. Submit invalid data and verify inline field errors appear and clear while typing.
18. Submit the same reading twice and verify duplicate warning appears before save.
19. Edit a record and verify Audit column shows Created time plus Updated time.
20. Add records at different times and verify Today Hourly Trend updates with total and critical counts.

## 6) SQL Concept Mapping (Industry View)
Frontend record maps to one SQL row in a shopfloor readings table.

Example SQL table (SQL Server style):

```sql
CREATE TABLE ShopfloorReadings (
  ReadingID INT IDENTITY(1,1) PRIMARY KEY,
  EntryTime DATETIME NOT NULL,
  MachineID VARCHAR(50) NOT NULL,
  OperatorID VARCHAR(50) NOT NULL,
  ShiftCode CHAR(1) NOT NULL CHECK (ShiftCode IN ('A', 'B', 'C')),
  TemperatureC DECIMAL(5,2) NOT NULL CHECK (TemperatureC BETWEEN 0 AND 120),
  PressureBar DECIMAL(5,2) NOT NULL CHECK (PressureBar BETWEEN 1 AND 20),
  Status VARCHAR(10) NOT NULL CHECK (Status IN ('OK', 'Warning', 'Critical'))
);
```

Example insert:

```sql
INSERT INTO ShopfloorReadings
(EntryTime, MachineID, OperatorID, ShiftCode, TemperatureC, PressureBar, Status)
VALUES
(GETDATE(), 'MC-101', 'OP-22', 'B', 68.5, 12.3, 'Warning');
```

Example dashboard query:

```sql
SELECT ShiftCode, Status, COUNT(*) AS ReadingCount
FROM ShopfloorReadings
GROUP BY ShiftCode, Status
ORDER BY ShiftCode, Status;
```

## 7) Backend-Connected Version (Next Stage Concept)
- POST /api/readings: validate and insert a record
- GET /api/readings?shift=A&status=Warning: return filtered records
- GET /api/summary: return grouped counts for dashboard cards/charts

## 8) Interview/Demo Script (60 to 90 seconds)
1. This app captures shopfloor machine readings from operators.
2. I included validation so bad values are blocked before storage.
3. I used localStorage to keep a working prototype frontend-only.
4. I added shift and status filters to simulate supervisor review.
5. In production, each record maps directly to a SQL row and is stored through an API.
6. This design is ready to extend into a backend-connected version.

## 9) Practical Improvements (After Working Version)
- Add export to CSV
- Add edit/delete per record
- Add simple charts for counts by shift and status
- Replace localStorage with backend API and SQL database

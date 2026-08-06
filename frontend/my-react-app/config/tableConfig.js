Proposed Changes
Global Components
[MODIFY] 
MainLayout.jsx
Branding: Replace logic generating "RIDE.Arche.Global" with "RIDE+".
Terminology:
Remove "Monitoring" from breadcrumbs/titles.
Rename "Approve Business Manager" → "+ADD MANAGER".
Update Modal: "Enter the email ID of the ADD Manager".
Update Input Label: "Mail" (was "BM Email").
Update Notification Link: "Notification" (was "BM Notifications").
Navbar: Remove the "Export" button from the header.
[MODIFY] 
LoginPage.jsx 
Update "RIDE.Arche.Global" references if present.
Backend/API (Verification Only)
Verify no "Monitoring" strings in critical API responses if they affect UI (mostly likely purely frontend).
UI Components
[NEW] 
TruncatedCell.jsx
Create a reusable component for table cells.
Logic:
Display max 2 lines.
Line 1: Max 4 words.
Line 2: Max 3 words.
Show "Read more..." if content exceeds limit.
Expand on click. Collapse on click outside.
[MODIFY] 
WorkboardPage.jsx
Export Button: Add "Export" button near "ADD NEW".
Status: Update 
getStatusRowClass
 to map "Open" -> "Resolved".
Table: Replace standard text cells with <TruncatedCell />.
[MODIFY] 
MonitoringPageHeader.jsx
Export Button: Add "Export" button near "Filter/Customize" area (if applicable, or in the specific pages).
Module Pages (Monitoring*)
Apply changes to all Monitoring*Page.jsx files (Risks, Issues, Actions, Dependencies, Escalations, Appreciations, Users).
Files:
MonitoringRisksPage.jsx
MonitoringIssuesPage.jsx
MonitoringActionsPage.jsx
MonitoringDependenciesPage.jsx
MonitoringEscalationsPage.jsx
MonitoringAppreciationsPage.jsx
UsersMonitoringPage.jsx
Changes:
Export Button: Add near "Customize Form".
Status: Update 
getStatusMeta
 to map "Open" -> "Resolved".
Table: Use <TruncatedCell />.
Terminology: Remove "Monitoring" from Page Titles (<h1>Risk</h1> -> already seems to be "Risk", check others).
Verification Plan
Manual Verification
Branding: Check Top-Left Logo text says "RIDE+".
Terminology: Check Breadcrumbs, Page Titles for absence of "Monitoring". Check "+ADD MANAGER" modal in Admin view.
Status:
Find a record with "Open" status (or create one).
Verify it displays as "Resolved" (Label and Color).
Export Button:
Verify it is GONE from Navbar.
Verify it is PRESENT on Workboard pages (near Add New).
Verify it is PRESENT on Monitoring pages (near Customize Form).
Click it and verify download starts.
Fixed Table UI:
Enter a long text description (more than 7 words).
Verify cell shows 4 words on line 1, 3 words on line 2, then "Read more...".
Click "Read more..." -> Expands.
Click away -> Collapses.
Comment
Ctrl+Alt+M
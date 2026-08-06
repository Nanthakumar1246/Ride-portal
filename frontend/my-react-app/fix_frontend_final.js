import { readFileSync, writeFileSync } from 'fs';
const path = 'c:\\Users\\Santhosh B\\Downloads\\uagpl\\archeride1.0-main\\frontend\\my-react-app\\src\\pages\\MonitoringDashboardPage.jsx';
try {
    let content = readFileSync(path, 'utf8');
    // We look for the block containing KpiCards. 
    // Last state should have 5 cards including Total Items.

    // Regex to match the container div and its content roughly
    const containerRegex = /<div style={{ display: "flex", gap: "16px", justifyContent: "space-between" }}>\s*<KpiCard title="Total Open"[\s\S]*?<\/div>/;

    if (containerRegex.test(content)) {
        const newBlock = `<div style={{ display: "flex", gap: "16px", justifyContent: "space-between" }}>
              <KpiCard title="Total Open" value={kpis.totalOpen} />
              <KpiCard title="Resolved" value={kpis.totalClosed} />
              <KpiCard title="Approved & Closed" value={kpis.totalApproved} />
              <KpiCard title="Cancelled" value={kpis.totalCancelled} />
            </div>`;

        content = content.replace(containerRegex, newBlock);
        console.log("Updated to 4 KPI cards.");
        writeFileSync(path, content);
    } else {
        console.log("Could not find KPI Container.");
        // Debug 
        const idx = content.indexOf('<KpiCard title="Total Open"');
        if (idx !== -1) {
            console.log(content.substring(idx, idx + 400));
        }
    }
} catch (err) {
    console.error("Error finalizing frontend:", err);
}
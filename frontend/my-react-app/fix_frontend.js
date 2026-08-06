import { readFileSync, writeFileSync } from 'fs';
const path = 'c:\\Users\\Santhosh B\\Downloads\\uagpl\\archeride1.0-main\\frontend\\my-react-app\\src\\pages\\MonitoringDashboardPage.jsx';
try {
    let content = readFileSync(path, 'utf8');

    // 1. Update setKpis
    // match: totalItems: Number(data.total_items ?? 0),
    // insert after: totalCancelled: Number(data.cancelled ?? 0),

    if (content.indexOf('totalCancelled:') === -1) {
        const kpiRegex = /(totalItems:\s*Number\(data\.total_items\s*\?\?\s*0\),)/;
        if (kpiRegex.test(content)) {
            content = content.replace(kpiRegex, '$1\n          totalCancelled: Number(data.cancelled ?? 0),');
            console.log("Updated setKpis state.");
        } else {
            console.log("Could not find setKpis insertion point.");
        }
    } else {
        console.log("setKpis already has totalCancelled.");
    }

    // 2. Update JSX
    // Look for the specific concatenated line or close to it
    const cardRegex = /<KpiCard title="Total Open" value={kpis\.totalOpen} \/>\s*<KpiCard title="Closed" value={kpis\.totalClosed} \/>/;

    if (cardRegex.test(content)) {
        const newCards = `<div style={{ display: "flex", gap: "16px", justifyContent: "space-between" }}>
              <KpiCard title="Total Open" value={kpis.totalOpen} />
              <KpiCard title="Resolved" value={kpis.totalClosed} />
              <KpiCard title="Cancelled" value={kpis.totalCancelled} />
              <KpiCard title="Total Items" value={kpis.totalItems} />
            </div>`;

        // We need to match the whole div block to be clean?
        // The previous state was:
        // <div ...>
        //   <KpiCard ... /> <KpiCard ... />
        //   <KpiCard ... />
        // </div>

        // Let's just replace the cards we found and hope the surrounding div brackets line up, 
        // OR replace the whole div content if we can match it.

        // Simpler: Just replace the known sequence
        content = content.replace(cardRegex, `
              <KpiCard title="Total Open" value={kpis.totalOpen} />
              <KpiCard title="Resolved" value={kpis.totalClosed} />
              <KpiCard title="Cancelled" value={kpis.totalCancelled} />`);

        // Now we likely have duplicate "Total Items" lines because I didn't verify if I consumed it.
        // The original looked like:
        // <KpiCard title="Total Open" ... /> <KpiCard title="Closed" ... />
        // <KpiCard title="Total Items" ... />

        // My replacement above put 3 cards. The 4th card (Total Items) is still there in the file following the match.
        // So we should be good!
        console.log("Updated KPI Cards JSX.");
    } else {
        console.log("Could not find KPI Cards JSX to replace. Check if it's already updated.");
    }

    writeFileSync(path, content);
    console.log("Frontend fix script finished.");
} catch (err) {
    console.error("Error fixing frontend:", err);
}

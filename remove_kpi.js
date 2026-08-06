
const fs = require('fs');
const path = 'c:\\Users\\Santhosh B\\Downloads\\uagpl\\archeride1.0-main\\frontend\\my-react-app\\src\\pages\\MonitoringDashboardPage.jsx';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Regex to match the line with indentation
    const regex = /^\s*<KpiCard title="In Progress" value={kpis\.totalInProgress} \/>\r?\n/m;
    if (regex.test(content)) {
        const newContent = content.replace(regex, '');
        fs.writeFileSync(path, newContent);
        console.log('Successfully removed In Progress card line.');
    } else {
        // Try matching without the newline at the end (maybe it's the last line?)
        const regex2 = /<KpiCard title="In Progress" value={kpis\.totalInProgress} \/>/;
        if (regex2.test(content)) {
            console.log("Found without newline match, replacing...");
            const newContent = content.replace(regex2, '');
            fs.writeFileSync(path, newContent);
            console.log('Successfully removed In Progress card tag (leftover whitespace/newline might remain).');
        } else {
            console.log('Target line not found.');
            // Debug: print the area
            const idx = content.indexOf('Total Open');
            if (idx !== -1) {
                console.log('Context:', content.substring(idx - 50, idx + 300));
            }
        }
    }
} catch (err) {
    console.error('Error:', err);
}

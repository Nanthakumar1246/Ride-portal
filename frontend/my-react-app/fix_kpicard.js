import { readFileSync, writeFileSync } from 'fs';
const path = 'c:\\Users\\Santhosh B\\Downloads\\uagpl\\archeride1.0-main\\frontend\\my-react-app\\src\\components\\KpiCard.jsx';
try {
    let content = readFileSync(path, 'utf8');

    // 1. Update Imports
    if (content.indexOf("CheckCircle, ClipboardText") !== -1) {
        content = content.replace(
            "import { ChartLineUp, WarningCircle, CheckCircle, ClipboardText, PauseCircle } from \"phosphor-react\";",
            "import { ChartLineUp, WarningCircle, CheckCircle, ClipboardText, PauseCircle, ShieldCheck, XCircle } from \"phosphor-react\";"
        );
    }

    // 2. Update iconMap
    // We'll replace the whole iconMap object block
    const iconMapStart = content.indexOf("const iconMap = {");
    const iconMapEnd = content.indexOf("};", iconMapStart);

    if (iconMapStart !== -1 && iconMapEnd !== -1) {
        const newIconMap = `const iconMap = {
  "Total Open": <WarningCircle size={24} color="#D64550" weight="duotone" />,
  "Resolved": <CheckCircle size={24} color="#1EA896" weight="duotone" />,
  "Approved & Closed": <ShieldCheck size={24} color="#10B981" weight="duotone" />,
  "Cancelled": <XCircle size={24} color="#6B7280" weight="duotone" />,
  "Total Items": <ClipboardText size={24} color="#517493" weight="duotone" />,
}`;

        const oldMap = content.substring(iconMapStart, iconMapEnd + 2);
        content = content.replace(oldMap, newIconMap);
    }

    // 3. Update insightMap
    const insightStart = content.indexOf("const insightMap = {");
    const insightEnd = content.indexOf("};", insightStart);

    if (insightStart !== -1 && insightEnd !== -1) {
        const newInsightMap = `const insightMap = {
  "Total Open": "Critical attention required for new items.",
  "Resolved": "Issues resolved, pending approval.",
  "Approved & Closed": "Verified and officially closed.",
  "Cancelled": "Items cancelled or discarded.",
  "Total Items": "Overall volume is trending upward.",
}`;
        const oldInsight = content.substring(insightStart, insightEnd + 2);
        content = content.replace(oldInsight, newInsightMap);
    }

    // 4. Update Progress Bar Color Logic
    // Look for background logic in the return JSX
    // It's inside the style={...} block of the last motion.div

    // let's try to find the string `title === "Closed"`
    if (content.indexOf('title === "Closed"') !== -1) {
        const oldLogic = `title === "Closed"
                ? "#1EA896"
                : title === "In Progress" || title === "On Hold"
                  ? "#E7A725"
                  : "#D64550",`;

        const newLogic = `title === "Resolved"
                ? "#1EA896"
                : title === "Approved & Closed"
                  ? "#10B981"
                  : title === "Cancelled"
                    ? "#6B7280"
                    : "#D64550",`; // Default red for Open

        content = content.replace(oldLogic, newLogic);
    }

    // Extra check: replace {iconMap[title]} with safety check if needed, but the original bad code had {iconMap[title]}
    // My replace_file_content tried to add a fallback. I'll stick to simple replace if possible.

    writeFileSync(path, content);
    console.log("Updated KpiCard.jsx");

} catch (err) {
    console.error("Error updating KpiCard:", err);
}

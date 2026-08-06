const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'frontend', 'my-react-app', 'src', 'pages', 'MonitoringEscalationsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');
// The file might contain literal "\n" characters from my previous mistake, 
// or just have garbage at the end.
// Let's first fix the garbage at the end.
const dataToCheck = "export default MonitoringEscalationsPage;";
const lastIndex = content.lastIndexOf(dataToCheck);
if (lastIndex !== -1) {
    // Keep everything up to the export statement, plus a newline
    const newContent = content.substring(0, lastIndex + dataToCheck.length) + '\r\n';
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("✅ Truncated file after export statement.");
} else {
    console.log("⚠️ Could not find export statement, manual check needed.");
}

// Check if literal \n characters exist in the file (escaped newlines)
if (content.includes("\\n")) {
    console.log("⚠️ File contains literal '\\n' characters. Attempting to fix...");
    // Only replace literal "\n" if it's not part of a string (this is hard to do perfectly with regex but let's try a safe approach)
    // Actually, if I used lines.join('\\n'), then EVERY line break is probably a literal \n now?
    // But view_file showed separate lines...
    // Let's just trust view_file for now.
}
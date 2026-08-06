const fs = require('fs');
const path = require('path');
const PAGES_DIR = path.join(__dirname, 'frontend', 'my-react-app', 'src', 'pages');
// Fix Appreciations
const appFile = path.join(PAGES_DIR, 'MonitoringAppreciationsPage.jsx');
let appContent = fs.readFileSync(appFile, 'utf8');
// Add imports after line 8 (after useMonitoringExport import)
appContent = appContent.replace(
    'import useMonitoringExport from "../hooks/useMonitoringExport";',
    `import useMonitoringExport from "../hooks/useMonitoringExport";\nimport LayoutBuilder from "../components/LayoutBuilder";\nimport { getLayoutApi, saveLayoutApi } from "../api/layoutApi";\nimport { appreciationsFormConfig } from "../config/formConfig";\nimport { Pen } from "phosphor-react";`
);
fs.writeFileSync(appFile, appContent, 'utf8');
console.log('✅ Fixed Appreciations imports');
// Fix Collections
const collFile = path.join(PAGES_DIR, 'MonitoringCollectionsPage.jsx');
let collContent = fs.readFileSync(collFile, 'utf8');

collContent = collContent.replace(
    'import useMonitoringExport from "../hooks/useMonitoringExport";',
    `import useMonitoringExport from "../hooks/useMonitoringExport";\nimport LayoutBuilder from "../components/LayoutBuilder";\nimport { getLayoutApi, saveLayoutApi } from "../api/layoutApi";\nimport { collectionsFormConfig } from "../config/formConfig";\nimport { Pen } from "phosphor-react";`
);

fs.writeFileSync(collFile, collContent, 'utf8');
console.log('✅ Fixed Collections imports');

console.log('\n🎉 All files should now compile!');

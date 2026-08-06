// Script to add Layout Builder imports and button to all monitoring pages
// Run with: node add_layout_builder_to_monitoring.js

const fs = require('fs'); 
const path = require('path'); 
const PAGES_DIR = path.join(__dirname, 'frontend', 'my-react-app', 'src', 'pages');

const modules = [
    { file: 'MonitoringIssuesPage.jsx', module: 'issues', formConfig: 'issuesFormConfig' },
    { file: 'MonitoringActionsPage.jsx', module: 'actions', formConfig: 'actionsFormConfig' },
    { file: 'MonitoringDependenciesPage.jsx', module: 'dependencies', formConfig: 'dependenciesFormConfig' },
    { file: 'MonitoringEscalationsPage.jsx', module: 'escalations', formConfig: 'escalationsFormConfig' },
    { file: 'MonitoringCollectionsPage.jsx', module: 'collections', formConfig: 'collectionsFormConfig' },
    { file: 'MonitoringAppreciationsPage.jsx', module: 'appreciations', formConfig: 'appreciationsFormConfig' }
];

const IMPORTS_TO_ADD = `import LayoutBuilder from "../components/LayoutBuilder";
import { getLayoutApi, saveLayoutApi } from "../api/layoutApi";
import { Pen } from "phosphor-react";`;

modules.forEach(({ file, module, formConfig }) => {
    const filePath = path.join(PAGES_DIR, file);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${file} - file not found`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already modified
    if (content.includes('LayoutBuilder')) {
        console.log(`✅ ${file} already has LayoutBuilder`);
        return;
    }

    // 1. Add imports after existing imports
    const importRegex = /(import.*from.*;\n)+/;
    const match = content.match(importRegex);
    if (match) {
        const lastImportIndex = content.indexOf(match[0]) + match[0].length;
        content = content.slice(0, lastImportIndex) + IMPORTS_TO_ADD + '\nimport { ' + formConfig + ' } from "../config/formConfig";\n\n' + content.slice(lastImportIndex);
    }

    // 2. Add state after component declaration
    const componentRegex = new RegExp(`const Monitoring\\w+Page = \\(\\) => \\{`);
    const componentMatch = content.match(componentRegex);
    if (componentMatch) {
        const stateToAdd = `
  // Layout Builder state
  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [layoutFields, setLayoutFields] = useState(${formConfig}?.fields || []);
`;
        const insertIndex = content.indexOf(componentMatch[0]) + componentMatch[0].length;
        content = content.slice(0, insertIndex) + stateToAdd + content.slice(insertIndex);
    }

    // 3. Add loadLayout function before useEffect
    const loadLayoutFunction = `
  // Load layout configuration
  const loadLayout = async () => {
    try {
      const serverLayout = await getLayoutApi("${module}");
      if (serverLayout && Array.isArray(serverLayout)) {
        setLayoutFields(serverLayout);
      } else {
        setLayoutFields(${formConfig}?.fields || []);
      }
    } catch (err) {
      console.warn("No custom layout found, using default");
      setLayoutFields(${formConfig}?.fields || []);
    }
  };
`;

    // Find first useEffect and add loadLayout before it
    const useEffectIndex = content.indexOf('useEffect(');
    if (useEffectIndex !== -1) {
        content = content.slice(0, useEffectIndex) + loadLayoutFunction + '\n  ' + content.slice(useEffectIndex);
    }

    // 4. Modify first useEffect to call loadLayout
    content = content.replace(
        /useEffect\(\(\) => \{\s*loadData\(\);/,
        `useEffect(() => {
    loadData();
    loadLayout();`
    );

    // 5. Add button to header (after the title div)
    const headerButtonToAdd = `
        
        {/* Customize Form Button */}
        <button
          onClick={() => setShowLayoutBuilder(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md transition-all active:scale-95"
          title="Customize Form Layout"
        >
          <Pen size={18} weight="bold" />
          Customize Form
        </button>`;

    // Find the header div closing tag (after the title)
    content = content.replace(
        /(<\/div>\s*<\/motion\.div>)\s*\n\s*{\/\* .*ROW 1/,
        `$1${headerButtonToAdd}\n\n      </motion.div>\n\n      {/* ROW 1`
    );

    // 6. Add LayoutBuilder component before closing </motion.div>
    const layoutBuilderComponent = `
      
      {/* Layout Builder Modal */}
      {showLayoutBuilder && (
        <LayoutBuilder
          fields={layoutFields}
          onClose={() => setShowLayoutBuilder(false)}
          onSave={async (newLayout) => {
            await saveLayoutApi("${module}", newLayout);
            setLayoutFields(newLayout);
            setShowLayoutBuilder(false);
          }}
        />
      )}`;

    // Find the last closing motion.div before export
    const lastMotionDivIndex = content.lastIndexOf('</motion.div>');
    if (lastMotionDivIndex !== -1) {
        content = content.slice(0, lastMotionDivIndex) + layoutBuilderComponent + '\n    ' + content.slice(lastMotionDivIndex);
    }

    // Write back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${file}`);
});
console.log('\n🎉 All monitoring pages updated!');

import os
import re

files_to_update = [
    "MonitoringIssuesPage.jsx",
    "MonitoringDependenciesPage.jsx",
    "MonitoringEscalationsPage.jsx",
    "MonitoringActionsPage.jsx",
    "MonitoringAppreciationsPage.jsx"
]

for filename in files_to_update:
    if not os.path.exists(filename):
        continue
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update the layout margin/padding
    # Look for: <motion.div className="min-h-[calc(100vh-80px)] flex flex-col gap-4 bg-gray-50 p-4 sm:p-6 relative" initial={{ opacity: 0, y: 20 }}
    # Or variations thereof
    content = re.sub(
        r'<motion\.div\s+className="min-h-\[calc\(100vh-80px\)\] flex flex-col gap-\d+ bg-[a-zA-Z0-5-]+ p-\d+ sm:p-\d+ relative"\s+initial',
        r'<motion.div\n      className="min-h-[calc(100vh-80px)] flex flex-col gap-1.5 bg-gray-50 px-2 sm:px-4 pt-0 pb-4 relative"\n      style={{ margin: "-16px -8px" }}\n      initial',
        content,
        count=1
    )
    
    # 2. Update the header inline layout
    # We will replace the title block
    content = re.sub(
        r'<div>\s*<h1 className="font-marcellus[^>]+>(.*?)</h1>\s*<p className="[^>]+>(.*?)</p>\s*</div>',
        r'<div className="flex items-baseline gap-3">\n          <h1 className="font-marcellus font-bold text-xl sm:text-2xl text-gray-900 tracking-tight leading-none">\1</h1>\n          <span className="text-gray-300 text-sm hidden sm:inline">|</span>\n          <p className="text-[10px] sm:text-xs text-gray-500 italic leading-none">\2</p>\n        </div>',
        content,
        count=1
    )
    
    # 3. Remove Customize Form and existing export button from the top
    content = re.sub(
        r'\{\s*\}\s*<div className="flex gap-2">\s*\{\s*rows\.length > 0 && \(\s*<button.*?<DownloadSimple size=\{20\} weight="duotone" />\s*</button>\s*\)\s*\}\s*<button[^>]+>\s*<Pen size=\{18\} weight="bold" />\s*Customize Form\s*</button>\s*</div>',
        r'',
        content,
        flags=re.DOTALL
    )
    
    # 4. Insert Download button into the filter row
    # Search for: <div className="flex gap-2 justify-end">
    new_buttons = r'''<div className="flex gap-2 justify-end">
          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full bg-blue-50 text-blue-600 p-2 border border-blue-200 hover:bg-blue-100 transition flex items-center justify-center shadow-sm"
              title="Export to Excel"
            >
              <DownloadSimple size={18} weight="duotone" />
            </button>
          )}'''
    content = content.replace('<div className="flex gap-2 justify-end">', new_buttons, 1)

    # 5. Table padding
    content = content.replace('px-4 py-2 min-w-[180px]', 'px-3 py-2 min-w-[150px]')

    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Done")

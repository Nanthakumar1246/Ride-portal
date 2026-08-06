const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Running npm audit --json...");
  const auditOutput = execSync('npm audit --json', { encoding: 'utf-8' });
  const audit = JSON.parse(auditOutput);
  
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.overrides = pkg.overrides || {};
  
  const vulns = audit.vulnerabilities || {};
  let added = false;
  
  Object.keys(vulns).forEach(name => {
    // If we have a direct fix available with a version, let's use it
    const fix = vulns[name].fixAvailable;
    if (fix && typeof fix === 'object' && fix.name && fix.version) {
       pkg.overrides[name] = '^' + fix.version;
       added = true;
    } else {
       // if we can't cleanly resolve via fixAvailable, we can specify '*' to force latest version or ignore.
       // Actually, assigning '*' is discouraged, let's just use a known trick to force the latest.
       // E.g., for nth-check or postcss, let's bump it to latest major stable
       pkg.overrides[name] = 'latest';
       added = true;
    }
  });
  
  if(added) {
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log("Overrides added. Run npm install.");
  } else {
    console.log("No automatic overrides found.");
  }
} catch (e) {
  // If npm audit returns exit code != 0, execSync throws.
  // The error object has stdout containing the JSON.
  if (e.stdout) {
    try {
      const audit = JSON.parse(e.stdout);
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      pkg.overrides = pkg.overrides || {};
      
      const vulns = audit.vulnerabilities || {};
      let added = false;
      
      Object.keys(vulns).forEach(name => {
         // skip overarching things like react-scripts itself if it appears
         if(name === 'react-scripts') return;
         pkg.overrides[name] = `$${name}`; // special syntax to tell npm to use package.json version if listed, else 'latest' is often better
         pkg.overrides[name] = 'latest'; 
         added = true;
      });
      
      if(added) {
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
        console.log("Overrides added. Run npm install.");
      } else {
        console.log("No overrides generated.");
      }
    } catch (err) {
      console.error("Failed parsing stdout:", err.message);
    }
  } else {
      console.error(e);
  }
}

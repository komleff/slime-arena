
const fs = require('fs');
const path = require('path');

const version = require('../version.json').version;

const files = [
  '../package.json',
  '../client/package.json',
  '../server/package.json',
  '../shared/package.json'
];

files.forEach(file => {
  const filePath = path.resolve(__dirname, file);
  if (fs.existsSync(filePath)) {
    const pkg = require(filePath);
    pkg.version = version;
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Updated ${file} to version ${version}`);
  }
});

// Update UI component
const mainMenuPath = path.resolve(__dirname, '../client/src/ui/components/MainMenu.tsx');
if (fs.existsSync(mainMenuPath)) {
  let content = fs.readFileSync(mainMenuPath, 'utf-8');
  // Match string like "Slime Arena v0.3.1" or similar
  const regex = /Slime Arena v\d+\.\d+\.\d+/;
  if (regex.test(content)) {
    content = content.replace(regex, `Slime Arena v${version}`);
    fs.writeFileSync(mainMenuPath, content);
    console.log(`Updated MainMenu.tsx to version ${version}`);
  } else {
    // Fallback if not found, try to search for just the text to replace it if format slightly different
    console.warn("Could not find version string in MainMenu.tsx to update.");
  }
}

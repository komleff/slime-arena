
const fs = require('fs');
const path = require('path');

const version = require('../version.json').version;

const files = [
  '../package.json',
  '../client/package.json',
  '../server/package.json',
  '../shared/package.json',
  '../admin-dashboard/package.json'
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

// Update Docker files
const dockerFiles = [
  {
    path: '../docker/monolith-full.Dockerfile',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /org\.opencontainers\.image\.version="\d+\.\d+\.\d+"/, replacement: `org.opencontainers.image.version="${version}"` }
    ]
  },
  {
    path: '../docker/docker-compose.monolith-full.yml',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /slime-arena-monolith-full:\$\{VERSION:-\d+\.\d+\.\d+\}/, replacement: `slime-arena-monolith-full:\${VERSION:-${version}}` }
    ]
  }
];

dockerFiles.forEach(({ path: filePath, patterns }) => {
  const fullPath = path.resolve(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    let updated = false;
    patterns.forEach(({ regex, replacement }) => {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        updated = true;
      }
    });
    if (updated) {
      fs.writeFileSync(fullPath, content);
      console.log(`Updated ${filePath} to version ${version}`);
    } else {
      console.warn(`Could not find version patterns in ${filePath}`);
    }
  } else {
    console.warn(`File not found: ${filePath}`);
  }
});

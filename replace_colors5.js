const fs = require('fs');
const path = require('path');

const files = [
  'src/ui/BulkActionsBar.tsx',
  'src/ui/ContextMenu.tsx',
  'src/ui/DetailPanel.tsx',
  'src/ui/Onboarding.tsx'
];

const replacements = [
  { regex: /rgba\(20,\s*20,\s*32,\s*0\.95\)/gi, replacement: 'rgba(255, 255, 255, 0.95)' },
  { regex: /rgba\(20,\s*20,\s*32,\s*0\.98\)/gi, replacement: 'rgba(255, 255, 255, 0.98)' },
  { regex: /rgba\(15,\s*15,\s*25,\s*0\.95\)/gi, replacement: 'rgba(255, 255, 255, 0.95)' },
  { regex: /rgba\(74,\s*144,\s*217,\s*0\.2\)/gi, replacement: 'rgba(217, 119, 87, 0.2)' },
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    replacements.forEach(({ regex, replacement }) => {
      content = content.replace(regex, replacement);
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No changes in ${file}`);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
});

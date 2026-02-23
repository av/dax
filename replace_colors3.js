const fs = require('fs');
const path = require('path');

const files = [
  'src/ui/AgentPlanPanel.tsx',
  'src/ui/Minimap.tsx'
];

const replacements = [
  { regex: /rgba\(86,\s*95,\s*137,\s*0\.3\)/gi, replacement: 'rgba(115, 110, 106, 0.3)' },
  { regex: /rgba\(86,\s*95,\s*137,\s*0\.6\)/gi, replacement: 'rgba(115, 110, 106, 0.6)' },
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

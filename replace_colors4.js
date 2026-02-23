const fs = require('fs');
const path = require('path');

const files = [
  'src/ui/HUD.tsx',
  'src/ui/Onboarding.tsx'
];

const replacements = [
  { regex: /#444b6a/gi, replacement: '#736E6A' },
  { regex: /#0a0a0f/gi, replacement: '#F2EFE9' },
  { regex: /#4A90D9/gi, replacement: '#D97757' },
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

const fs = require('fs');
const path = require('path');

const files = [
  'src/ui/BulkActionsBar.tsx',
  'src/ui/RenameDialog.tsx',
  'src/ui/Settings.tsx',
  'src/ui/Onboarding.tsx',
  'src/ui/MoveDialog.tsx',
  'src/ui/DetailPanel.tsx',
  'src/ui/HUD.tsx',
  'src/ui/AgentPlanPanel.tsx',
  'src/ui/ContextMenu.tsx',
  'src/ui/CommandBar.tsx',
  'src/ui/Minimap.tsx',
  'src/ui/Toast.tsx'
];

const replacements = [
  { regex: /rgba\(158,\s*206,\s*106,\s*0\.3\)/gi, replacement: 'rgba(122, 155, 118, 0.3)' },
  { regex: /rgba\(247,\s*118,\s*142,\s*0\.3\)/gi, replacement: 'rgba(217, 83, 79, 0.3)' },
  { regex: /rgba\(22,\s*22,\s*30,\s*0\.98\)/gi, replacement: 'rgba(255, 255, 255, 0.98)' },
  { regex: /rgba\(26,\s*27,\s*38,\s*0\.98\)/gi, replacement: 'rgba(255, 255, 255, 0.98)' },
  { regex: /rgba\(122,\s*162,\s*247,\s*0\.08\)/gi, replacement: 'rgba(217, 119, 87, 0.08)' },
  { regex: /rgba\(247,\s*118,\s*142,\s*0\.1\)/gi, replacement: 'rgba(217, 83, 79, 0.1)' },
  { regex: /rgba\(26,\s*27,\s*38,\s*0\.96\)/gi, replacement: 'rgba(255, 255, 255, 0.96)' },
  { regex: /rgba\(122,\s*162,\s*247,\s*0\.12\)/gi, replacement: 'rgba(217, 119, 87, 0.12)' },
  { regex: /rgba\(122,\s*162,\s*247,\s*0\.8\)/gi, replacement: 'rgba(217, 119, 87, 0.8)' },
  { regex: /rgba\(122,\s*162,\s*247,\s*0\.5\)/gi, replacement: 'rgba(217, 119, 87, 0.5)' },
  { regex: /rgba\(10,\s*10,\s*15,\s*0\.75\)/gi, replacement: 'rgba(249, 248, 246, 0.75)' },
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

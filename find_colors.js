const fs = require('fs');
const path = require('path');

const uiFiles = fs.readdirSync('src/ui').filter(f => f.endsWith('.tsx')).map(f => path.join('src/ui', f));
const files = ['src/App.tsx', ...uiFiles];
const colors = new Set();

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const hexMatches = content.match(/#[0-9a-fA-F]{3,8}/g) || [];
  const rgbaMatches = content.match(/rgba?\([^)]+\)/g) || [];
  hexMatches.forEach(c => colors.add(c));
  rgbaMatches.forEach(c => colors.add(c));
});

console.log(Array.from(colors).sort());

const fs = require('fs');
const path = require('path');

const previewFiles = fs.readdirSync('src/ui/previews').filter(f => f.endsWith('.tsx')).map(f => path.join('src/ui/previews', f));

const colorMap = {
  "'#1a1b2e'": "theme.colors.bgBase",
  "'#292e42'": "theme.colors.borderDefault",
  "'#565f89'": "theme.colors.textSecondary",
  "'#a9b1d6'": "theme.colors.textPrimary",
  "'#c0caf5'": "theme.colors.textPrimary",
  "'#f7768e'": "theme.colors.statusError",
  "'rgba(122, 162, 247, 0.05)'": "\`${theme.colors.accentPrimary}0D\`",
  "'#fff'": "theme.colors.bgSurface",
  "'#000'": "theme.colors.textPrimary",
  "'#7aa2f7'": "theme.colors.accentPrimary",
  "'#bb9af7'": "theme.colors.accentPrimary",
  "'#9ece6a'": "theme.colors.statusSuccess",
  "'#e0af68'": "theme.colors.statusWarning",
  "'#7dcfff'": "theme.colors.accentPrimary",
  "'#2ac3de'": "theme.colors.accentPrimary",
  "'#b4f9f8'": "theme.colors.accentPrimary",
  "'#ff9e64'": "theme.colors.statusWarning",
  "'#db4b4b'": "theme.colors.statusError",
  "'#414868'": "theme.colors.borderDefault",
  "'#16161e'": "theme.colors.bgBase",
  "'#1f2335'": "theme.colors.bgBase",
  "'#24283b'": "theme.colors.bgBase",
  "'#cfc9c2'": "theme.colors.textPrimary",
  "'#ff0000'": "theme.colors.statusError",
  "'#00ff00'": "theme.colors.statusSuccess",
  "'#0000ff'": "theme.colors.accentPrimary",
  "'#ffffff'": "theme.colors.bgSurface",
  "'#000000'": "theme.colors.textPrimary",
};

const templateColorMap = {
  "#1a1b2e": "${theme.colors.bgBase}",
  "#292e42": "${theme.colors.borderDefault}",
  "#565f89": "${theme.colors.textSecondary}",
  "#a9b1d6": "${theme.colors.textPrimary}",
  "#c0caf5": "${theme.colors.textPrimary}",
  "#f7768e": "${theme.colors.statusError}",
  "rgba(122, 162, 247, 0.05)": "${theme.colors.accentPrimary}0D",
  "#fff": "${theme.colors.bgSurface}",
  "#000": "${theme.colors.textPrimary}",
  "#7aa2f7": "${theme.colors.accentPrimary}",
  "#bb9af7": "${theme.colors.accentPrimary}",
  "#9ece6a": "${theme.colors.statusSuccess}",
  "#e0af68": "${theme.colors.statusWarning}",
  "#7dcfff": "${theme.colors.accentPrimary}",
  "#2ac3de": "${theme.colors.accentPrimary}",
  "#b4f9f8": "${theme.colors.accentPrimary}",
  "#ff9e64": "${theme.colors.statusWarning}",
  "#db4b4b": "${theme.colors.statusError}",
  "#414868": "${theme.colors.borderDefault}",
  "#16161e": "${theme.colors.bgBase}",
  "#1f2335": "${theme.colors.bgBase}",
  "#24283b": "${theme.colors.bgBase}",
  "#cfc9c2": "${theme.colors.textPrimary}",
  "#ff0000": "${theme.colors.statusError}",
  "#00ff00": "${theme.colors.statusSuccess}",
  "#0000ff": "${theme.colors.accentPrimary}",
  "#ffffff": "${theme.colors.bgSurface}",
  "#000000": "${theme.colors.textPrimary}",
};

previewFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    const escapedOldColor = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOldColor, 'g');
    content = content.replace(regex, newColor);
  }

  const borderRegex = /'([^']*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))[^']*)'/g;
  content = content.replace(borderRegex, (match, innerString, color) => {
    if (templateColorMap[color]) {
      return `\`${innerString.replace(color, templateColorMap[color])}\``;
    }
    return match;
  });

  const borderRegex2 = /"([^"]*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))[^"]*)"/g;
  content = content.replace(borderRegex2, (match, innerString, color) => {
    if (templateColorMap[color]) {
      return `\`${innerString.replace(color, templateColorMap[color])}\``;
    }
    return match;
  });

  // Also replace raw colors in CSS blocks (like in CsvPreview.tsx)
  // e.g. `background: #1a1b2e;` -> `background: ${theme.colors.bgBase};`
  for (const [oldColor, newColor] of Object.entries(templateColorMap)) {
    const escapedOldColor = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match color followed by semicolon or space or newline
    const regex = new RegExp(`(:\\s*)${escapedOldColor}(;|\\s|\\n|\\})`, 'g');
    content = content.replace(regex, `$1${newColor}$2`);
  }

  if (content !== originalContent) {
    if (!content.includes("import { theme }")) {
      const importRegex = /^import.*?;?$/gm;
      let lastImportIndex = 0;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastImportIndex = match.index + match[0].length;
      }
      
      const importStatement = `\nimport { theme } from '@/theme';`;
      
      if (lastImportIndex > 0) {
        content = content.slice(0, lastImportIndex) + importStatement + content.slice(lastImportIndex);
      } else {
        content = importStatement.trim() + '\n\n' + content;
      }
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});

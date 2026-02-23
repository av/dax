const fs = require('fs');
const path = require('path');

const uiFiles = fs.readdirSync('src/ui').filter(f => f.endsWith('.tsx')).map(f => path.join('src/ui', f));
const files = ['src/App.tsx', ...uiFiles];

const colorMap = {
  "'#0a0a0f'": "theme.colors.bgBase",
  "'#2C2A29'": "theme.colors.textPrimary",
  "'#333'": "theme.colors.bgBase",
  "'#5C5A58'": "theme.colors.textSecondary",
  "'#736E6A'": "theme.colors.textSecondary",
  "'#7A9B76'": "theme.colors.statusSuccess",
  "'#7aa2f7'": "theme.colors.accentPrimary",
  "'#D9534F'": "theme.colors.statusError",
  "'#D9534F33'": "\`${theme.colors.statusError}33\`",
  "'#D97757'": "theme.colors.accentPrimary",
  "'#D9775733'": "\`${theme.colors.accentPrimary}33\`",
  "'#D9A05B'": "theme.colors.statusWarning",
  "'#E6E2DD'": "theme.colors.borderDefault",
  "'#EFECE6'": "theme.colors.bgBase",
  "'#F2EFE9'": "theme.colors.bgBase",
  "'#FFFFFF'": "theme.colors.bgSurface",
  "'#e0e0e0'": "theme.colors.textPrimary",
  "'rgba(115, 110, 106, 0.3)'": "\`${theme.colors.textSecondary}4D\`",
  "'rgba(115, 110, 106, 0.6)'": "\`${theme.colors.textSecondary}99\`",
  "'rgba(122, 155, 118, 0.15)'": "\`${theme.colors.statusSuccess}26\`",
  "'rgba(122, 155, 118, 0.3)'": "\`${theme.colors.statusSuccess}4D\`",
  "'rgba(217, 119, 87, 0.08)'": "\`${theme.colors.accentPrimary}14\`",
  "'rgba(217, 119, 87, 0.1)'": "\`${theme.colors.accentPrimary}1A\`",
  "'rgba(217, 119, 87, 0.12)'": "\`${theme.colors.accentPrimary}1F\`",
  "'rgba(217, 119, 87, 0.15)'": "\`${theme.colors.accentPrimary}26\`",
  "'rgba(217, 119, 87, 0.2)'": "\`${theme.colors.accentPrimary}33\`",
  "'rgba(217, 119, 87, 0.3)'": "\`${theme.colors.accentPrimary}4D\`",
  "'rgba(217, 119, 87, 0.5)'": "\`${theme.colors.accentPrimary}80\`",
  "'rgba(217, 119, 87, 0.8)'": "\`${theme.colors.accentPrimary}CC\`",
  "'rgba(217, 83, 79, 0.1)'": "\`${theme.colors.statusError}1A\`",
  "'rgba(217, 83, 79, 0.15)'": "\`${theme.colors.statusError}26\`",
  "'rgba(217, 83, 79, 0.3)'": "\`${theme.colors.statusError}4D\`",
  "'rgba(230, 226, 221, 0.8)'": "\`${theme.colors.borderDefault}CC\`",
  "'rgba(249, 248, 246, 0.7)'": "\`${theme.colors.bgBase}B3\`",
  "'rgba(249, 248, 246, 0.75)'": "\`${theme.colors.bgBase}BF\`",
  "'rgba(255, 255, 255, 0.9)'": "\`${theme.colors.bgSurface}E6\`",
  "'rgba(255, 255, 255, 0.95)'": "\`${theme.colors.bgSurface}F2\`",
  "'rgba(255, 255, 255, 0.96)'": "\`${theme.colors.bgSurface}F5\`",
  "'rgba(255, 255, 255, 0.98)'": "\`${theme.colors.bgSurface}FA\`",
  "'rgba(44, 42, 41, 0.2)'": "\`${theme.colors.textPrimary}33\`",
  "'rgba(44, 42, 41, 0.3)'": "\`${theme.colors.textPrimary}4D\`",
  "'rgba(44, 42, 41, 0.4)'": "\`${theme.colors.textPrimary}66\`",
  "'0 2px 8px rgba(44, 42, 41, 0.2)'": "theme.shadows.sm",
  "'0 4px 16px rgba(44, 42, 41, 0.3)'": "theme.shadows.md",
  "'0 8px 32px rgba(44, 42, 41, 0.3)'": "theme.shadows.lg",
  "'0 4px 12px rgba(44, 42, 41, 0.2)'": "theme.shadows.md",
  "'0 2px 4px rgba(44, 42, 41, 0.1)'": "theme.shadows.sm",
  "'0 4px 12px rgba(44, 42, 41, 0.3)'": "theme.shadows.md",
  "'0 2px 6px rgba(44, 42, 41, 0.2)'": "theme.shadows.sm",
  "'0 4px 12px rgba(0, 0, 0, 0.1)'": "theme.shadows.md",
  "'0 2px 8px rgba(0, 0, 0, 0.1)'": "theme.shadows.sm",
  "'0 8px 24px rgba(0, 0, 0, 0.2)'": "theme.shadows.lg",
  "'0 4px 12px rgba(0, 0, 0, 0.15)'": "theme.shadows.md",
  "'0 2px 4px rgba(0, 0, 0, 0.05)'": "theme.shadows.sm",
  "'0 4px 6px rgba(0, 0, 0, 0.1)'": "theme.shadows.md",
  "'0 10px 15px rgba(0, 0, 0, 0.1)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0,0,0,0.1)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0,0,0,0.1)'": "theme.shadows.md",
  "'0 8px 16px rgba(0,0,0,0.1)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.2)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.2)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.2)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.3)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.3)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.3)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.4)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.4)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.4)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.5)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.5)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.5)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.6)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.6)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.6)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.7)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.7)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.7)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.8)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.8)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.8)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 0.9)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 0.9)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 0.9)'": "theme.shadows.lg",
  "'0 2px 4px rgba(0, 0, 0, 1)'": "theme.shadows.sm",
  "'0 4px 8px rgba(0, 0, 0, 1)'": "theme.shadows.md",
  "'0 8px 16px rgba(0, 0, 0, 1)'": "theme.shadows.lg",
};

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Replace colors
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    // We need to replace exact matches of the string
    // e.g. '#0a0a0f' -> theme.colors.bgBase
    // We should escape the oldColor for regex
    const escapedOldColor = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOldColor, 'g');
    content = content.replace(regex, newColor);
  }

  // Also handle cases where the color is inside a template literal
  // e.g. `1px solid #E6E2DD` -> `1px solid ${theme.colors.borderDefault}`
  const templateColorMap = {
    "#0a0a0f": "${theme.colors.bgBase}",
    "#2C2A29": "${theme.colors.textPrimary}",
    "#333": "${theme.colors.bgBase}",
    "#5C5A58": "${theme.colors.textSecondary}",
    "#736E6A": "${theme.colors.textSecondary}",
    "#7A9B76": "${theme.colors.statusSuccess}",
    "#7aa2f7": "${theme.colors.accentPrimary}",
    "#D9534F": "${theme.colors.statusError}",
    "#D9534F33": "${theme.colors.statusError}33",
    "#D97757": "${theme.colors.accentPrimary}",
    "#D9775733": "${theme.colors.accentPrimary}33",
    "#D9A05B": "${theme.colors.statusWarning}",
    "#E6E2DD": "${theme.colors.borderDefault}",
    "#EFECE6": "${theme.colors.bgBase}",
    "#F2EFE9": "${theme.colors.bgBase}",
    "#FFFFFF": "${theme.colors.bgSurface}",
    "#e0e0e0": "${theme.colors.textPrimary}",
    "rgba(115, 110, 106, 0.3)": "${theme.colors.textSecondary}4D",
    "rgba(115, 110, 106, 0.6)": "${theme.colors.textSecondary}99",
    "rgba(122, 155, 118, 0.15)": "${theme.colors.statusSuccess}26",
    "rgba(122, 155, 118, 0.3)": "${theme.colors.statusSuccess}4D",
    "rgba(217, 119, 87, 0.08)": "${theme.colors.accentPrimary}14",
    "rgba(217, 119, 87, 0.1)": "${theme.colors.accentPrimary}1A",
    "rgba(217, 119, 87, 0.12)": "${theme.colors.accentPrimary}1F",
    "rgba(217, 119, 87, 0.15)": "${theme.colors.accentPrimary}26",
    "rgba(217, 119, 87, 0.2)": "${theme.colors.accentPrimary}33",
    "rgba(217, 119, 87, 0.3)": "${theme.colors.accentPrimary}4D",
    "rgba(217, 119, 87, 0.5)": "${theme.colors.accentPrimary}80",
    "rgba(217, 119, 87, 0.8)": "${theme.colors.accentPrimary}CC",
    "rgba(217, 83, 79, 0.1)": "${theme.colors.statusError}1A",
    "rgba(217, 83, 79, 0.15)": "${theme.colors.statusError}26",
    "rgba(217, 83, 79, 0.3)": "${theme.colors.statusError}4D",
    "rgba(230, 226, 221, 0.8)": "${theme.colors.borderDefault}CC",
    "rgba(249, 248, 246, 0.7)": "${theme.colors.bgBase}B3",
    "rgba(249, 248, 246, 0.75)": "${theme.colors.bgBase}BF",
    "rgba(255, 255, 255, 0.9)": "${theme.colors.bgSurface}E6",
    "rgba(255, 255, 255, 0.95)": "${theme.colors.bgSurface}F2",
    "rgba(255, 255, 255, 0.96)": "${theme.colors.bgSurface}F5",
    "rgba(255, 255, 255, 0.98)": "${theme.colors.bgSurface}FA",
    "rgba(44, 42, 41, 0.2)": "${theme.colors.textPrimary}33",
    "rgba(44, 42, 41, 0.3)": "${theme.colors.textPrimary}4D",
    "rgba(44, 42, 41, 0.4)": "${theme.colors.textPrimary}66",
  };

  // Replace colors inside strings that are not just the color
  // e.g. '1px solid #E6E2DD' -> `1px solid ${theme.colors.borderDefault}`
  // We can use a regex to find strings containing these colors
  // This is a bit tricky, let's just do it manually for common patterns like borders
  
  // Find all strings like '1px solid #E6E2DD'
  const borderRegex = /'([^']*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))[^']*)'/g;
  content = content.replace(borderRegex, (match, innerString, color) => {
    if (templateColorMap[color]) {
      return `\`${innerString.replace(color, templateColorMap[color])}\``;
    }
    return match;
  });

  // Also double quotes
  const borderRegex2 = /"([^"]*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))[^"]*)"/g;
  content = content.replace(borderRegex2, (match, innerString, color) => {
    if (templateColorMap[color]) {
      return `\`${innerString.replace(color, templateColorMap[color])}\``;
    }
    return match;
  });

  if (content !== originalContent) {
    // Add import if not present
    if (!content.includes("import { theme }")) {
      // Find the last import statement
      const importRegex = /^import.*?;?$/gm;
      let lastImportIndex = 0;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastImportIndex = match.index + match[0].length;
      }
      
      const importPath = file === 'src/App.tsx' ? './theme' : '@/theme';
      const importStatement = `\nimport { theme } from '${importPath}';`;
      
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

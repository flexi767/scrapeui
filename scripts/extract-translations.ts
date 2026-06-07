import fs from 'fs';
import path from 'path';

interface ExtractedString {
  key: string;
  value: string;
  context: 'ui' | 'content' | 'error';
  file: string;
  line: number;
}

const extracted = new Map<string, ExtractedString>();

// Scan components directory for hardcoded strings
function scanDirectory(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !file.startsWith('.')) {
      scanDirectory(fullPath);
      continue;
    }

    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Pattern 1: label: 'String'
      const labelMatch = line.match(/label:\s*['"`]([^'"`]+)['"`]/g);
      if (labelMatch) {
        labelMatch.forEach((match) => {
          const value = match.match(/['"`]([^'"`]+)['"`]/)?.[ 1];
          if (value) {
            const key = `ui.${value.toLowerCase().replace(/\s+/g, '_')}`;
            extracted.set(key, {
              key,
              value,
              context: 'ui',
              file: fullPath,
              line: index + 1,
            });
          }
        });
      }

      // Pattern 2: description: 'String'
      const descMatch = line.match(/description:\s*['"`]([^'"`]+)['"`]/g);
      if (descMatch) {
        descMatch.forEach((match) => {
          const value = match.match(/['"`]([^'"`]+)['"`]/)?.[ 1];
          if (value) {
            const key = `ui.${value.toLowerCase().replace(/\s+/g, '_')}`;
            extracted.set(key, {
              key,
              value,
              context: 'ui',
              file: fullPath,
              line: index + 1,
            });
          }
        });
      }

      // Pattern 3: Plain text in JSX (simple heuristic)
      const jsxMatch = line.match(/<[^>]*>([A-Z][^<]*)<\/[^>]*>/);
      if (jsxMatch && jsxMatch[1].trim().length > 3) {
        const value = jsxMatch[1].trim();
        const key = `ui.${value.toLowerCase().replace(/\s+/g, '_').substring(0, 30)}`;
        extracted.set(key, {
          key,
          value,
          context: 'ui',
          file: fullPath,
          line: index + 1,
        });
      }
    });
  }
}

// Run extraction
const componentsDir = path.join(process.cwd(), 'components');
scanDirectory(componentsDir);

// Output results
console.log(`\n📋 Extracted ${extracted.size} translation keys:\n`);

const results: ExtractedString[] = Array.from(extracted.values());
results.sort((a, b) => a.key.localeCompare(b.key));

results.forEach((result) => {
  console.log(`${result.key}`);
  console.log(`  Value: "${result.value}"`);
  console.log(`  File: ${result.file}:${result.line}\n`);
});

// Save to JSON for import
const outputPath = path.join(process.cwd(), 'scripts', 'extracted-keys.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n✅ Saved to ${outputPath}`);

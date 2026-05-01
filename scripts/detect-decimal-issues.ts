#!/usr/bin/env node
/**
 * Detects ".00" decimal formatting issues in price display across the platform.
 * 
 * The issue: Prices stored as DECIMAL(10,2) in database get displayed as "6000.00" 
 * instead of "6000" when they're whole numbers.
 * 
 * Run with: npx tsx scripts/detect-decimal-issues.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface DecimalIssue {
  file: string;
  line: number;
  column: number;
  code: string;
  issue: 'toFixed-2' | 'raw-decimal-display' | 'parseFloat-without-rounding';
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

const issues: DecimalIssue[] = [];

// Patterns that indicate .00 formatting issues
const patterns = [
  // toFixed(2) - forces 2 decimal places
  {
    regex: /\.toFixed\(2\)/g,
    issue: 'toFixed-2' as const,
    severity: 'high' as const,
    suggestion: 'Use toFixed(0) for whole numbers or conditional formatting: price % 1 === 0 ? Math.round(price).toLocaleString() : price.toFixed(2)',
  },
  // Raw price display without formatting
  {
    regex: /\{price\}|\{.*price.*\}|\{.*\.price\}/g,
    issue: 'raw-decimal-display' as const,
    severity: 'high' as const,
    suggestion: 'Format price before display: Math.round(price).toLocaleString() or price.toLocaleString()',
  },
  // parseFloat without rounding for display
  {
    regex: /parseFloat\([^)]+\)(?!\.toFixed|\.round|\.toLocaleString)/g,
    issue: 'parseFloat-without-rounding' as const,
    severity: 'medium' as const,
    suggestion: 'Add formatting: parseFloat(value).toLocaleString() or Math.round(parseFloat(value)).toLocaleString()',
  },
];

// Price-related keywords
const priceKeywords = [
  'price', 'cost', 'amount', 'total', 'fee', 'delivery', 'shipping', 'subtotal',
  'bundle_price', 'unit_price', 'compare_price', 'original_price',
];

function isPriceRelated(line: string): boolean {
  return priceKeywords.some(keyword => line.toLowerCase().includes(keyword));
}

async function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Skip if not price-related
    if (!isPriceRelated(line)) {
      return;
    }
    
    patterns.forEach((pattern) => {
      const { regex, issue, severity, suggestion } = pattern;
      regex.lastIndex = 0; // Reset regex
      let match;
      while ((match = regex.exec(line)) !== null) {
        // Skip if it's in a comment
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }
        
        issues.push({
          file: filePath,
          line: lineNum,
          column: match.index + 1,
          code: line.trim(),
          issue,
          severity,
          suggestion,
        });
      }
    });
  });
}

// Walk directory and find files
function walkDir(dir: string, pattern: RegExp, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      walkDir(fullPath, pattern, files);
    } else if (entry.isFile() && pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function main() {
  console.log('🔍 Scanning for .00 decimal formatting issues...\n');
  
  const clientDir = path.join('/home/skull/Desktop/ecopro', 'client');
  const serverDir = path.join('/home/skull/Desktop/ecopro', 'server');
  
  const clientFiles = walkDir(clientDir, /\.(tsx|ts|js|jsx)$/);
  const serverFiles = walkDir(serverDir, /\.(tsx|ts|js)$/);
  
  const allFiles = [...clientFiles, ...serverFiles];
  
  console.log(`Found ${allFiles.length} files to scan\n`);
  
  for (const file of allFiles) {
    await scanFile(file);
  }
  
  // Group by severity
  const highSeverity = issues.filter(i => i.severity === 'high');
  const mediumSeverity = issues.filter(i => i.severity === 'medium');
  const lowSeverity = issues.filter(i => i.severity === 'low');
  
  // Output results
  console.log('='.repeat(80));
  console.log(`FOUND ${issues.length} POTENTIAL .00 FORMATTING ISSUES`);
  console.log('='.repeat(80));
  
  if (highSeverity.length > 0) {
    console.log(`\n🔴 HIGH SEVERITY (${highSeverity.length} issues):`);
    console.log('-'.repeat(80));
    highSeverity.forEach(issue => {
      console.log(`\n📁 ${issue.file}:${issue.line}:${issue.column}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Code:  ${issue.code.substring(0, 100)}`);
      console.log(`   Fix:   ${issue.suggestion}`);
    });
  }
  
  if (mediumSeverity.length > 0) {
    console.log(`\n🟡 MEDIUM SEVERITY (${mediumSeverity.length} issues):`);
    console.log('-'.repeat(80));
    mediumSeverity.slice(0, 30).forEach(issue => {
      console.log(`\n📁 ${path.relative('/home/skull/Desktop/ecopro', issue.file)}:${issue.line}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Code:  ${issue.code.substring(0, 80)}`);
      console.log(`   Fix:   ${issue.suggestion}`);
    });
    if (mediumSeverity.length > 30) {
      console.log(`\n... and ${mediumSeverity.length - 30} more medium severity issues`);
    }
  }
  
  // Summary by file
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY BY FILE');
  console.log('='.repeat(80));
  
  const byFile = issues.reduce((acc, issue) => {
    const relPath = path.relative('/home/skull/Desktop/ecopro', issue.file);
    acc[relPath] = acc[relPath] || { high: 0, medium: 0, low: 0, total: 0 };
    acc[relPath][issue.severity]++;
    acc[relPath].total++;
    return acc;
  }, {} as Record<string, { high: number; medium: number; low: number; total: number }>);
  
  Object.entries(byFile)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .forEach(([file, counts]) => {
      const severityEmoji = counts.high > 0 ? '🔴' : counts.medium > 0 ? '🟡' : '🟢';
      console.log(`${severityEmoji} ${file}: ${counts.total} issues (${counts.high} high, ${counts.medium} medium)`);
    });
  
  // CSV export
  console.log('\n' + '='.repeat(80));
  console.log('CSV EXPORT');
  console.log('='.repeat(80));
  console.log('file,line,column,issue,severity,code,suggestion');
  issues.forEach(issue => {
    const relPath = path.relative('/home/skull/Desktop/ecopro', issue.file);
    const escapedCode = issue.code.replace(/"/g, '""').substring(0, 80);
    console.log(`"${relPath}",${issue.line},${issue.column},${issue.issue},${issue.severity},"${escapedCode}","${issue.suggestion}"`);
  });
  
  process.exit(highSeverity.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Detects "sticky 0" issues in number input fields across the platform.
 * 
 * A "sticky 0" occurs when:
 * 1. An input has a value of 0 or defaults to 0
 * 2. When user starts typing, the 0 doesn't get cleared
 * 3. User ends up with values like "05" instead of "5"
 * 
 * Run with: npx tsx scripts/detect-sticky-zero-inputs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface StickyZeroIssue {
  file: string;
  line: number;
  column: number;
  code: string;
  issue: 'default-zero' | 'fallback-zero' | 'or-zero' | 'parse-fallback-zero';
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

const issues: StickyZeroIssue[] = [];

// Patterns that indicate sticky 0 issues
const patterns = [
  // useState(0) - state initialized to 0
  {
    regex: /useState\s*\(\s*0\s*\)/g,
    issue: 'default-zero' as const,
    severity: 'high' as const,
    suggestion: 'Use useState<number | "">() or useState<number | undefined>() instead',
  },
  // value={something || 0}
  {
    regex: /value\s*=\s*\{[^}]*\|\|\s*0[^}]*\}/g,
    issue: 'or-zero' as const,
    severity: 'high' as const,
    suggestion: 'Use value={value ?? ""} for inputs to allow empty state',
  },
  // value={something ?? 0} 
  {
    regex: /value\s*=\s*\{[^}]*\?\?\s*0[^}]*\}/g,
    issue: 'fallback-zero' as const,
    severity: 'medium' as const,
    suggestion: 'Consider using value={value ?? ""} for better UX',
  },
  // || 0 in number parsing
  {
    regex: /Number\([^)]+\)\s*\|\|\s*0|parseInt\([^)]+\)\s*\|\|\s*0|parseFloat\([^)]+\)\s*\|\|\s*0/g,
    issue: 'parse-fallback-zero' as const,
    severity: 'medium' as const,
    suggestion: 'Store raw string value in state, only convert to number on submit',
  },
  // Default values with 0 in objects
  {
    regex: /:\s*0\s*,?\s*$/gm,
    issue: 'default-zero' as const,
    severity: 'medium' as const,
    suggestion: 'Use undefined or null as default, handle in display',
  },
] as const;

// Input-related patterns (to identify actual form inputs)
const inputRelatedPatterns = [
  /type\s*=\s*["']number["']/,
  /Input\s/,
  /inputProps/,
  /onChange.*=.*\(.*e/,
  /formData/,
  /setFormData/,
  /placeholder/,
];

// Patterns that indicate CSS/inline styles (not inputs)
const cssPatterns = [
  /style\s*=\s*\{\s*{/,
  /:\s*0\s*,?\s*(\/\/.*)?$/m,  // property: 0 at end of line (CSS)
  /top:\s*0|left:\s*0|right:\s*0|bottom:\s*0/,
  /flexShrink|flexGrow|zIndex/,
];

// Internal state that's NOT user input
const internalStatePatterns = [
  /reconnectAttempts|loading|error|open|visible|mounted/,
  /totalUsers|totalClients|totalAdmins|totalCodes/,
  /newOrders|unreadMessages|redeemedCodes/,
  /ms|seconds|minutes|hours/,
  /flexShrink|top|left|right|bottom/,
];

function isLikelyInput(lines: string[], index: number): boolean {
  const line = lines[index];
  
  // Check current and surrounding lines for input indicators
  const contextStart = Math.max(0, index - 5);
  const contextEnd = Math.min(lines.length, index + 5);
  const context = lines.slice(contextStart, contextEnd).join(' ');
  
  // If it has CSS patterns, it's likely not an input
  if (cssPatterns.some(p => p.test(line)) && !inputRelatedPatterns.some(p => p.test(context))) {
    return false;
  }
  
  // Check for internal state patterns
  if (internalStatePatterns.some(p => p.test(line))) {
    return false;
  }
  
  // Check for input-related patterns in context
  return inputRelatedPatterns.some(p => p.test(context));
}

async function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    patterns.forEach((pattern) => {
      const { regex, issue, severity, suggestion } = pattern;
      regex.lastIndex = 0; // Reset regex
      let match;
      while ((match = regex.exec(line)) !== null) {
        // Skip if it's in a comment
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }
        
        // Skip if it's not related to an input field
        if (!isLikelyInput(lines, index)) {
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
  console.log('🔍 Scanning for sticky 0 issues...\n');
  
  const clientDir = path.join('/home/skull/Desktop/ecopro', 'client');
  const files = walkDir(clientDir, /\.(tsx|ts)$/);
  
  console.log(`Found ${files.length} files to scan\n`);
  
  for (const file of files) {
    await scanFile(file);
  }
  
  // Group by severity
  const highSeverity = issues.filter(i => i.severity === 'high');
  const mediumSeverity = issues.filter(i => i.severity === 'medium');
  const lowSeverity = issues.filter(i => i.severity === 'low');
  
  // Output results
  console.log('='.repeat(80));
  console.log(`FOUND ${issues.length} POTENTIAL STICKY 0 ISSUES`);
  console.log('='.repeat(80));
  
  if (highSeverity.length > 0) {
    console.log(`\n🔴 HIGH SEVERITY (${highSeverity.length} issues):`);
    console.log('-'.repeat(80));
    highSeverity.forEach(issue => {
      console.log(`\n📁 ${issue.file}:${issue.line}:${issue.column}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Code:  ${issue.code}`);
      console.log(`   Fix:   ${issue.suggestion}`);
    });
  }
  
  if (mediumSeverity.length > 0) {
    console.log(`\n🟡 MEDIUM SEVERITY (${mediumSeverity.length} issues):`);
    console.log('-'.repeat(80));
    mediumSeverity.slice(0, 20).forEach(issue => {
      console.log(`\n📁 ${path.relative('/home/skull/Desktop/ecopro', issue.file)}:${issue.line}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Code:  ${issue.code}`);
      console.log(`   Fix:   ${issue.suggestion}`);
    });
    if (mediumSeverity.length > 20) {
      console.log(`\n... and ${mediumSeverity.length - 20} more medium severity issues`);
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
  
  // CSV export for easy reference
  console.log('\n' + '='.repeat(80));
  console.log('CSV EXPORT (for spreadsheet)');
  console.log('='.repeat(80));
  console.log('file,line,column,issue,severity,code,suggestion');
  issues.forEach(issue => {
    const relPath = path.relative('/home/skull/Desktop/ecopro', issue.file);
    const escapedCode = issue.code.replace(/"/g, '""').substring(0, 80);
    console.log(`"${relPath}",${issue.line},${issue.column},${issue.issue},${issue.severity},"${escapedCode}","${issue.suggestion}"`);
  });
  
  // Exit with error code if high severity issues found
  process.exit(highSeverity.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

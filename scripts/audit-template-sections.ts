#!/usr/bin/env tsx
/**
 * Template Sections Audit Script
 * 
 * Scans all templates to detect:
 * - Countdown timers (setInterval, timer, countdown)
 * - Trust badges/features (ShieldCheck, Truck, Star icons + text)
 * - Social proof notifications (fake buyer notifications)
 * - Fixed/hardcoded sections that can't be hidden
 * 
 * Run: npx tsx scripts/audit-template-sections.ts
 */

import fs from 'fs';
import path from 'path';

const TEMPLATES_DIR = './client/pages/storefront/templates';

// Keywords that indicate a section that might need toggle
const PATTERNS = {
  countdown: ['setInterval', 'timer', 'countdown', 'useEffect.*time', 'mins.*secs', 'timeLeft'],
  trustBadges: ['ShieldCheck', 'Truck', 'Star.*check', 'trust.*pill', 'guarantee', 'جودة', 'ضمان', 'توصيل'],
  socialProof: ['socialProof', 'buyers', 'recently bought', 'طلب هذا المنتج', 'someone purchased', 'notification.*pop'],
  hardcoded: ['text-sm mb-2', 'fixed.*element', 'ينتهي هذا العرض', 'features.*map', 'badge.*icon'],
};

interface SectionInfo {
  template: string;
  type: 'countdown' | 'trustBadges' | 'socialProof' | 'hardcoded';
  lineNumber: number;
  preview: string;
  hasToggle: boolean;
}

function findSections(filePath: string, content: string): SectionInfo[] {
  const sections: SectionInfo[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Check each pattern type
    for (const [type, patterns] of Object.entries(PATTERNS)) {
      for (const pattern of patterns) {
        if (line.toLowerCase().includes(pattern.toLowerCase())) {
          // Check if this section already has toggle
          const hasToggle = content.includes('show') && content.includes('canManage') && 
                           (content.includes('TEMPLATE_UPDATE_SETTING') || content.includes('onSettingChange'));
          
          sections.push({
            template: path.basename(filePath, '.tsx'),
            type: type as any,
            lineNumber: index + 1,
            preview: line.trim().slice(0, 80),
            hasToggle,
          });
          break;
        }
      }
    }
  });
  
  return sections;
}

function main() {
  const templatesDir = path.resolve(TEMPLATES_DIR);
  const templateDirs = fs.readdirSync(templatesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  console.log('🔍 Scanning templates for sections needing hide/show toggles...\n');
  
  const allSections: SectionInfo[] = [];
  
  for (const dir of templateDirs) {
    const templatePath = path.join(templatesDir, dir, `${dir.charAt(0).toUpperCase() + dir.slice(1)}Template.tsx`);
    
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf-8');
      const sections = findSections(templatePath, content);
      allSections.push(...sections);
      
      if (sections.length > 0) {
        console.log(`\n📄 ${dir}:`);
        sections.forEach(s => {
          const icon = s.hasToggle ? '✅' : '⏳';
          const typeLabel = {
            countdown: '⏱️  Countdown',
            trustBadges: '🛡️  Trust Badge',
            socialProof: '👥 Social Proof',
            hardcoded: '📝 Hardcoded'
          }[s.type];
          console.log(`  ${icon} ${typeLabel} (line ${s.lineNumber}): ${s.preview}`);
        });
      }
    }
  }
  
  // Summary
  const byType = allSections.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const withToggles = allSections.filter(s => s.hasToggle).length;
  const withoutToggles = allSections.filter(s => !s.hasToggle).length;
  
  console.log('\n\n📊 SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Total sections found: ${allSections.length}`);
  console.log(`With toggles: ${withToggles} ✅`);
  console.log(`Need toggles: ${withoutToggles} ⏳`);
  console.log('\nBy type:');
  Object.entries(byType).forEach(([type, count]) => {
    const label = {
      countdown: '⏱️  Countdown timers',
      trustBadges: '🛡️  Trust badges',
      socialProof: '👥 Social proof',
      hardcoded: '📝 Hardcoded sections'
    }[type];
    console.log(`  ${label}: ${count}`);
  });
  
  // Priority list
  const templatesNeedingWork = [...new Set(
    allSections.filter(s => !s.hasToggle).map(s => s.template)
  )];
  
  console.log('\n\n🎯 TEMPLATES NEEDING WORK:');
  templatesNeedingWork.forEach((t, i) => {
    const count = allSections.filter(s => s.template === t && !s.hasToggle).length;
    console.log(`  ${i + 1}. ${t} (${count} sections)`);
  });
}

main();

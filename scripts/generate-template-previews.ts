import sharp from 'sharp';
import path from 'path';

const TEMPLATES = [
  { id: 'dzshop', name: 'DZ Shop', colors: ['#7c3aed', '#a78bfa', '#c4b5fd'] },
  { id: 'needdz', name: 'NeedDZ', colors: ['#2563eb', '#3b82f6', '#93c5fd'] },
  { id: 'zinith', name: 'Zenith', colors: ['#111827', '#374151', '#f9fafb'] },
  { id: 'boutique', name: 'Boutique', colors: ['#0f172a', '#1e293b', '#f59e0b'] },
  { id: 'spirilux', name: 'Spiriluxe', colors: ['#581c87', '#7c3aed', '#a78bfa'] },
  { id: 'leroi', name: 'Le Roi Shop', colors: ['#1e40af', '#3b82f6', '#60a5fa'] },
  { id: 'iyco', name: 'IYCO', colors: ['#0f172a', '#312e81', '#6366f1'] },
  { id: 'primo', name: 'Primo', colors: ['#f59e0b', '#fbbf24', '#fcd34d'] },
];

async function generatePreview(template: typeof TEMPLATES[0]) {
  const width = 400;
  const height = 500;

  // Create gradient background as SVG
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="135%" y2="100%">
          <stop offset="0%" stop-color="${template.colors[0]}" />
          <stop offset="50%" stop-color="${template.colors[1]}" />
          <stop offset="100%" stop-color="${template.colors[2]}" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      
      <!-- Fake UI elements -->
      <rect x="20" y="20" width="${width - 40}" height="40" rx="8" fill="rgba(255,255,255,0.15)" />
      <rect x="30" y="30" width="60" height="20" rx="4" fill="rgba(255,255,255,0.25)" />
      <rect x="${width - 90}" y="30" width="40" height="20" rx="4" fill="rgba(255,255,255,0.25)" />
      
      <!-- Product grid -->
      <rect x="20" y="80" width="${(width - 60) / 2}" height="160" rx="8" fill="rgba(255,255,255,0.12)" />
      <rect x="${(width - 60) / 2 + 40}" y="80" width="${(width - 60) / 2}" height="160" rx="8" fill="rgba(255,255,255,0.12)" />
      <rect x="20" y="260" width="${(width - 60) / 2}" height="160" rx="8" fill="rgba(255,255,255,0.12)" />
      <rect x="${(width - 60) / 2 + 40}" y="260" width="${(width - 60) / 2}" height="160" rx="8" fill="rgba(255,255,255,0.12)" />
      
      <!-- Fake text lines -->
      <rect x="30" y="250" width="100" height="10" rx="3" fill="rgba(255,255,255,0.3)" />
      <rect x="30" y="265" width="70" height="8" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="${(width - 60) / 2 + 50}" y="250" width="100" height="10" rx="3" fill="rgba(255,255,255,0.3)" />
      <rect x="${(width - 60) / 2 + 50}" y="265" width="70" height="8" rx="3" fill="rgba(255,255,255,0.2)" />
      
      <!-- Bottom bar -->
      <rect x="0" y="${height - 50}" width="${width}" height="50" fill="rgba(0,0,0,0.3)" />
      <rect x="20" y="${height - 35}" width="60" height="20" rx="4" fill="rgba(255,255,255,0.2)" />
      <rect x="${width / 2 - 30}" y="${height - 35}" width="60" height="20" rx="4" fill="rgba(255,255,255,0.2)" />
      <rect x="${width - 80}" y="${height - 35}" width="60" height="20" rx="4" fill="rgba(255,255,255,0.2)" />
      
      <!-- Template name -->
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" 
            font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.9)">
        ${template.name}
      </text>
    </svg>
  `;

  const outputPath = path.join('/home/skull/Desktop/ecopro/uploads/templates', `${template.id}.png`);
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
  
  console.log(`✓ Generated ${template.id}.png`);
}

async function main() {
  for (const template of TEMPLATES) {
    await generatePreview(template);
  }
  console.log('\nAll template previews generated!');
}

main().catch(console.error);

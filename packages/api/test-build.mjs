import dotenv from 'dotenv';
dotenv.config();
import { getCharacterEquipment, transformEquipment } from './src/services/blizzard.js';
import { analyzeCharacterBuild } from './src/services/buildAnalysis.js';

try {
  console.log('Fetching Dlenian equipment from Blizzard API...');
  const raw = await getCharacterEquipment('Dlenian', 'sanguino', 'eu');

  if (!raw) {
    console.log('ERROR: No equipment data returned (404 or API error)');
    process.exit(1);
  }

  console.log('Got raw equipment data:', raw.equipped_items?.length, 'items');
  console.log('---');

  const transformed = transformEquipment(raw);

  console.log('=== TRANSFORMED EQUIPMENT ===');
  console.log('Average iLvl:', transformed.aggregated.averageItemLevel);
  console.log('Stat Distribution:', JSON.stringify(transformed.aggregated.statDistribution));
  console.log('Total Stats:', JSON.stringify(transformed.aggregated.totalStats));
  console.log('');
  console.log('Enchant Audit:');
  console.log('  Enchanted:', transformed.enchantAudit.enchanted + '/' + transformed.enchantAudit.total);
  console.log('  Missing:', transformed.enchantAudit.missing.join(', ') || 'none');
  console.log('  Present:', transformed.enchantAudit.present.join(', ') || 'none');
  console.log('');
  console.log('Gem Audit:');
  console.log('  Sockets:', transformed.gemAudit.filled + '/' + transformed.gemAudit.totalSockets, 'filled');
  console.log('  Empty slots:', transformed.gemAudit.emptySlots.join(', ') || 'none');
  console.log('');
  console.log('Items by slot:');
  for (const item of transformed.items) {
    const enchStr = item.enchant ? ' [E:' + item.enchant.substring(0, 30) + ']' : '';
    const gemStr = item.gems.length ? ' [G:' + item.gems.length + ']' : '';
    const emptyStr = item.emptySockets ? ' [EMPTY SOCKETS:' + item.emptySockets + ']' : '';
    console.log('  ' + item.slot.padEnd(12) + ' ilvl ' + String(item.itemLevel).padEnd(4) + item.name.substring(0, 35) + enchStr + gemStr + emptyStr);
  }

  console.log('');
  console.log('=== BUILD ANALYSIS (Monk / Brewmaster) ===');
  const result = analyzeCharacterBuild(transformed, 'Monk', 'Brewmaster', null);

  console.log('Stat Alignment:', result.statAnalysis.alignment);
  console.log('Spec Priority:', result.statAnalysis.specPriority.join(' > '));
  console.log('Details:');
  for (const d of result.statAnalysis.details) {
    console.log('  ' + d.stat.padEnd(14) + d.playerPct + '%' + (d.isTopPriority ? ' (TOP PRIORITY)' : '') + ' [rank ' + d.rank + ']');
  }

  console.log('');
  console.log('=== GEAR TIPS ===');
  for (const tip of result.gearTips) {
    console.log('[' + tip.severity.toUpperCase() + '] ' + tip.key);
    console.log('  Data:', JSON.stringify(tip.data));
  }

  if (result.gearTips.length === 0) {
    console.log('(no tips generated)');
  }
} catch (err) {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Status:', err.response.status);
    console.error('Data:', JSON.stringify(err.response.data));
  }
}

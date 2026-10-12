import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
const require = createRequire(
  realpathSync(
    new URL('../apps/web/node_modules/next/package.json', import.meta.url),
  ),
);
const sharp = require('sharp');
await sharp('OfficialAssets/10-cerberus-retro-pixel-icon.png')
  .flatten({ background: '#f4f3ec' })
  .resize(1024, 1024, { kernel: 'nearest' })
  .png()
  .toFile('apps/mobile/assets/icon.png');

import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
const require = createRequire(
  realpathSync(
    new URL('../apps/web/node_modules/next/package.json', import.meta.url),
  ),
);
const sharp = require('sharp');
await sharp('apps/mobile/assets/icon.svg')
  .resize(1024, 1024)
  .png()
  .toFile('apps/mobile/assets/icon.png');

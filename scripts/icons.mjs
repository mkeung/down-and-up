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

// Adaptive icons avoid the launcher's extra padding around legacy icons.
// Keep the portrait inside Android's masked viewport and extend its backdrop.
await sharp('OfficialAssets/10-cerberus-retro-pixel-icon.png')
  .flatten({ background: '#f4f3ec' })
  .resize(720, 720, { kernel: 'nearest' })
  .extend({ top: 152, bottom: 152, left: 152, right: 152, extendWith: 'copy' })
  .png()
  .toFile('apps/mobile/assets/android-icon-foreground.png');

// A native vector circle keeps the splash backdrop flat and its edge clean.
const splashCircle = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><circle cx="512" cy="512" r="480" fill="#b7d7bd"/></svg>',
);
const happyPortrait = await sharp(
  'OfficialAssets/11-cerberus-happy-transparent.png',
)
  .resize(832, 832, { kernel: 'nearest' })
  .png()
  .toBuffer();
await sharp(splashCircle)
  .composite([{ input: happyPortrait, left: 96, top: 96 }])
  .png()
  .toFile('apps/mobile/assets/splash.png');

// Preserve the cutout alpha for the roaming character on both main tabs.
await sharp('OfficialAssets/01f-cerberus-retro-pixel-transparent.png')
  .resize(384, 384, { kernel: 'nearest' })
  .png()
  .toFile('apps/mobile/assets/cerberus.png');

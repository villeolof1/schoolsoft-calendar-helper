import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const iconsDir = path.join(root, 'src-tauri', 'icons');
const iconPath = path.join(iconsDir, 'icon.ico');

if (fs.existsSync(iconPath)) {
  console.log(`Icon already exists: ${iconPath}`);
  process.exit(0);
}

// Temporary 16x16 ICO used only so early Tauri builds have a Windows icon.
// Replace later with a real designed icon.
const bytes = [
0,0,1,0,1,0,16,16,0,0,0,0,32,0,241,0,0,0,22,0,0,0,137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,
0,16,0,0,0,16,8,6,0,0,0,31,243,255,97,0,0,0,184,73,68,65,84,120,156,99,148,212,117,251,207,64,1,96,1,
62,68,51,3,3,3,3,11,140,161,27,154,71,146,198,203,171,39,81,199,5,3,111,0,131,164,174,219,127,24,134,
129,45,251,78,96,176,145,197,254,255,255,15,215,67,148,11,84,42,3,113,202,177,32,115,182,238,63,137,
193,206,223,213,129,68,87,48,48,48,48,48,120,59,154,195,213,161,184,192,219,209,28,46,153,191,171,3,
69,225,68,183,10,20,121,24,96,68,78,137,179,39,54,161,216,138,172,25,221,34,41,61,119,76,47,32,76,1,
75,64,49,196,219,209,156,97,235,254,147,24,182,99,120,1,89,195,157,246,245,12,12,12,12,112,26,155,10,
2,12,47,48,48,48,48,60,187,180,19,171,66,100,0,115,62,86,3,72,5,20,167,68,0,70,192,96,188,114,72,110,
35,0,0,0,0,73,69,78,68,174,66,96,130
];

fs.mkdirSync(iconsDir, { recursive: true });
fs.writeFileSync(iconPath, Buffer.from(bytes));
console.log(`Created temporary Tauri icon: ${iconPath}`);

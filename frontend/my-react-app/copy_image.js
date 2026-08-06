import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url || 'file://' + __filename));
const source = path.join(__dirname, 'build', 'assets', '8ea19adb-4948-471f-9643-f06220d8c3e7.png');
const dest = path.join(__dirname, 'public', 'banner.png');
try {
  fs.copyFileSync(source, dest);
  console.log("Successfully copied banner image to public/banner.png!");
} catch (err) {
  console.error("Error copying file:", err);
}

import * as fs from 'fs';
import * as path from 'path';

function findNewFiles(dir: string) {
  try {
    const list = fs.readdirSync(dir);
    for (const f of list) {
      if (f === 'node_modules' || f === '.git' || f === 'dist' || f === '.npm' || f === '.cache' || f === 'tmp') continue;
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        findNewFiles(p);
      } else {
        const ext = path.extname(f).toLowerCase();
        // If it's any image or any newly added file, we want to know
        const isImage = /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f);
        const mtime = stat.mtimeMs;
        const now = Date.now();
        const minsAgo = (now - mtime) / 1000 / 60;
        
        if (isImage || minsAgo < 15) {
          console.log(`NEW/IMAGE FILE: ${p} (${stat.size} bytes, ${minsAgo.toFixed(1)} mins ago)`);
        }
      }
    }
  } catch (e) {}
}

console.log('Searching process.cwd():', process.cwd());
findNewFiles(process.cwd());

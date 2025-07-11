import fs from 'fs';
import path from 'path';

export class VendorLookup {
  private map24 = new Map<string, string>();
  private map28 = new Map<string, string>();
  private map36 = new Map<string, string>();
  private loaded = false;

  constructor(private dataDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../mac-vendors')) {
    this.load();
  }

  private load() {
    if (this.loaded) return;
    this.loadFile('oui.csv', this.map24, 6);
    this.loadFile('mam.csv', this.map28, 7);
    this.loadFile('oui36.csv', this.map36, 9);
    this.loaded = true;
  }

  private loadFile(fileName: string, map: Map<string, string>, len: number) {
    const filePath = path.join(this.dataDir, fileName);
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.startsWith('version https://git-lfs.github.com/spec')) {
      return; // LFS placeholder, skip
    }
    const lines = content.split(/\r?\n/);
    lines.shift(); // header
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const assignment = parts[1].replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
      const vendor = parts[2].replace(/^"|"$/g, '').trim();
      if (assignment) {
        map.set(assignment.slice(0, len), vendor);
      }
    }
  }

  getVendor(mac: string): string {
    const clean = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    if (clean.length < 6) return 'Unknown';
    const p36 = clean.slice(0, 9);
    if (this.map36.has(p36)) return this.map36.get(p36)!;
    const p28 = clean.slice(0, 7);
    if (this.map28.has(p28)) return this.map28.get(p28)!;
    const p24 = clean.slice(0, 6);
    if (this.map24.has(p24)) return this.map24.get(p24)!;
    return 'Unknown';
  }
}

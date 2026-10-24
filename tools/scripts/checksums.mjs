// FORMAT: dist/SHA256SUMS.txt in the format sha256sum -c reads.
import {createHash} from 'node:crypto';
import {createReadStream, readdirSync, writeFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const dir = 'dist';
const wanted = /\.(dmg|zip|exe|msi|AppImage|deb|rpm)$/;
const files = readdirSync(dir).filter(f => wanted.test(f) && statSync(join(dir, f)).isFile()).sort();
if (!files.length) { console.error('No installers in dist/'); process.exit(1); }

const sha = f => new Promise((ok, fail) => {
  const h = createHash('sha256');
  createReadStream(join(dir, f)).on('data', d => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', fail);
});
const lines = [];
for (const f of files) lines.push(`${await sha(f)}  ${f}`);
writeFileSync(join(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));

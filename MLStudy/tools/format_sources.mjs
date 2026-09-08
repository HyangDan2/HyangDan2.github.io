// Format file syntax while preserving whitespace-sensitive HTML and embedded strings.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const prettier = process.env.MLSTUDY_NODE_MODULES
  ? require(path.join(process.env.MLSTUDY_NODE_MODULES, 'prettier'))
  : require('prettier');
const beautify = process.env.MLSTUDY_NODE_MODULES
  ? require(path.join(process.env.MLSTUDY_NODE_MODULES, 'js-beautify'))
  : require('js-beautify');
const config = JSON.parse(await readFile(path.join(root, '.prettierrc.json'), 'utf8'));
const input = [];
for await (const chunk of process.stdin) input.push(chunk);
const files = JSON.parse(Buffer.concat(input).toString());
const check = process.argv.includes('--check');
let changed = 0;
for (const file of files) {
  const before = await readFile(file, 'utf8');
  let after;
  if (file.endsWith('.html')) {
    const options = {
      indent_size: 2,
      indent_inner_html: true,
      wrap_line_length: 100,
      extra_liners: [],
      content_unformatted: ['pre', 'code', 'script', 'style', 'textarea'],
      end_with_newline: true
    };
    after = before;
    // Wrapping legacy inline markup can settle on a later pass.
    for (let pass = 0; pass < 10; pass++) {
      const next = beautify.html(after, options);
      if (next === after) break;
      after = next;
      if (pass === 9) throw new Error('HTML formatting did not stabilize: ' + file);
    }
  } else {
    after = await prettier.format(before, { ...config, filepath: file });
  }
  if (before !== after) {
    changed++;
    if (check) console.error(path.relative(root, file));
    else await writeFile(file, after);
  }
}
console.log(
  `Web sources: ${files.length} checked, ${changed} ${check ? 'need formatting' : 'formatted'}.`
);
if (check && changed) process.exitCode = 1;

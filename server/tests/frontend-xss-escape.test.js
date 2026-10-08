import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const source = readFileSync(new URL('../../public/js/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const grab = name => {
  const match = source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}\\n`));
  assert.ok(match, `função ${name} não encontrada em app.js`);
  return match[0];
};
const { escapeHtml, jsArg } = new Function(`${grab('escapeHtml')}\n${grab('jsArg')}\nreturn { escapeHtml, jsArg };`)();

test('escapeHtml neutraliza & < > " e \'', () => {
  assert.equal(escapeHtml(`<img src=x onerror=alert(1)> & "a" 'b'`),
    '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;a&quot; &#039;b&#039;');
});

test('jsArg mantém o valor como string literal dentro de onclick, sem executar código injetado', () => {
  const window = new Window();
  for (const payload of [`'); alert(1); ('`, `"); alert(1); ("`, '<img src=x onerror=alert(1)>', `a\\'b&amp;`, '']) {
    window.document.body.innerHTML = `<button id="b" onclick="window.got = [${jsArg(payload)}, 2]">x</button>`;
    const attr = window.document.getElementById('b').getAttribute('onclick');
    const sandbox = {};
    new Function('window', attr)(sandbox);
    assert.deepEqual(sandbox.got, [payload, 2]);
  }
  window.close();
});

test('app.js não monta handler inline com valor entre aspas simples interpoladas', () => {
  assert.doesNotMatch(source, /\bon[a-z]+="[^"\n]*'\$\{/);
});

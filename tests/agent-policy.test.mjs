// Защита от возвращения автоматической подписи ИИ при запуске в отдельном клоне.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('подпись ИИ отключена, Claude читает правила авторства проекта', () => {
  const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const settings = JSON.parse(read('.claude/settings.json'));
  assert.equal(settings.attribution.commit, '');
  assert.equal(settings.attribution.sessionUrl, false);
  assert.match(read('CLAUDE.md'), /AGENTS\.md/);
  assert.match(read('CLAUDE.md'), /Не отмечай себя в коммитах/);
  assert.match(read('AGENTS.md'), /Не добавляй Claude/);
});

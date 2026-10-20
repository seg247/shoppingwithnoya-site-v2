import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const file = fs.readdirSync('scripts').find(f => f.startsWith('product-'));
const { assertProductIdentity } = require('../scripts/' + file);
const asin = 'B003OB0JHG';
const merchantTitle = 'Maruchan Instant Lunch Ramen Noodles, Cheddar Cheese Flavor – Japanese-Style Instant Noodle Soup, Easy Meal Ready in 3 Minutes – 2.25 Oz. (12 Pack)';
const ok = t => assertProductIdentity({ asin, sourceTitle: t, merchantTitle, requireSource: true });

test('title cut mid-word at 120 chars still matches', () => {
  const cut = merchantTitle.replace(/–/g, '–').slice(0, 120).replace(/Minutes.*/, 'M');
  const t = 'Maruchan Instant Lunch Ramen Noodles, Cheddar Cheese Flavor – Japanese-Style Instant Noodle Soup, Easy Meal Ready in 3 M';
  assert.ok(t.length >= 100 && cut);
  assert.equal(ok(t).status, 'matched');
});
test('a wrong word in the middle still fails', () => {
  assert.throws(() => ok('Maruchan Instant Lunch Ramen Noodles, Chicken Flavor – Japanese-Style Instant Noodle Soup, Easy Meal Ready in 3 M'));
});
test('short titles get no prefix leniency', () => {
  assert.throws(() => ok('Maruchan Instant Lunch Ramen Noodles Cheddar Cheese Flav'));
});

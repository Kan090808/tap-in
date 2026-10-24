const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../gas/Code.gs'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'Code.gs' });

test('signed pay adjustments accumulate within a month', () => {
  const sum = vm.runInContext('sumPayAdjustments_', context);
  assert.equal(sum([{ payAmount: 50 }, { payAmount: -20 }]), 30);
  assert.equal(5200 + sum([{ payAmount: 50 }, { payAmount: -20 }]), 5230);
});

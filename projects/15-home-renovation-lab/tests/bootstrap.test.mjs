import test from 'node:test';
import assert from 'node:assert/strict';

test('project bootstrap sanity', () => {
  const content = {
    project: 'Home Renovation Lab',
    version: '0.1.0',
  };
  assert.equal(typeof content.project, 'string');
  assert.equal(content.version, '0.1.0');
});

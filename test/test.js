'use strict';

import { assert } from 'chai';
import AnySQLWebSQL from '../src';

describe('AnySQLWebSQL', function() {
  let db = new AnySQLWebSQL('websql:test');

  it('should perform a simple operation', async function() {
    let result = await db.query('SELECT ? + ? AS solution', [2, 3]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].solution, 5);
  });

  it('should perform simple queries', async function() {
    await db.query('CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)');

    let result = await db.query('INSERT INTO people (name, age) VALUES (?, ?)', ['Jean Dupont', 33]);
    assert.strictEqual(result.insertId, 1);

    result = await db.query('SELECT * FROM people');
    assert.deepEqual(result[0], { id: 1, name: 'Jean Dupont', age: 33 });

    await db.query('DROP TABLE people');
  });
});

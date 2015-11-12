'use strict';

import AwaitLock from 'await-lock';

export class AnySQLWebSQL {
  constructor(url) {
    if (!url) throw new Error('URL is missing');
    let pos = url.indexOf(':');
    let name = pos === -1 ? url : url.substr(pos + 1);
    if (!name) throw new Error('WebSQL database name is missing');
    let version = '1.0';
    let displayName = name;
    let maxSize = 50 * 1024 * 1024; // 50 MB
    this.websql = openDatabase(name, version, displayName, maxSize);
    this.awaitLock = new AwaitLock();
  }

  async lock(fn) {
    await this.awaitLock.acquireAsync();
    try {
      return await fn();
    } finally {
      this.awaitLock.release();
    }
  }

  async query(sql, values) {
    return await this.lock(async function() {
      return await this._query(sql, values);
    }.bind(this));
  }

  async _query(sql, values) {
    values = this.normalizeValues(values);
    let result = await this.__query(sql, values);
    result = this.normalizeResult(result);
    return result;
  }

  async __query(sql, values) {
    return new Promise((resolve, reject) => {
      let result;
      this.websql.transaction(function(tr) {
        tr.executeSql(sql, values, function(innerTr, res) {
          result = res;
        });
      }, function(err) { // transaction error callback
        reject(err);
      }, function() { // transaction success callback
        resolve(result);
      });
    });
  }

  async transaction(fn) {
    return await this.lock(async function() {
      return await fn({ query: this._query.bind(this) });
    }.bind(this));
  }

  async close() {
    // NOOP
  }

  normalizeValues(values) {
    if (values && values.length) {
      values = values.map(function(val) {
        if (typeof val === 'undefined') {
          val = null;
        } else if (Buffer.isBuffer(val)) {
          val = 'bin!' + val.toString('hex');
        }
        return val;
      });
    }
    return values;
  }

  normalizeResult(result) {
    if (!result) return result;
    let normalizedResult = [];
    if (result.rowsAffected != null) {
      normalizedResult.affectedRows = result.rowsAffected;
    }
    try {
      if (result.insertId != null) {
        normalizedResult.insertId = result.insertId;
      }
    } catch (err) {
      // noop
    }
    if (!result.rows) return normalizedResult;
    for (let i = 0; i < result.rows.length; i++) {
      let row = result.rows.item(i);
      let normalizedRow = {};
      for (let key in row) {
        if (row.hasOwnProperty(key)) {
          let val = row[key];
          if (val && val.substr && val.substr(0, 4) === 'bin!') {
            val = new Buffer(val.substr(4), 'hex');
          }
          normalizedRow[key] = val;
        }
      }
      normalizedResult.push(normalizedRow);
    }
    return normalizedResult;
  }
}

export default AnySQLWebSQL;

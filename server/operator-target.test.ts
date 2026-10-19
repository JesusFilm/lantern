import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertOperatorEndpoint} from './operator-target.js';

test('operator endpoint accepts explicit libpq TLS compatibility and rejects endpoint or unknown overrides',()=>{
 const endpoint='proxy.example.test:5432';
 assert.doesNotThrow(()=>assertOperatorEndpoint(`postgresql://synthetic@${endpoint}/railway?sslmode=verify-ca&uselibpqcompat=true&sslrootcert=/tmp/synthetic-ca.pem`,endpoint));
 assert.throws(()=>assertOperatorEndpoint(`postgresql://synthetic@${endpoint}/railway?unsupported=value`,endpoint));
 assert.throws(()=>assertOperatorEndpoint(`postgresql://synthetic@${endpoint}/railway`,'wrong.example.test:5432'));
});

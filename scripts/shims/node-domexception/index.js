'use strict';
// Stand-in for node-domexception 1.0.0 (deprecated: "use your platform's native DOMException"),
// pulled in by node-fetch -> fetch-blob. Node 17+ has DOMException as a global, which is all
// the original exported on current Node.
module.exports = globalThis.DOMException;

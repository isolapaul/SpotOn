'use strict';
// Stand-in for json-ptr 3.1.1 (withdrawn from npm), pulled in only by firebase-tools -> exegesis.
// exegesis uses JsonPointer.decode, encodePointer and encodeUriFragmentIdentifier; they behave
// as in json-ptr (RFC 6901 pointers and their URI fragment form).

const unescapeToken = (s) => s.split('~1').join('/').split('~0').join('~');
const escapeToken = (s) => s.split('~').join('~0').split('/').join('~1');
const mapStrings = (segments, fn) => segments.map((s) => (typeof s === 'string' ? fn(s) : s));

function assertPath(path) {
  if (!Array.isArray(path)) throw new TypeError('Invalid type: path must be an array of segments.');
}

function decodePointer(ptr) {
  if (typeof ptr !== 'string') throw new TypeError('Invalid type: JSON Pointers are represented as strings.');
  if (ptr.length === 0) return [];
  if (ptr[0] !== '/') throw new ReferenceError('Invalid JSON Pointer syntax. Non-empty pointer must begin with a solidus `/`.');
  return mapStrings(ptr.substring(1).split('/'), unescapeToken);
}

function decodeUriFragmentIdentifier(ptr) {
  if (typeof ptr !== 'string') throw new TypeError('Invalid type: JSON Pointers are represented as strings.');
  if (ptr.length === 0 || ptr[0] !== '#') throw new ReferenceError('Invalid JSON Pointer syntax; URI fragment identifiers must begin with a hash.');
  if (ptr.length === 1) return [];
  if (ptr[1] !== '/') throw new ReferenceError('Invalid JSON Pointer syntax.');
  return mapStrings(ptr.substring(2).split('/'), (s) => unescapeToken(decodeURIComponent(s)));
}

function encodePointer(path) {
  assertPath(path);
  return path.length === 0 ? '' : '/' + mapStrings(path, escapeToken).join('/');
}

function encodeUriFragmentIdentifier(path) {
  assertPath(path);
  return path.length === 0 ? '#' : '#/' + mapStrings(path, (s) => encodeURIComponent(escapeToken(s))).join('/');
}

class JsonPointer {
  static decode(pointer) {
    if (Array.isArray(pointer)) return pointer.slice(0);
    return typeof pointer === 'string' && pointer[0] === '#'
      ? decodeUriFragmentIdentifier(pointer)
      : decodePointer(pointer);
  }
}

module.exports = {
  JsonPointer,
  decodePointer,
  decodeUriFragmentIdentifier,
  encodePointer,
  encodeUriFragmentIdentifier,
};

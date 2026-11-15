// Stands in for Next's always-included polyfill module (next.config.ts). Every browser the site
// targets (package.json "browserslist": Safari 16.4+, Chrome/Edge/Firefox 111+) already has
// Array#at/flat/flatMap, Object.fromEntries/hasOwn, String#trimStart/trimEnd and Promise#finally.

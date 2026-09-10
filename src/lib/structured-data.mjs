// JSON-LD uses an HTML raw-text element: JSON escaping alone does not prevent
// a feed title containing </script> from ending it. Keep the parsed value intact.
export function serializeStructuredData(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

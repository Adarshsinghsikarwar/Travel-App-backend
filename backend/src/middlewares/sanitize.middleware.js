// Strips Mongo operator keys ($gt, $where, etc.) and dotted keys from
// req.body/query/params to block NoSQL injection — e.g. {"email": {"$gt": ""}}.
//
// We mutate objects IN PLACE instead of reassigning req.query/req.body wholesale.
// express-mongo-sanitize does the latter, which breaks on modern Express/Node
// because req.query is a getter-only property there (no setter) — this avoids
// that incompatibility entirely while doing the same job.

function stripBadKeys(obj) {
  if (obj === null || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach(stripBadKeys);
    return;
  }

  for (const key in Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
      continue;
    }
    stripBadKeys(obj[key]);
  }
}

function sanitizeInputs(req, res, next) {
  stripBadKeys(req.body);
  stripBadKeys(req.query);
  stripBadKeys(req.params);
  next();
}

export { sanitizeInputs };

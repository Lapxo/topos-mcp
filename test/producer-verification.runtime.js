// ../../../../head021-work/topos-mcp-response-contract/repository/node_modules/@lapxo/topos/dist/wire/outcome.js
var fact = (value) => ({ kind: "fact", value });
var abstain = (why) => ({ kind: "abstain", why });
var refuse = (why, named) => ({ kind: "refuse", why, ...named === void 0 ? {} : { named } });

// ../../../../head021-work/topos-mcp-response-contract/repository/node_modules/@lapxo/topos/dist/wire/values.js
function unpipe(value) {
  const out = [];
  let at = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "\\") {
      const next = value[i + 1];
      if (next !== "|" && next !== "\\")
        return null;
      at += next;
      i += 1;
    } else if (c === "|") {
      out.push(at);
      at = "";
    } else {
      at += c;
    }
  }
  out.push(at);
  return out;
}
var OPEN = "*";
var num = (s) => {
  if (!/^-?\d+(\.\d+)?$/.test(s))
    return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
};
var GRAMMARS = {
  interval: (value) => {
    const at = value.indexOf("..");
    if (at < 0)
      return null;
    const lo = value.slice(0, at);
    const hi = value.slice(at + 2);
    const l = lo === OPEN ? null : num(lo);
    const h = hi === OPEN ? null : num(hi);
    if (lo !== OPEN && l === null || hi !== OPEN && h === null)
      return null;
    return { kind: "interval", lo: l, hi: h };
  },
  alphabet: (value) => {
    const values = unpipe(value);
    return values === null ? null : { kind: "enumerated", values };
  },
  ladder: (value) => {
    const parts = unpipe(value);
    if (parts === null || parts.length !== 2)
      return null;
    return { kind: "band", floor: parts[0] ?? "", ceiling: parts[1] ?? "" };
  }
};
function boundOf(form, value, grammars) {
  const extra = Array.isArray(grammars) ? grammars.find((g) => g.form === form) : void 0;
  if (extra)
    return extra.parse(value);
  return GRAMMARS[form]?.(value) ?? null;
}
var BOUND_FORMS = Object.keys(GRAMMARS);

// ../../../../head021-work/topos-mcp-response-contract/repository/node_modules/@lapxo/topos/dist/wire/line.js
var PROTOCOL = "bound-lock/1";
var NEEDS_QUOTE = /[ ="\n\\]/;
function unescape(token) {
  if (!token.startsWith('"'))
    return NEEDS_QUOTE.test(token) ? null : token;
  if (token.length < 2 || !token.endsWith('"'))
    return null;
  const body = token.slice(1, -1);
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== "\\") {
      if (c === '"')
        return null;
      out += c;
      continue;
    }
    const next = body[i + 1];
    if (next === '"')
      out += '"';
    else if (next === "\\")
      out += "\\";
    else if (next === "n")
      out += "\n";
    else
      return null;
    i += 1;
  }
  return out;
}
var UTF8 = new TextEncoder();
var unwritten = (fields) => fields["form"] === "interval" && fields["value"] !== void 0 && fields["value"] !== "withdraw" && boundOf("interval", fields["value"]) === null;
var ABSENT = "-";
function parse(text, options = {}) {
  if (text.includes("\n")) {
    return refuse("a line is one line \u2014 a newline in a value must be escaped as `\\n`");
  }
  const space = text.indexOf(" ");
  const envelope = space === -1 ? text : text.slice(0, space);
  const [name, version] = envelope.split("/");
  if (name !== PROTOCOL.split("/")[0] || !version) {
    return refuse(`no \`bound-lock/<v>\` envelope \u2014 found \`${envelope.slice(0, 24)}\``);
  }
  if (version !== PROTOCOL.split("/")[1]) {
    return abstain(`\`bound-lock/${version}\` is a version this reader does not know`);
  }
  const fields = {};
  const writtenKeys = /* @__PURE__ */ new Set();
  for (const token of tokensOf(space === -1 ? "" : text.slice(space + 1))) {
    if (token === null)
      return refuse("a quoted value is not closed");
    const at = token.indexOf("=");
    if (at <= 0)
      return refuse(`\`${token.slice(0, 24)}\` is not \`key=value\``);
    const key = token.slice(0, at);
    if (writtenKeys.has(key))
      return refuse(`\`${key}\` appears twice \u2014 one line, one value per key`);
    writtenKeys.add(key);
    const value = unescape(token.slice(at + 1));
    if (value === null)
      return refuse(`\`${key}\` has an escaping this format does not define`);
    if (value !== ABSENT)
      fields[key] = value;
  }
  if (unwritten(fields))
    return refuse(`\`${fields["value"]}\` is no interval the wire reads: two ends, each decimal or *`);
  return fact({ version, fields, ...options.preserveKeys ? { keys: [...writtenKeys] } : {} });
}
function* tokensOf(rest) {
  let at = 0;
  while (at < rest.length) {
    while (rest[at] === " ")
      at += 1;
    if (at >= rest.length)
      return;
    let end = at;
    let quoted = false;
    while (end < rest.length && (quoted || rest[end] !== " ")) {
      if (rest[end] === "\\" && quoted)
        end += 1;
      else if (rest[end] === '"')
        quoted = !quoted;
      end += 1;
    }
    if (quoted) {
      yield null;
      return;
    }
    yield rest.slice(at, end);
    at = end;
  }
}

// test/producer-verification.js
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
var hash = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");
function run(place) {
  const bytes = readFileSync("samples/verification/yes/capture.json");
  if (hash(bytes) !== "sha256:0f761ccf464951e785a58b347d6cc2814a6c43a1048e9666580751e8287bb270") throw Error("REFUSE\xB7verification/capture");
  const c = JSON.parse(bytes);
  for (const f of c.inputs) if (hash(readFileSync(f.path)) !== f.sha256) throw Error("REFUSE\xB7verification/current-input " + f.path);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + "/" + e.name) : [d + "/" + e.name]);
  if (JSON.stringify(walk("src").filter((p) => p.endsWith(".ts")).sort()) !== JSON.stringify(c.sourceInventory)) throw Error("REFUSE\xB7verification/source-inventory");
  for (const r of c.runs) if (!["22", "24"].includes(r.node) || hash(Buffer.from(r.log)) !== r.sha256 || r.tests !== 45) throw Error("REFUSE\xB7verification/runs");
  const policy = readFileSync("TARGET.bound", "utf8").split("\n").map(parse).flatMap((p) => p.kind === "fact" ? [p.value.fields] : []);
  for (const row of [{ "scope": "docs/tagline", "measure": "text", "role": "writes", "value": "lock" }, { "scope": "read/rate", "measure": "calls-per-hour", "role": "reads", "value": "0..60" }, { "scope": "read/response-bytes", "measure": "bytes", "role": "reads", "value": "0..1048576" }, { "scope": "read/pages", "measure": "pages", "role": "reads", "value": "0..1" }, { "scope": "form/mcp/hint/unhinted", "measure": "id", "role": "writes", "value": "write" }, { "scope": "write/calls", "measure": "calls", "role": "reads", "value": "0..0" }, { "scope": "private", "measure": "status", "role": "writes", "value": "present" }, { "scope": "read/items", "measure": "members", "role": "reads", "value": "0..50" }, { "scope": "form/mcp/unstated", "measure": "id", "role": "writes", "value": "unstated" }, { "scope": "form/mcp/hint/read-only", "measure": "id", "role": "writes", "value": "read" }, { "scope": "form/mcp/split", "measure": "id", "role": "writes", "value": "split" }, { "scope": "wire/digest-algorithms", "measure": "id", "role": "reads", "value": "sha256:era1" }, { "scope": "capsule/domain", "measure": "id", "role": "writes", "value": "servers" }, { "scope": "view/readme", "measure": "id", "role": "demands", "value": "text" }, { "scope": "wire/era", "measure": "id", "role": "reads", "value": "era1" }, { "scope": "audit/wire/families", "measure": "id", "role": "reads", "value": "audit|beat|block|cites|comments|concept|cost|dep|effect|fold|hazard|keys|law|license|lines|literal|offers|question|reader|region|render|roles|sample|session|take|test|tree|vector|view|write" }, { "scope": "audit/wire/fields", "measure": "id", "role": "reads", "value": "scope|role|form|measure|value|by|at|needs|sig|epoch|shape|restsOn|condition|about|kind|view" }, { "scope": "audit/wire/receipt-fields", "measure": "id", "role": "reads", "value": "scope|role|measure|form|value|at" }, { "scope": "audit/wire/forms", "measure": "id", "role": "reads", "value": "interval|alphabet|ladder" }, { "scope": "view/gitignore", "measure": "id", "role": "demands", "value": "text" }, { "scope": "capsule/key", "measure": "id", "role": "writes", "value": "mcp" }, { "scope": "lang", "measure": "id", "role": "writes", "value": "en" }, { "scope": "signer/timeout", "measure": "milliseconds", "role": "writes", "value": "30000..30000" }, { "scope": "view/manifest", "measure": "id", "role": "demands", "value": "text" }, { "scope": "signer/response-bytes", "measure": "bytes", "role": "writes", "value": "1048576..1048576" }, { "scope": "form/mcp/access/name", "measure": "id", "role": "writes", "value": "authorization" }, { "scope": "region/place", "measure": "reads", "role": "render", "value": "capsule/**|form/**|mcp/**|region/**|wire/provider-inputs|wire/host-inputs|read/**|write/**" }, { "scope": "view/receipts", "measure": "id", "role": "demands", "value": "receipts@8|receipts@0|receipts@1" }, { "scope": "view/pipeline-release", "measure": "id", "role": "demands", "value": "text" }, { "scope": "audit/wire/roles", "measure": "id", "role": "reads", "value": "reads|writes|demands" }, { "scope": "capsule/runtime", "measure": "id", "role": "writes", "value": "node" }, { "scope": "region/server", "measure": "reads", "role": "receipt", "value": "*.json@*" }, { "scope": "wire/shapes", "measure": "id", "role": "reads", "value": "decision|lock|package|reader|render|run|vector|view" }, { "scope": "wire/signature-algorithms", "measure": "id", "role": "reads", "value": "ed25519|sha256:58f1f0983fe65f062bebefd0a6ffc901049c67525ef12dd86ed4dbb7a184b834|ed25519:era1" }, { "scope": "wire/states", "measure": "id", "role": "reads", "value": "absent|present|unread|withdraw" }, { "scope": "capsule/topos", "measure": "digest", "role": "writes", "value": "sha256:fd7fb3783cad1919a7b0236df096c6b4c0d71d5a2f81fb14532779e1e83da261" }, { "scope": "vector/place", "measure": "digest", "role": "writes", "value": "sha256:63510806891aa8350a42eb0562cce51141a8bdface9effd02fadff70e9993791" }, { "scope": "vector/server", "measure": "digest", "role": "writes", "value": "sha256:a47480497d68a3a14c2ade3f58e82012142a71e78102e8111557daa5674f2958" }, { "scope": "wire/provider-inputs", "measure": "id", "role": "writes", "value": "standing-projection@1" }, { "scope": "wire/host-inputs", "measure": "id", "role": "writes", "value": "client-name" }, { "scope": "capsule/host", "measure": "id", "role": "writes", "value": "flows|calls|credentials" }, { "scope": "form/mcp/capsule/inputs/place", "measure": "reads", "role": "reads", "value": "capsule/key|form/**|read/**|region/**|write/**" }, { "scope": "region/place", "measure": "writes", "role": "writes", "value": "region/**|keys/**|offers/**|read/**|write/**" }, { "scope": "region/server", "measure": "writes", "role": "writes", "value": "mcp/**" }, { "scope": "capsule/effects", "measure": "effects", "role": "writes", "value": "none" }, { "scope": "capsule/holds", "measure": "id", "role": "writes", "value": "./" }, { "scope": "region/checks", "measure": "coordinates", "role": "reads", "value": "vectors/**|samples/**" }, { "scope": "region/project", "measure": "coordinates", "role": "reads", "value": "package.json|tsconfig.json" }, { "scope": "region/source", "measure": "coordinates", "role": "reads", "value": "src/**" }, { "scope": "license", "measure": "id", "role": "writes", "value": "MIT" }, { "scope": "name", "measure": "id", "role": "writes", "value": "@lapxo/topos-mcp" }, { "scope": "topos-mcp/src/lines", "measure": "count", "role": "reads", "value": "0..241" }, { "scope": "form/mcp/hint/destructive", "measure": "id", "role": "writes", "value": "delete" }, { "scope": "form/mcp/capsule/inputs/server", "measure": "reads", "role": "reads", "value": "capsule/key|form/**|read/**|region/**|write/**" }, { "scope": "wire/at-classes", "measure": "id", "role": "reads", "value": "origin|place|receipt|witness|policy" }, { "scope": "wire/fields", "measure": "id", "role": "reads", "value": "scope|role|form|measure|value|by|at|needs|sig|epoch|shape|restsOn|condition|about|kind|view|witness" }, { "scope": "wire/forms", "measure": "id", "role": "reads", "value": "interval|alphabet|ladder" }, { "scope": "wire/required", "measure": "id", "role": "reads", "value": "scope|role|form|measure|value|by|at" }, { "scope": "wire/roles", "measure": "id", "role": "reads", "value": "reads|writes|demands|source|render|receipt" }, { "scope": "capsule/answer-region", "measure": "id", "role": "writes", "value": "mcp-answer" }, { "scope": "form/mcp/response/view", "measure": "id", "role": "writes", "value": "mcp-answer" }, { "scope": "region/mcp-response", "measure": "reads", "role": "receipt", "value": "*.json@*" }, { "scope": "region/mcp-response", "measure": "writes", "role": "writes", "value": "mcp-result/**" }, { "scope": "region/mcp-answer", "measure": "reads", "role": "render", "value": "capsule/**|form/**|mcp/**|mcp-result/**|read/**|region/server|region/mcp-response" }, { "scope": "region/mcp-answer", "measure": "writes", "role": "writes", "value": "answer/**" }, { "scope": "form/mcp/capsule/inputs/mcp-response", "measure": "reads", "role": "reads", "value": "capsule/key|form/**|read/**|region/**|write/**" }, { "scope": "form/mcp/capsule/inputs/mcp-answer", "measure": "reads", "role": "reads", "value": "capsule/key|form/**|read/**|region/**|write/**" }, { "scope": "version", "measure": "id", "role": "writes", "value": "0.1.2" }, { "scope": "form/mcp/capsule", "measure": "digest", "role": "writes", "value": "sha256:1c3c9326e89aabe3a43bf074d0e06b5bbebd1fdb6e06423b957dc03914de051d" }]) if (!policy.some((f) => Object.entries(row).every(([k, v]) => f[k] === v))) throw Error("REFUSE\xB7verification/policy " + row.scope);
  if (c.workflow?.runtimes?.length !== 2 || c.workflow.runtimes.some((r) => r.vectors.length !== 9 || r.vectors.some((v) => !v.noNetwork || v.case === "valid" !== v.simulatedPublication))) throw Error("REFUSE\xB7verification/workflow-vectors");
  const fact2 = (scope, n, measure = "defects") => ({ scope, role: "writes", measure, bound: { kind: "interval", lo: n, hi: n } });
  return place.replace(/\/$/, "") === "samples/verification/yes" ? [fact2("topos-mcp/conformance", 0), fact2("topos-mcp/delivery", 0), fact2("topos-mcp/src/lines", Number(c.physicalLines.regions[0].value.numerator), "count")] : [fact2("topos-mcp/current-inputs", 0)];
}
export {
  run
};

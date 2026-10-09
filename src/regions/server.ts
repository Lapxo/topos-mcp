import { createHash } from 'node:crypto';
import { documentOf, filesOf, list, placeOf, record, said, sourceOf, stepOf, text } from '../helpers/mcp.ts';
import type { Doc, Row } from '../helpers/mcp.ts';

const digest = (body: string): string => `sha256:${createHash('sha256').update(body).digest('hex')}`;
const strings = (v: unknown): readonly string[] => list(v).flatMap((one) => (typeof one === 'string' ? [one] : []));

/** The tools a server lists, as its tools/list result or that result's own record; the hint each tool declares of itself and the parameters it is asked with. */
const tools = (doc: Doc, source: string): readonly Row[] => list(record(doc['result'])['tools'] ?? doc['tools']).flatMap((raw) => ((tool) => ((name) => (name === undefined ? [] : [
  ...said(`mcp/hint/${source}/${stepOf(name)}`, 'id', [tool['annotations'] === undefined ? 'unhinted' : record(tool['annotations'])['readOnlyHint'] === true ? 'read-only' : record(tool['annotations'])['destructiveHint'] === true ? 'destructive' : 'unhinted']),
  ...said(`mcp/params/${source}/${stepOf(name)}`, 'id', Object.keys(record(record(tool['inputSchema'])['properties'])).map(stepOf)),
  ...said(`mcp/required/${source}/${stepOf(name)}`, 'id', strings(record(tool['inputSchema'])['required']).map(stepOf)),
]))(text(tool['name'])))(record(raw)));

/** What a protected resource (RFC 9728) and the server that authorizes it (RFC 8414) say of themselves: where each is, who authorizes, the scopes, where a person is sent, where a code is traded and where a client registers itself (RFC 7591). A document that names its issuer is the authorizer's, read as nothing else, whatever else it repeats. */
const resource = (doc: Doc, source: string): readonly Row[] => (text(doc['resource']) === undefined || text(doc['issuer']) !== undefined ? [] : [
  ...said(`mcp/resource/${source}`, 'id', [text(doc['resource'])]), ...said(`mcp/authorization-servers/${source}`, 'id', strings(doc['authorization_servers'])),
  ...said(`mcp/scopes/${source}`, 'id', strings(doc['scopes_supported'])),
]);

const authorizer = (doc: Doc, source: string): readonly Row[] => (text(doc['issuer']) === undefined || text(doc['authorization_endpoint'] ?? doc['token_endpoint']) === undefined ? [] : [
  ...said(`mcp/issuer/${source}`, 'id', [text(doc['issuer'])]), ...said(`mcp/authorize/${source}`, 'id', [text(doc['authorization_endpoint'])]),
  ...said(`mcp/token-url/${source}`, 'id', [text(doc['token_endpoint'])]), ...said(`mcp/registration/${source}`, 'id', [text(doc['registration_endpoint'])]),
  ...said(`mcp/challenge/${source}`, 'id', strings(doc['code_challenge_methods_supported'])),
]);

/**
 * The server region. It reads every document a place holds beside each other, by what each says and never by its name:
 * a server's tools/list, the metadata of the resource it protects (RFC 9728) and of the server that authorizes it (RFC
 * 8414), each as the source its file names, each reading its own. Every document it read is named by its digest; one
 * that is not JSON is named as unparsed, and one it does not recognise as unrecognised, never read as anything.
 */
export const observe = (bytes: Uint8Array, ...rest: readonly unknown[]): readonly Row[] => {
  const files = ((handed) => (handed.length ? handed : [{ place: placeOf(rest), text: new TextDecoder().decode(bytes) }]))(filesOf(rest));
  const read = files.map(({ place, text: body }) => ((doc, source) => ({ source, body, doc, rows: doc === undefined ? [] : [...tools(doc, source), ...resource(doc, source), ...authorizer(doc, source)] }))(documentOf(body), sourceOf(place)));
  const named = (source: string, kept: (one: (typeof read)[number]) => boolean) => read.filter((one) => one.source === source && kept(one)).map((one) => digest(one.body));
  return [...new Map(read.flatMap((one) => one.rows).map((row) => [`${row.scope} ${row.measure} ${row.bound.values.join('|')}`, row])).values(), ...[...new Set(read.map((one) => one.source))].flatMap((source) => [...said(`mcp/documents/${source}`, 'id', named(source, (one) => one.rows.length > 0)),
    ...said(`mcp/unparsed/${source}`, 'id', named(source, (one) => one.doc === undefined)), ...said(`mcp/unrecognised/${source}`, 'id', named(source, (one) => one.doc !== undefined && !one.rows.length))])];
};

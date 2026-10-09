import { value } from '@lapxo/topos/capsule';
import type { Asked } from '@lapxo/topos/capsule';
import { canonical, steps } from '@lapxo/topos/wire';
import { handedLines, readingsOf } from '../helpers/mcp.ts';
import type { Read } from '../helpers/mcp.ts';

const line = (scope: string, measure: string, values: readonly string[] | undefined): readonly string[] =>
  values?.length ? [canonical({ at: 'place:mcp', by: 'mcp', form: 'alphabet', measure, role: 'writes', scope, value: values.join('|') })] : [];
const originOf = (url: string): string => (URL.canParse(url) ? new URL(url).origin : url);
const only = (values: readonly string[] | undefined): string => (values?.length === 1 ? values[0]! : '');
const AUTHORITY = ['resource', 'authorization-servers', 'scopes', 'issuer', 'authorize', 'token-url', 'registration', 'challenge'];

type Step = { readonly id: string; readonly at: readonly [string, string]; readonly payload: Readonly<Record<string, string | readonly string[]>>; readonly outputs: Readonly<Record<string, string>>; readonly extra?: Readonly<Record<string, string>> };
const stepLines = (scheme: string, n: number, step: Step): readonly string[] => ((at) => [...line(at, 'id', [step.id]), ...line(at, step.at[0], [step.at[1]]), ...Object.entries(step.extra ?? {}).flatMap(([m, v]) => line(at, m, [v])),
  ...Object.entries(step.payload).flatMap(([name, v]) => (typeof v === 'string' ? line(`${at}/payload/${name}`, 'value', [v]) : line(`${at}/payload/${name}`, 'items', v))),
  ...Object.entries(step.outputs).flatMap(([name, v]) => line(`${at}/outputs/${name}`, 'value', [v]))])(`${scheme}/steps/${n}`);

/**
 * How access to a server is obtained, as a host runs it: a client registered for the visit where the server that
 * authorizes it says where (RFC 7591), named as the host names itself — else the one the place names — the person sent
 * to its page with PKCE and the resource named (RFC 8707), and the code traded for a token that rides the Authorization header.
 */
const flowOf = (scheme: string, f: Readonly<Record<string, readonly string[]>>): readonly string[] => {
  const client = f['registration'] ? '$steps.register.outputs.client' : '$client';
  const resource = only(f['resource']);
  const steps: Step[] = [
    ...(f['registration'] ? [{ id: 'register', at: ['url', only(f['registration'])] as const, extra: { method: 'post', encoding: 'json' }, outputs: { client: '$response.body#/client_id' },
      payload: { client_name: '$host.client-name', redirect_uris: ['$callback'], grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: "'none'" } }] : []),
    { id: 'authorize', at: ['page', only(f['authorize'])], outputs: { code: '$response.body#/code' }, payload: { response_type: 'code', client_id: client, redirect_uri: '$callback', state: '$state', code_challenge: 's256($verifier)', code_challenge_method: 'S256', scope: '$scopes', resource } },
    { id: 'exchange', at: ['url', only(f['token-url'])], extra: { method: 'post', encoding: 'form' }, outputs: { token: '$response.body#/access_token', expires: '$response.body#/expires_in' },
      payload: { grant_type: 'authorization_code', code: '$steps.authorize.outputs.code', redirect_uri: '$callback', client_id: client, code_verifier: '$verifier', resource } },
  ];
  return [...line(scheme, 'attach-in', ['header']), ...line(scheme, 'attach-name', ['Authorization']), ...line(scheme, 'attach-template', ['Bearer {token}']),
    ...line(scheme, 'token', ['$steps.exchange.outputs.token']), ...line(scheme, 'expires', ['$steps.exchange.outputs.expires']), ...line(scheme, 'discovery', f['authorization-servers']),
    ...steps.flatMap((step, i) => stepLines(scheme, i + 1, step))];
};

/**
 * The place region. It answers, as lines a host parses, the place each server compiles to: where it is reached and the
 * documents it was read from, by digest, with those it could not read; how access is proven when it names a server that
 * authorizes it; and every tool it lists, the hint it declares of itself — a declaration, never a proof of what it does —
 * its class by that hint, and the form it is asked in. A field two documents read differently is named split and settled
 * by neither: a server split on how access is proven gets no flow, and its tools, like a tool split on itself, the split class.
 */
export const render = (asked: Asked): readonly string[] => {
  const word = (path: string): string => value(asked, `form/mcp/${path}`) ?? '';
  const read = readingsOf(asked, 'mcp');
  const servers = [...read].filter(([key]) => !key.includes('/'));
  const [scheme, split] = [word('access/name'), word('split')];
  const unsettled = (r: Read | undefined) => AUTHORITY.some((field) => r?.split.has(field));
  return [...new Set([
    ...servers.flatMap(([s, r]) => [...line(`region/${s}`, 'origins', (r.fields['resource'] ?? []).map(originOf)), ...line(`region/${s}`, 'documents', r.fields['documents']),
      ...line(`region/${s}`, 'unread', [...(r.fields['unparsed'] ?? []), ...(r.fields['unrecognised'] ?? [])]), ...line(`region/${s}`, 'split', [...r.split].sort()),
      ...(r.fields['authorize'] === undefined || unsettled(r) ? [] : flowOf(`keys/access/${s}/${scheme}`, r.fields))]),
    ...[...read].filter(([key]) => key.includes('/')).flatMap(([key, r]) => ((server) => [
      ...line(`offers/${key}`, 'class', r.split.size || unsettled(server) ? [split] : (r.fields['hint'] ?? []).map((hint) => word(`hint/${hint}`))), ...line(`offers/${key}`, 'declares', r.fields['hint']),
      ...line(`offers/${key}`, 'access', [unsettled(server) ? split : server?.fields['authorize'] ? scheme : word('unstated')]), ...line(`offers/${key}`, 'split', [...r.split].sort()),
      ...line(`offers/${key}`, 'scopes', unsettled(server) ? [] : server?.fields['scopes']), ...line(`offers/${key}/form`, 'params', r.fields['params']), ...line(`offers/${key}/form`, 'required', r.fields['required']),
    ])(read.get(key.split('/')[0]!))),
    ...handedLines(asked).filter((one) => ['read', 'write'].includes(steps(one['scope'] ?? '')[0] ?? '')).map((one) => canonical({ ...one })),
  ])].sort();
};

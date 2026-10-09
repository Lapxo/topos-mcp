import { of } from '@lapxo/topos/capsule';
import type { Asked, Handed } from '@lapxo/topos/capsule';
import { alphabet, byBytes, steps } from '@lapxo/topos/wire';

export type Doc = Readonly<Record<string, unknown>>;
export type Row = { readonly scope: string; readonly measure: string; readonly role: 'reads'; readonly bound: { readonly kind: 'enumerated'; readonly values: readonly string[] } };

export const record = (v: unknown): Doc => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Doc : {});
export const list = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
export const text = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
export const said = (scope: string, measure: string, values: readonly (string | undefined)[]): readonly Row[] =>
  ((held) => (held.length ? [{ scope, measure, role: 'reads', bound: { kind: 'enumerated', values: held } }] : []))([...new Set(values.filter((one): one is string => one !== undefined && one !== ''))].sort());

export const documentOf = (textOf: string): Doc | undefined => { try { return ((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Doc : undefined))(JSON.parse(textOf)); } catch { return undefined; } };

export const filesOf = (rest: readonly unknown[]): readonly { readonly place: string; readonly text: string }[] => (rest.find(Array.isArray) as readonly { readonly place: string; readonly text: string }[] | undefined) ?? [];
export const placeOf = (rest: readonly unknown[]): string => filesOf(rest)[0]?.place ?? '';

/** The source a document is read as: its file's name up to its first dot, in the letters a scope step holds. */
export const sourceOf = (place: string): string => (place.split('/').at(-1) ?? '').split('.')[0]!.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'server';

export const stepOf = (name: string): string => name.trim().replace(/\s+/g, '-').replace(/[/|:]/g, '-') || '-';

/** Every line a region is handed: the place's own, and what each region it reads was read to hold. */
export const handedLines = (asked: Asked): readonly Handed[] => [...asked.lines, ...Object.values(asked.regions ?? {}).flatMap((region) => region.receipts)];

export interface Read { readonly fields: Readonly<Record<string, readonly string[]>>; readonly split: ReadonlySet<string> }

/**
 * What the readings under a family say of each key, field by field. Two readings of a field are one when they hold the
 * same members, however often and in whatever order they come; several members in one reading are several values. A
 * field read two different ways is split: every member is kept and the field is named, never settled by either reading.
 */
export const readingsOf = (asked: Asked, family: string): ReadonlyMap<string, Read> => {
  const seen = new Map<string, Map<string, Map<string, readonly string[]>>>();
  for (const line of handedLines(asked)) {
    const [first, field, ...key] = steps(of(line, 'scope'));
    if (first !== family || field === undefined || !key.length) continue;
    const members = [...new Set(alphabet(of(line, 'value')).members)].sort(byBytes);
    const at = seen.get(key.join('/')) ?? seen.set(key.join('/'), new Map()).get(key.join('/'))!;
    (at.get(field) ?? at.set(field, new Map()).get(field)!).set(members.join('\n'), members);
  }
  return new Map([...seen].map(([key, fields]) => [key, {
    fields: Object.fromEntries([...fields].map(([field, reads]) => [field, [...new Set([...reads.values()].flat())].sort(byBytes)])),
    split: new Set([...fields].filter(([, reads]) => reads.size > 1).map(([field]) => field)),
  }]));
};

import { readers, receiptShell, shell } from '@lapxo/topos/capsule';
import type { Asked } from '@lapxo/topos/capsule';
import { alphabet } from '@lapxo/topos/wire';
import * as place from './regions/place.ts';
import * as server from './regions/server.ts';

type Fields = Readonly<Record<string, string>>;
/** The world's own lines, as the host hands them through the provider channel; a host that hands none gets no answer. */
const provided = (asked: Asked | undefined): readonly Fields[] => {
  const lines = (asked as { provider?: { lines?: readonly Fields[] } } | undefined)?.provider?.lines;
  if (lines === undefined) throw Error('REFUSE·world its host handed none of its own lines: select it by its standing');
  return lines;
};
const readsOf = (lines: readonly Fields[], region: string): readonly string[] => lines.filter((f) => f['scope'] === `region/${region}` && f['measure'] === 'reads').flatMap((f) => alphabet(f['value'] ?? '').members);
const own = (lines: readonly Fields[]): readonly Fields[] => lines.filter((f) => /^(form|read|write)\//.test(f['scope'] ?? ''));
const with_ = <T>(region: (asked: Asked) => T, lines: readonly Fields[]) => (asked: Asked) => region({ ...asked, lines: [...asked.lines, ...own(lines)] });

/** Every region is asked as the world's own lines declare it, read off what the host handed — never off a file of its own. */
export const render = (asked: Asked) => ((lines) => shell({ place: { reads: readsOf(lines, 'place'), region: with_(place.render, lines) } })(asked))(provided(asked));
export const receipt = (asked: Asked) => receiptShell({})(asked);
export const observe = (bytes: Uint8Array, at: string, region: string, files: readonly { readonly place: string; readonly text: string }[] = [], asked?: Asked) =>
  ((lines) => readers({ server: { reads: readsOf(lines, 'server'), observe: server.observe } }).observe(bytes, at, region, files))(provided(asked));

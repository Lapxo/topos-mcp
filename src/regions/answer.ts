import { of, value } from '@lapxo/topos/capsule';
import type { Asked } from '@lapxo/topos/capsule';
import { canonical } from '@lapxo/topos/wire';
import { handedLines, readingsOf } from '../helpers/mcp.ts';
/** A protocol-owned response view, distinct from other worlds' response models. Catalogue membership never grants a call. */
export const render = (asked: Asked): readonly string[] => {
  const tools = readingsOf(asked, 'mcp'), rows = handedLines(asked).filter(row => of(row, 'scope').startsWith('mcp-result/'));
  const budget = value(asked, 'read/items')?.split('..')[1], most = budget === undefined ? undefined : Number(budget);
  const line = (scope: string, measure: string, content: string) => canonical({ at: 'place:mcp-answer', by: 'mcp', form: 'alphabet', measure, role: 'reads', scope, value: content });
  const requests = [...new Set(rows.map(row => of(row, 'scope').split('/')[1]!))].sort();
  return requests.flatMap(request => {
    const prefix = `mcp-result/${request}`, at = `answer/${request}`, held = rows.filter(row => of(row, 'scope') === prefix || of(row, 'scope').startsWith(prefix + '/'));
    const seen = new Map<string, Set<string>>(); for (const row of held) { const key = of(row, 'scope') + '\0' + of(row, 'measure'); if (!seen.has(key)) seen.set(key, new Set()); seen.get(key)!.add(of(row, 'value')); }
    const get = (scope: string, measure: string) => held.find(row => of(row, 'scope') === scope && of(row, 'measure') === measure)?.['value'] ?? '';
    const offer = get(prefix, 'offer'), tool = tools.get(offer), shape = get(prefix, 'shape');
    const refused = [...seen.values()].some(values => values.size !== 1) ? 'split' : !tool || tool.split.size ? 'undeclared-offer' : !Number.isSafeInteger(most) || most! < 0 ? 'budget-unavailable' : shape !== 'mcp-call-tool-result@1' ? shape || 'unreadable' : undefined;
    if (refused) return [line(at, 'offer', offer), line(at, 'shape', refused)];
    const omitted = new Set(held.filter(row => { const index = /\/content\/(\d+)$/.exec(of(row, 'scope')); return index !== null && Number(index[1]) >= most! && of(row, 'measure') === 'shape'; }).map(row => of(row, 'scope'))).size;
    return [...new Set(held.filter(row => {
      const scope = of(row, 'scope'), measure = of(row, 'measure');
      if (scope === prefix) return ['offer', 'digest', 'shape', 'is-error', 'withheld-blocks'].includes(measure);
      if (scope === prefix + '/content') return measure === 'members';
      const index = /^content\/(\d+)$/.exec(scope.slice(prefix.length + 1));
      return index !== null && Number(index[1]) < most! && ['text', 'shape'].includes(measure);
    }).map(row => line(at + of(row, 'scope').slice(prefix.length), of(row, 'measure'), of(row, 'measure') === 'withheld-blocks' ? String(Number(of(row, 'value')) + omitted) : of(row, 'value'))))].sort();
  });
};

import { createHash } from 'node:crypto';
import { documentOf, filesOf, list, placeOf, record, said } from '../helpers/mcp.ts';
import type { Row } from '../helpers/mcp.ts';
export interface ResponseLimits { readonly bytes: number; readonly items: number }
/** Read only the MCP result envelope. Structured content and non-text payloads remain opaque; no schema or permission is inferred. */
const one = (bytes: Uint8Array, limits: ResponseLimits, place: string): readonly Row[] => {
  if (!Number.isSafeInteger(limits.bytes) || limits.bytes < 1 || !Number.isSafeInteger(limits.items) || limits.items < 0) throw Error('REFUSE·mcp-response/budget');
  const parts = place.split('/'), source = parts.at(-3) ?? '', operation = decodeURIComponent(parts.at(-2) ?? ''), request = (parts.at(-1) ?? '').replace(/\.json$/, '');
  if (!source || !operation || !/^[A-Za-z0-9_-]+$/.test(request)) throw Error('REFUSE·mcp-response/coordinate');
  const at = `mcp-result/${request}`, common = [...said(at, 'offer', [`${source}/${operation}`])];
  if (bytes.length > limits.bytes) return [...common, ...said(at, 'shape', ['over-budget'])];
  common.push(...said(at, 'digest', [`sha256:${createHash('sha256').update(bytes).digest('hex')}`]));
  const parsed = documentOf(new TextDecoder().decode(bytes));
  const body = parsed?.['jsonrpc'] === '2.0' ? record(parsed['result']) : parsed;
  if (!body || !Array.isArray(body['content']) || (body['isError'] !== undefined && typeof body['isError'] !== 'boolean')) return [...common, ...said(at, 'shape', ['unreadable'])];
  const content = list(body['content']), selected = content.slice(0, limits.items), text: Row[] = [];
  let hidden = content.length - selected.length + Object.keys(body).filter(key => !['content', 'isError'].includes(key)).length;
  for (const [index, block] of selected.entries()) {
    const value = record(block);
    if (value['type'] !== 'text' || typeof value['text'] !== 'string') { hidden++; continue; }
    text.push(...said(`${at}/content/${index}`, 'shape', [value['text'] === '' ? 'empty-text' : 'text']), ...said(`${at}/content/${index}`, 'text', [value['text']]));
    hidden += Object.keys(value).filter(key => !['type', 'text'].includes(key)).length;
  }
  return [...common, ...said(at, 'shape', ['mcp-call-tool-result@1']), ...said(at, 'is-error', body['isError'] === undefined ? [] : [String(body['isError'])]),
    ...said(`${at}/content`, 'members', [String(content.length)]), ...said(at, 'withheld-blocks', [String(hidden)]), ...text];
};

/** Every handed response is read under its own coordinate; a batch never aliases the first file or silently omits bytes. */
export const observe = (bytes: Uint8Array, limits: ResponseLimits, ...rest: readonly unknown[]): readonly Row[] => {
  const files = filesOf(rest);
  if (!files.length) return one(bytes, limits, placeOf(rest));
  let consumed = 0;
  for (const file of files) { if (file.text.length > limits.bytes || (consumed += Buffer.byteLength(file.text)) > limits.bytes) throw Error('REFUSE·mcp-response/budget'); }
  return files.flatMap(file => one(new TextEncoder().encode(file.text), limits, file.place));
};

import { test } from 'node:test';
import { deepStrictEqual, ok, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@lapxo/topos/wire';
import { toposStanding, readStanding, providerInputs, providerFields } from '@lapxo/topos/standing';
import { render } from '../src/index.ts';
const fields = (s: string) => s.split('\n').flatMap(s => { const p=parse(s); return p.kind==='fact'?[p.value.fields]:[]; });
const provider = { lines: fields(readFileSync(new URL('../TARGET.bound',import.meta.url),'utf8')) };
const alias = 'mcp-place';
test('dedicated compiler preserves legacy output and declarations', () => {
 const rows=provider.lines, read=(name:string)=>rows.find(l=>l.scope===`region/${name}`&&l.measure==='reads')!.value!.split('|');
 deepStrictEqual(read(alias),read('place'));
 const top=readStanding(toposStanding(readFileSync(new URL('../TARGET.bound',import.meta.url),'utf8').trim().split('\n'))!);
 const input=providerInputs(top,'sha256:'+'1'.repeat(64),'form/mcp/capsule','sha256:'+'2'.repeat(64),alias,()=> 'sha256:'+'3'.repeat(64));
 ok(input); const projected=providerFields(input!);

 deepStrictEqual(rows.filter(l=>l.scope===`region/${alias}`).map(({scope,...l})=>l),rows.filter(l=>l.scope==='region/place').map(({scope,...l})=>l));
 const source = 'neutral-source';
 const lines = [{scope:'mcp/documents/'+source,measure:'documents',value:'connected/neutral-source.json'}, {scope:'mcp/resource/'+source,measure:'resource',value:'https://fixture.example'}];
 const asked:any={region:'place',at:1,name:'',shape:'',reads:read('place'),regions:{},lines,provider};
 const legacy=render({...asked,provider:projected}), dedicated=render({...asked,region:alias,reads:read(alias),provider:projected});
 ok(legacy.some(l=>l.includes('scope=region/neutral-source')));
 deepStrictEqual(dedicated,legacy);
 throws(()=>render({...asked,region:alias,reads:[]}),/handed less/);
 throws(()=>render({...asked,region:alias,provider:undefined}),/handed none/);
});

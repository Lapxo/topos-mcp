import { observe as capsuleObserve, render as capsuleRender } from '../src/index.ts';
import { test } from 'node:test';
import { equal, ok, throws, deepStrictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observe } from '../src/regions/response.ts';
import { render } from '../src/regions/answer.ts';
import { parse } from '@lapxo/topos/wire';
import type { Asked } from '@lapxo/topos/capsule';
const vectors = JSON.parse(readFileSync(new URL('../vectors/response-fields.json', import.meta.url), 'utf8'));
const limits = { bytes: 1048576, items: 50 };
const facts = (lines: readonly string[]) => lines.map(parse).flatMap(p => p.kind === 'fact' ? [p.value.fields] : []);
const rows = (body: unknown, place: string) => observe(Buffer.from(JSON.stringify(body)), limits, [{ place, text: JSON.stringify(body) }]).map(r => ({ scope:r.scope,measure:r.measure,role:r.role,value:r.bound.values.join('|') }));
const asked = (lines: readonly Record<string,string>[], source: string, operation: string, most: string | undefined = '0..50', declared = true) => ({ region:'mcp-answer',at:1,shape:'',name:'',reads:[],regions:{},lines:[...(most===undefined?[]:[{scope:'read/items',value:most}]),...(declared?[{scope:`mcp/hint/${source}/${operation}`,value:'unhinted'}]:[]),...lines] } as unknown as Asked);
for(const coordinate of vectors.places)for(const vector of vectors.cases)test(`${coordinate}: ${vector.id}`,()=>{
  const[source,operation]=coordinate.split('/'),read=rows(vector.body,coordinate),out=facts(render(asked(read,source,operation)));
  const text=out.filter(f=>f.measure==='text').map(f=>f.value);
  if(vector.text===null)equal(text.length,0);else deepStrictEqual(text,[vector.text]);
  if(vector.withheld!==undefined)ok(out.some(f=>f.measure==='withheld-blocks'&&f.value===String(vector.withheld)));
  if(vector.error)ok(out.some(f=>f.measure==='is-error'&&f.value===vector.error));
  if(vector.shape)ok(out.some(f=>f.measure==='shape'&&f.value===vector.shape));
  ok(!JSON.stringify(out).includes('opaque'));ok(!out.some(f=>f.scope?.startsWith('keys/')||f.role==='demands'));
});
test('unknown offers, conflicting responses and missing budget never disclose text',()=>{
  const read=rows({content:[{type:'text',text:'must-not-leak'}]},'laboratory/measure/request-a.json');
  for(const context of [asked(read,'laboratory','measure','0..50',false),asked([...read,{scope:'mcp-result/request-a/content/0',measure:'text',value:'different'}],'laboratory','measure'),{...asked(read,'laboratory','measure'),lines:asked(read,'laboratory','measure').lines.filter(row=>row['scope']!=='read/items')}])ok(!facts(render(context)).some(f=>f.measure==='text'));
  const split=asked(read,'laboratory','measure');ok(!facts(render({...split,lines:[...split.lines,{scope:'mcp/hint/laboratory/measure',value:'read-only'}]})).some(f=>f.measure==='text'));
});
test('byte and item budgets stay declared; narrowing counts omitted text',()=>{
  const body={content:[{type:'text',text:'first'},{type:'text',text:'second'}]},read=rows(body,'laboratory/measure/request-a.json');
  const out=facts(render(asked(read,'laboratory','measure','0..1')));deepStrictEqual(out.filter(f=>f.measure==='text').map(f=>f.value),['first']);ok(out.some(f=>f.measure==='withheld-blocks'&&f.value==='1'));
  const bytes=Buffer.from(JSON.stringify(body));throws(()=>observe(bytes,{bytes:1,items:50},[{place:'laboratory/measure/request-a.json',text:bytes.toString()}]),/budget/);
  throws(()=>observe(bytes,{bytes:0,items:50},[{place:'laboratory/measure/request-a.json',text:bytes.toString()}]),/budget/);
});
test('batch identities and JSON-RPC envelopes are not aliased to the first request',()=>{
  const files=vectors.places.map((place:string,i:number)=>({place,text:JSON.stringify({jsonrpc:'2.0',id:i,result:{content:[{type:'text',text:'value-'+i}]}})}));
  const read=observe(Buffer.from(''),limits,files).map(r=>({scope:r.scope,measure:r.measure,value:r.bound.values.join('|')}));
  const out=facts(render({...asked(read,'laboratory','measure'),lines:[...asked(read,'laboratory','measure').lines,{scope:'mcp/hint/registry/lookup',value:'unhinted'}]}));
  deepStrictEqual(out.filter(f=>f.measure==='text').map(f=>f.value).sort(),['value-0','value-1']);
});

test('capsule entrypoints select the dedicated view and provider budgets without another protocol model',()=>{
 const fields=readFileSync(new URL('../TARGET.bound',import.meta.url),'utf8').split('\n').map(parse).flatMap(p=>p.kind==='fact'?[p.value.fields]:[]);
 const file={place:'laboratory/measure/request-a.json',text:JSON.stringify({content:[{type:'text',text:'capsule-value'}]})};
 const provider={lines:fields} as unknown as Asked['provider'];
 const response=capsuleObserve(Buffer.from(file.text),file.place,'mcp-response',[file],{...asked([],'laboratory','measure'),provider});
 const read=response.map(r=>({scope:r.scope!,measure:r.measure!,value:r.bound.kind==='enumerated'?r.bound.values.join('|'):''}));
 const reads=(fields.find(f=>f.scope==='region/mcp-answer'&&f.measure==='reads')?.value??'').split('|');
 throws(()=>capsuleRender({...asked(read,'laboratory','measure'),provider}),/handed less/);
 const output=capsuleRender({...asked(read,'laboratory','measure'),reads,provider});
 ok(facts(output).some(f=>f.measure==='text'&&f.value==='capsule-value'));
});

test('compiled tools name only the producer-owned response view; document fields cannot install a model', async()=>{
 const { observe:catalogue }=await import('../src/regions/server.ts'),{render:place}=await import('../src/regions/place.ts');
 const document={tools:[{name:'measure',inputSchema:{type:'object'},annotations:{readOnlyHint:true},'answer-view':'keys/owner'}],form:{mcp:{response:{view:'keys/owner'}}}};
 const body=JSON.stringify(document),observed=catalogue(Buffer.from(body),[{place:'connected/laboratory.json',text:body}]).map(r=>({scope:r.scope,measure:r.measure,value:r.bound.values.join('|')}));
 const provider=[{scope:'form/mcp/response/view',value:'mcp-answer'},{scope:'form/mcp/hint/read-only',value:'read'},{scope:'form/mcp/access/name',value:'authorization'},{scope:'form/mcp/unstated',value:'unstated'}];
 const compiled=facts(place({...asked([],'laboratory','measure'),lines:[...provider,...observed]}));
 ok(compiled.some(f=>f.scope==='offers/laboratory/measure/form'&&f.measure==='answer-view'&&f.value==='mcp-answer'));
 ok(compiled.some(f=>f.scope==='offers/laboratory/measure'&&f.measure==='class'&&f.value==='read'));
 ok(!compiled.some(f=>f.scope?.startsWith('view/')||f.scope?.startsWith('keys/')||f.value==='keys/owner'));
});

test('no handed response is not a zero, a held result or a successful empty invocation',async()=>{
 const {run}=await import('../src/index.ts');
 const provider={lines:[]} as unknown as Asked['provider'];
 deepStrictEqual(run('responses/','unused',[{scope:'mcp-result/old',value:'old result'}],'mcp-response',{...asked([],'laboratory','measure'),provider}),[]);
 throws(()=>run('connected/','unused',[],'server',{...asked([],'laboratory','measure'),provider}),/no-file/);
 throws(()=>run('responses/','unused',[],'mcp-response',asked([],'laboratory','measure')),/handed none/);
});

test('native contract hands catalogue and result through their explicitly declared regions',async()=>{
 const {answer}=await import('@lapxo/topos/contract');
 const {canonical}=await import('@lapxo/topos/wire');
 const providerLines=readFileSync(new URL('../TARGET.bound',import.meta.url),'utf8').split('\n').filter(Boolean);
 const fields=providerLines.map(parse).flatMap(p=>p.kind==='fact'?[p.value.fields]:[]);
 const reads=(fields.find(f=>f.scope==='region/mcp-answer'&&f.measure==='reads')?.value??'').split('|');
 const raw=rows({content:[{type:'text',text:'through-native-regions'}]},'laboratory/measure/request-a.json');
 const encode=(f:Record<string,string>)=>canonical({at:'place:fixture',by:'target',form:'alphabet',role:'reads',...f});
 const request:any={verb:'render',rootScope:'.',region:'mcp-answer',at:1,files:[],reads,lines:[encode({scope:'read/items',value:'0..50'})],regions:{server:{lines:[],receipts:[encode({scope:'mcp/hint/laboratory/measure',value:'unhinted'})]},'mcp-response':{lines:[],receipts:raw.map(encode)}},provider:{standing:'sha256:'+'1'.repeat(64),artifact:'sha256:'+'2'.repeat(64),digest:'sha256:'+'3'.repeat(64),lines:providerLines}};
 const response=answer({render:capsuleRender},request,'fixture');
 ok(response.kind==='fact'&&'lines'in response&&facts(response.lines!).some(f=>f.measure==='text'&&f.value==='through-native-regions'));
 const short=answer({render:capsuleRender},{...request,reads:reads.filter(p=>!p.startsWith('region/'))},'fixture');
 ok(short.kind==='refuse');
});

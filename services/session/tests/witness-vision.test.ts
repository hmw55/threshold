import { describe,it,expect,vi,afterEach } from 'vitest';
import { assessWitnessImage } from '../src/architect/witnessVision.js';
import { createAiProvider } from '../src/architect/createAiProvider.js';
import type { AiProvider } from '../src/architect/aiProvider.js';
const provider=(text:string):AiProvider=>({name:'gemini',generate:async()=>({text:'',provider:'gemini',model:'test'}),analyzeImage:async()=>({text,provider:'gemini',model:'test'})});
afterEach(()=>vi.unstubAllEnvs());
describe('grounded witness vision',()=>{
  it('retains a real upload as unverified when the provider fails',async()=>{
    const p=provider('');p.analyzeImage=async()=>{throw Error('provider unavailable');};
    expect(await assessWitnessImage(Buffer.from('actual upload'),'book',p)).toMatchObject({assessment:'unverified'});
  });
  it('accepts only structured matches and rejects an unsupported image',async()=>{
    expect(await assessWitnessImage(Buffer.from('upload'),'book',provider('{"match":true,"detail":"A red cover is visible."}'))).toEqual({assessment:'verified',detail:'A red cover is visible.'});
    expect((await assessWitnessImage(Buffer.from('upload'),'book',provider('{"match":false,"detail":"No book is visible."}'))).assessment).toBe('rejected');
    expect((await assessWitnessImage(Buffer.from('upload'),'book',provider('A dragon moved your book.'))).assessment).toBe('unverified');
  });
  it('retains only verified, schema-constrained visible details for physical puzzles',async()=>{
    const valid=await assessWitnessImage(Buffer.from('upload'),'book',provider('{"match":true,"detail":"Visible label","features":{"color":"RED","shape":"RECTANGULAR","marking":"ACTUAL LABEL"}}'));
    expect(valid.features).toEqual({color:'RED',shape:'RECTANGULAR',marking:'ACTUAL LABEL'});
    const unsupported=await assessWitnessImage(Buffer.from('upload'),'book',provider('{"match":false,"detail":"Unclear","features":{"color":"RED","marking":"invented"}}'));
    expect(unsupported.features).toBeUndefined();
  });
  it('uses Gemini as primary when its key is configured and retains explicit Ollama development selection',()=>{
    vi.stubEnv('GEMINI_API_KEY','test-placeholder');vi.stubEnv('THRESHOLD_AI_PROVIDER',undefined);
    expect(createAiProvider().name).toBe('gemini');expect(createAiProvider({provider:'ollama'}).name).toBe('ollama');
  });
});

import { describe, expect, it } from "vitest";
// The same validation module is imported by the browser feedback form.
import { feedbackDocument, validScreenshot, TOTAL_IMAGE_BUDGET } from "../public/feedback-data.js";
const ticket="OASA-261027-ABCDEF123456", image="data:image/jpeg;base64,aGVsbG8=";
const draft={comment:" The bus is missing. ",images:[image],name:" Reader ",email:"reader@example.com",url:"https://www.stouras.com/athens-transit-map/submit-feedback.html"};
describe("private feedback payload",()=>{
 it("tags submissions for OASA and uses the existing create-only inbox schema",()=>{const payload=feedbackDocument(draft,ticket,123);expect(payload).toMatchObject({text:"[OASA Live]\nThe bus is missing.",page:"oasa-live-feedback",ticket,images:[image],name:"Reader",forwarded:false,status:"new",createdAt:123,uid:null,ua:""});expect(Object.keys(payload).sort()).toEqual(['text','images','name','email','uid','ticket','page','url','ua','forwarded','status','createdAt'].sort());});
 it("rejects empty or oversized comments",()=>{expect(()=>feedbackDocument({...draft,comment:" "},ticket,0)).toThrow('comment');expect(()=>feedbackDocument({...draft,comment:'x'.repeat(18001)},ticket,0)).toThrow('comment');});
 it("accepts only generated JPEG attachments within the shared document budget",()=>{expect(()=>feedbackDocument({...draft,images:['data:image/svg+xml,<svg/>']},ticket,0)).toThrow('images');expect(()=>feedbackDocument({...draft,images:Array(4).fill(image)},ticket,0)).toThrow('images');expect(()=>feedbackDocument({...draft,images:['data:image/jpeg;base64,'+'A'.repeat(TOTAL_IMAGE_BUDGET)]},ticket,0)).toThrow('images');});
 it("caps contact details and rejects invalid ticket identifiers",()=>{expect(feedbackDocument({...draft,name:'n'.repeat(300),email:'e'.repeat(300)},ticket,0).name).toHaveLength(200);expect(()=>feedbackDocument(draft,'bad/id',0)).toThrow('ticket');});
 it("limits files before decoding",()=>{expect(validScreenshot({type:'image/png',size:1024})).toBe(true);expect(validScreenshot({type:'image/svg+xml',size:1024})).toBe(false);expect(validScreenshot({type:'image/png',size:11*1024*1024})).toBe(false);});
});

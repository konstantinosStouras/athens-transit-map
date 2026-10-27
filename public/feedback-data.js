export const MAX_IMAGES=3;
export const MAX_IMAGE_BYTES=10*1024*1024;
export const TOTAL_IMAGE_BUDGET=700*1024;
export function validScreenshot(file){return ['image/png','image/jpeg','image/webp'].includes(file.type)&&file.size>0&&file.size<=MAX_IMAGE_BYTES;}
export function feedbackDocument(input,ticket,createdAt){
 const comment=String(input.comment??'').trim();
 if(!comment||comment.length>18000)throw new Error('comment');
 const images=input.images??[];
 if(!Array.isArray(images)||images.length>MAX_IMAGES||images.some(image=>typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image))||images.reduce((n,image)=>n+image.length,0)>TOTAL_IMAGE_BUDGET)throw new Error('images');
 if(!/^OASA-\d{6}-[A-F0-9]{12}$/.test(ticket))throw new Error('ticket');
 return {text:'[OASA Live]\n'+comment,images:[...images],name:String(input.name??'').trim().slice(0,200),email:String(input.email??'').trim().slice(0,200),uid:null,ticket,page:'oasa-live-feedback',url:String(input.url??'').slice(0,2000),ua:'',forwarded:false,status:'new',createdAt};
}

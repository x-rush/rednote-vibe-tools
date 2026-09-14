export async function saveCardToAlbum(bridge,data){
 if(!bridge||typeof bridge.saveImageToPhotosAlbum!=='function')throw new Error('unavailable');
 if(!/^data:image\/png;base64,/.test(data))throw new Error('invalid image');
 let filePath=data;
 if(typeof bridge.writeTempFile==='function'){const temp=await bridge.writeTempFile({data});if(temp?.errMsg&&/fail|cancel/i.test(temp.errMsg))throw new Error(temp.errMsg);if(!temp?.filePath)throw new Error('missing temporary file');filePath=temp.filePath;}
 const result=await bridge.saveImageToPhotosAlbum({filePath});if(result?.errMsg&&/fail|cancel/i.test(result.errMsg))throw new Error(result.errMsg);
}


export function CanvasToImage(canvas){
    return new Promise<CanvasImageSource>(function(resolve, reject){
        const image = new Image();

        image.onload = function(){
            resolve(this as CanvasImageSource)
        };

        image.src = canvas.toDataURL();
    });
}

export function CanvasToImage(canvas){
    return new Promise(function(resolve, reject){
        const image = new Image();

        image.onload = function(){
            resolve(this)
        };

        image.src = canvas.toDataURL();
    });
}
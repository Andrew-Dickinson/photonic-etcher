import {SVGToImage} from "./svg_to_png";

const pcbStackup = window.pcbStackup;
const renderConverter = window.gerberToSvg.render;

export default async function renderStackup(layers, options){
    const stackup = await pcbStackup(layers, options);
    let id_num = 14214;

    let individualLayerSVGs = stackup.layers
        .map((layer, i) => {return {...layer, "id": layers[i].fileId}})
        .filter((layer) => JSON.stringify(layer.converter.viewBox) !== "[0,0,0,0]")
        .map((layer) => {
            layer.converter.viewBox = stackup.top.viewBox;
            layer.converter.width = stackup.top.width;
            layer.converter.height = stackup.top.height;
            id_num += 1;
            const layerSVG = renderConverter(layer.converter, id_num.toString().padStart(12, '0'));
            return {
                "id": layer.id,
                "side": layer.side,
                "type": layer.type,
                "filename": layer.filename,
                "svg": layerSVG
        }
    });

    let combinedIMGs = {
        "top_svg": stackup.top.svg,
        "bottom_svg": stackup.bottom.svg,
        "top_png_blob_url": await SVGToImage({svg: stackup.top.svg, width: 1024}),
        "bottom_png_blob_url": await SVGToImage({svg: stackup.bottom.svg, width: 1024})
    };

    return [combinedIMGs, individualLayerSVGs];
}

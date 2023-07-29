import renderToPhoton from "./render-to-photon";
import renderStackup, { StackupLayer } from "./stackup-renderer"
import {downloadFiles} from "./download_files"
import { PrinterModel } from "../ui/export_dialog";

// async function renderStackup(rendered_layers, options){
//
// }

/*
*/
export interface PhotonFile{
    layerId: number,
    layer: {type: string, side: string},
    layerPNGURL: string,
    fileName: string,
    slicedFile: Blob
}

export interface ExportOptions{
    printerSettings: PrinterModel&{printerModel: string},
    exposureTimes: number[],
    anchorOffset: [number,number],
    anchorCorner: string,
    flipBools: boolean[]
}
export async function renderPhoton(layersToExport:(StackupLayer&{displayOrder: number, inverted: boolean})[], export_options: ExportOptions){
    return renderToPhoton(layersToExport, export_options)
}


export {renderStackup, downloadFiles}
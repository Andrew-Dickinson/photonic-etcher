import renderToPhoton from "./render-to-photon";
import renderStackup, { StackupLayer } from "./stackup-renderer"
import { downloadFiles } from "./download_files"
import { PrinterModel } from "../ui/export_dialog";
import { buildLegacyPhotonFile } from "./render-to-legacy-photon";
import { buildPhotonFile } from "./build-photon-file";

export interface PhotonFile {
    layerId: number,
    layer: { type: string, side: string },
    layerPNGURL: string,
    fileName: string,
    slicedFile: Blob
}

export interface ExportOptions {
    printerSettings: PrinterModel & { printerModel: string },
    exposureTimes: number[],
    anchorOffset: [number, number],
    anchorCorner: string,
    flipBools: boolean[]
}
export async function renderPhoton(layersToExport: (StackupLayer & { displayOrder: number, inverted: boolean })[], export_options: ExportOptions) {
    if (export_options.printerSettings.fileFormat === "photon") {
        return renderToPhoton(layersToExport, export_options, buildLegacyPhotonFile);
    }
    return renderToPhoton(layersToExport, export_options, buildPhotonFile)
}


export { renderStackup, downloadFiles }
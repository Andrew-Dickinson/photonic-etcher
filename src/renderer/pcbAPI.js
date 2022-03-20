import renderToPhoton from "./render-to-photon";
import renderStackup from "./stackup-renderer"
import downloadFiles from "./download_files"

// async function renderStackup(rendered_layers, options){
//
// }

async function renderPhoton(layersToExport, export_options){
    return renderToPhoton(layersToExport, export_options)
}


export {renderStackup, renderPhoton, downloadFiles}
const { dialog } = require('electron');
const path = require('path');
const fs = require("fs");
const fsPromises = fs.promises;

async function downloadFiles(files){
    // {
    //     'layerId': layer.id,
    //     'layer': layer,
    //     'layerPNG': b64_png,
    //     'fileName': outputFileName,
    //     'slicedFile': photonFileBlob
    // }


    const output = await dialog.showSaveDialog(null,{
        filters: [{
            name: 'Photon Mono Slices',
            extensions: ['pwms']
        }]
    });

    if (output.canceled){
        return false;
    }

    const directory = path.dirname(output.filePath);
    const baseFileName = path.basename(output.filePath, '.pwms');

    for (const file of files){
        const fullPath = path.join(directory, baseFileName + "-" + file.fileName);
        try {
            await fsPromises.writeFile(fullPath, file.slicedFile /* THIS IS NOW A BLOB OBJECT INSTEAD OF B64 DATA */, 'base64');
        } catch (err) {
            await dialog.showErrorBox("Error saving file", err)
            return false;
        }
    }

    return directory;
}

module.exports = downloadFiles;
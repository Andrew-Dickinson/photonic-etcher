import JSZip from "jszip";
import { saveAs } from 'file-saver';

export async function downloadFiles(files, rootFileName){
    if (!rootFileName){
        rootFileName = "PCB"
    }

    let zip = new JSZip();
    for (const file of files){
        zip.file(file.fileName, file.slicedFile)
    }

    const blob = await zip.generateAsync({type:"blob"});
    saveAs(blob, rootFileName + "_photon.zip");
}

export async function downloadFile(file){
    saveAs(file.slicedFile, file.fileName);
}

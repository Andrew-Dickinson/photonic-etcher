const RLE4_MAX_RUN = 0xfff;

function scanForRun(imageDataArray, start){
    let run_len = 1;
    for (; run_len < RLE4_MAX_RUN; run_len++) {
        if (start + run_len >= imageDataArray.length) {
            // Ran out of array
            return run_len;
        }

        if ((imageDataArray[start + run_len] === 255) !== (imageDataArray[start] === 255)) {
            // Different color pixel
            return run_len;
        }
    }

    // If we didn't run off the end of the data or find a different color pixel, use the maximum possible run length
    return RLE4_MAX_RUN;
}

function encodeRLE4(greyScaleImageData) {
    const output = [];

    for (let i = 0; i < greyScaleImageData.length; ){
        const run_len = scanForRun(greyScaleImageData, i);

        // This combined with the logic in scanForRun treats any non-255 pixels as black, essentially removing
        // any anti-aliasing because it's complex to encode & we don't need it for PCBs
        const color = greyScaleImageData[i] === 255 ? 0xf : 0x0;

        output.push((color << 4) | (run_len >> 8));
        output.push(run_len & 0xff);

        i += run_len
    }

    return new Uint8Array(output);
}

function writePhotonHeaders(output, pixelSizemm, exposureTime, resolution, previewPixels) {
    // File Header
    output.setUint32(0x00, 1129926209, true);     //"ANYCUBIC"
    output.setUint32(0x04, 1128874581, true);     //"ANYCUBIC" (cont.)
    output.setUint32(0x30, 1145128264, true);    //"HEADER"
    output.setUint32(0x34, 21061, true);         //"HEADER" (cont.)
    output.setUint32(0x90, 1447383632, true);   //"PREVIEW"
    output.setUint32(0x94, 5719369, true);      //"PREVIEW" (cont.)
    output.setUint32(0x90 + 28 + previewPixels * 2, 1163477324, true); //"LAYERDEF"
    output.setUint32(0x90 + 28 + previewPixels * 2 + 4, 1178944594, true); //"LAYERDEF" (cont.)

    // ANYCUBIC section
    output.setUint32(12, 1, true); // version Number
    output.setUint32(16, 4, true); // Area Number (?)
    output.setUint32(20, 0x30, true); // HEADER address
    output.setUint32(28, 0x90, true); // PREVIEW address
    output.setUint32(36, 0x90 + 28 + previewPixels * 2, true); // LAYERDEF address
    output.setUint32(44, 0x90 + 28 + previewPixels * 2 + 20 + (32 * 1), true); // Layer Data address

    //HEADER section
    output.setUint32(48 + 12, 80, true);
    output.setFloat32(48 + 16, pixelSizemm * 1000, true);
    output.setFloat32(48 + 20, 0.010, true); // layer height
    output.setFloat32(48 + 24, 0.0, true); // global exposure default
    output.setFloat32(48 + 28, 0.0, true); // global light-off default
    output.setFloat32(48 + 32, exposureTime, true); // bottom layer exposure time
    output.setFloat32(48 + 36, 1, true); // bottom layer count
    output.setFloat32(48 + 40, 0.0, true); // lift height
    output.setFloat32(48 + 44, 4.0, true); // lift speed
    output.setFloat32(48 + 48, 4.0, true); // retract speed
    output.setFloat32(48 + 52, 0.0, true); //volume
    output.setUint32(48 + 56, 0.0, true); // anti-alias count??
    output.setUint32(48 + 60, resolution[0], true); // x res
    output.setUint32(48 + 64, resolution[1], true); // y res
    output.setFloat32(48 + 68, 1.04, true); //weight
    output.setFloat32(48 + 72, 1.04, true); //price
    output.setUint32(48 + 76, 32, true); //resin Type
    output.setUint32(48 + 80, 0, true); //use Individual Parameters? (1/0)

}


export async function buildPhotonFile(layerData, previewData, exposureTime, printerSettings){
    const greyScaleImageData = new Uint8Array(layerData.length / 4);
    console.assert(layerData.length / 4 === printerSettings.resolution[0] * printerSettings.resolution[1]);
    for (let i = 0; i < layerData.length / 4; ++i){
        greyScaleImageData[i] = layerData[i*4];
    }
    const layerDataBlob = encodeRLE4(greyScaleImageData);

    const previewPixels = printerSettings.previewResolution[0] * printerSettings.previewResolution[1];

    const LAYERDEF_ADDR = 0x90 + 28 + previewPixels * 2;
    const LAYERDATA_ADDR = LAYERDEF_ADDR + 20 + (32 * 1);

    const outputBuffer = new ArrayBuffer(LAYERDATA_ADDR + layerDataBlob.length);
    const output = new DataView(outputBuffer);
    writePhotonHeaders(output, printerSettings.xyRes, exposureTime, printerSettings.resolution, previewPixels);

    //PREVIEW section
    output.setUint32(144 + 12, 12 + previewPixels * 2, true); // preview data length
    output.setUint32(144 + 16, printerSettings.previewResolution[0], true); // preview x res
    output.setUint32(144 + 20, 42, true); // '*' character
    output.setUint32(144 + 24, printerSettings.previewResolution[1], true); // preview y res

    console.assert(previewData.length / 4 === previewPixels);
    for (let i = 0; i < previewData.length / 4; ++i){
        output.setUint16(144 + 28 + (i * 2), previewData[i*4] * 256, true);
    }

    output.setUint32(LAYERDEF_ADDR + 12, 4 + (32 * 1), true); // bytes in LAYERDEF
    output.setUint32(LAYERDEF_ADDR + 12 + 4, 1, true); // number of layers

    // Set single layer of metadata
    output.setUint32(LAYERDEF_ADDR + 12 + 8, LAYERDATA_ADDR, true); // Layer0 data start
    output.setUint32(LAYERDEF_ADDR + 12 + 12, layerDataBlob.length, true); // Layer0 data length
    output.setFloat32(LAYERDEF_ADDR + 12 + 16, 0.0, true) // Layer0 lift height
    output.setFloat32(LAYERDEF_ADDR + 12 + 20, 4.0, true) // Layer0 lift speed
    output.setFloat32(LAYERDEF_ADDR + 12 + 24, exposureTime, true) // Layer0 exposure time
    output.setUint32(LAYERDEF_ADDR + 12 + 28, 1008981770, true) // unknown value

    for (let i = 0; i < layerDataBlob.length; ++i){
        output.setUint8(LAYERDATA_ADDR + i, layerDataBlob[i]);
    }

    return new Blob([outputBuffer]);
}
const RLE_MAX_RUN = 0x7f;
const RLE4_MAX_RUN = 0xfff;

function scanForRun(imageDataArray, start, maxRun){
    let run_len = 1;
    for (; run_len < maxRun; run_len++) {
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
    return maxRun;
}

function encodeRLE4(greyScaleImageData) {
    const output: number[] = [];

    for (let i = 0; i < greyScaleImageData.length; ){
        const run_len = scanForRun(greyScaleImageData, i, RLE4_MAX_RUN);

        // This combined with the logic in scanForRun treats any non-255 pixels as black, essentially removing
        // any anti-aliasing because it's complex to encode & we don't need it for PCBs
        const color = greyScaleImageData[i] === 255 ? 0xf : 0x0;

        output.push((color << 4) | (run_len >> 8));
        output.push(run_len & 0xff);

        i += run_len
    }

    return new Uint8Array(output);
}

function encodeRLE(greyScaleImageData) {
    const output: number[] = [];

    for (let i = 0; i < greyScaleImageData.length; ){
        const run_len = scanForRun(greyScaleImageData, i, RLE_MAX_RUN);

        // This combined with the logic in scanForRun treats any non-255 pixels as black, essentially removing
        // any anti-aliasing because it's complex to encode & we don't need it for PCBs
        const color = greyScaleImageData[i] === 255 ? 0x1 : 0x0;

        output.push((color << 7) | run_len);
        i += run_len
    }

    return new Uint8Array(output);
}

function writePhotonHeaders(output, headerAddr, previewAddr, layerdefAddr, layerdataAddr, fileVersion, pixelSizemm, exposureTime, resolution) {
    // File Header
    output.setUint32(0x00, 1129926209, true); //"ANYCUBIC"
    output.setUint32(0x04, 1128874581, true); //"ANYCUBIC" (cont.)

    // ANYCUBIC section
    output.setUint32(12, fileVersion[0], true); // version Number
    output.setUint32(16, fileVersion[1], true); // Area Number (?)
    output.setUint32(20, headerAddr, true); // HEADER address
    // We leave the 4 bytes after the header addr set to 0. This field is not well documented (might be "padding"), but
    // seems to have a different value for file versions 515 and 516. Not sure what this means
    output.setUint32(28, previewAddr, true); // PREVIEW address

    const previewEndAddr = fileVersion[0] === 1 ? layerdefAddr : (layerdefAddr - 0x1C);
    output.setUint32(32, previewEndAddr, true); // PREVIEW end address

    output.setUint32(36, layerdefAddr, true); // LAYERDEF address

    let layerdefEndAddr = 0;
    if (fileVersion[0] === 515) {
        layerdefEndAddr = layerdataAddr;
    } else if (fileVersion[0] === 516) {
        layerdefEndAddr = layerdataAddr - 228; // 228 is the size of EXTRA and MACHINE combined
    }
    output.setUint32(40, layerdefEndAddr, true); // LAYERDEF end address

    if (fileVersion[0] === 516) {
        output.setUint32(44, layerdataAddr - 156, true); // MACHINE address. 156 is the size of MACHINE
        output.setUint32(48, layerdataAddr, true); // Layer Data address
    } else {
        output.setUint32(44, layerdataAddr, true); // Layer Data address
    }

    //HEADER section
    output.setUint32(headerAddr, 1145128264, true); //"HEADER"
    output.setUint32(headerAddr + 4, 21061, true); //"HEADER" (cont.)
    output.setUint32(headerAddr + 8, 0, true); //"HEADER" (cont.)
    output.setUint32(headerAddr + 12, fileVersion[0] === 516 ? 84 : 80, true);
    output.setFloat32(headerAddr + 16, pixelSizemm * 1000, true);
    output.setFloat32(headerAddr + 20, 0.050, true); // layer height
    output.setFloat32(headerAddr + 24, 0.0, true); // global exposure default
    output.setFloat32(headerAddr + 28, 0.0, true); // global light-off default
    output.setFloat32(headerAddr + 32, exposureTime, true); // bottom layer exposure time
    output.setFloat32(headerAddr + 36, 1, true); // bottom layer count
    output.setFloat32(headerAddr + 40, 0.0, true); // lift height
    output.setFloat32(headerAddr + 44, 4.0, true); // lift speed
    output.setFloat32(headerAddr + 48, 4.0, true); // retract speed
    output.setFloat32(headerAddr + 52, 0.0, true); //volume
    output.setUint32(headerAddr + 56, 1, true); // anti-alias count??
    output.setUint32(headerAddr + 60, resolution[0], true); // x res
    output.setUint32(headerAddr + 64, resolution[1], true); // y res
    output.setFloat32(headerAddr + 68, 1.04, true); //weight
    output.setFloat32(headerAddr + 72, 1.04, true); //price
    output.setUint32(headerAddr + 76, fileVersion[0] === 1 ? 32 : 36, true); //resin Type
    output.setUint32(headerAddr + 80, 0, true); //use Individual Parameters? (1/0)


    output.setUint32(headerAddr + 84, fileVersion[0] === 1 ? 0 : (fileVersion[0] === 516 ? 2060 : 2138), true); // unknown
    output.setUint32(headerAddr + 88, 0, true); // transition layer count
    output.setUint32(headerAddr + 92, 0, true); // padding bytes

    // Disable Two-stage-motion-control (TSMC)
    if (fileVersion[0] === 516) output.setUint32(headerAddr + 96, 0, true);
}


export async function buildPhotonFile(layerData, previewData, exposureTime, printerSettings, preview2Data = null){
    const greyScaleImageData = new Uint8Array(layerData.length / 4);
    console.assert(layerData.length / 4 === printerSettings.resolution[0] * printerSettings.resolution[1]);
    for (let i = 0; i < layerData.length / 4; ++i){
        greyScaleImageData[i] = layerData[i*4];
    }

    let layerDataBlob: Uint8Array|null = null;
    if (printerSettings.encoding === "RLE4") {
        layerDataBlob = encodeRLE4(greyScaleImageData);
    } else if (printerSettings.encoding === "RLE") {
        layerDataBlob = encodeRLE(greyScaleImageData)
    } else {
        throw Error("Unknown image encoding: " + printerSettings.encoding);
    }

    if (printerSettings.fileVersion[0] === 518) {
        // Version 518 has a completely different layout
        const photonBlob = await buildPhotonFile518(layerDataBlob, previewData, preview2Data, exposureTime, printerSettings);
        return photonBlob;
    }

    const previewPixels = printerSettings.previewResolution[0] * printerSettings.previewResolution[1];
    const preview_size = previewPixels * 2 + (printerSettings.fileVersion[0] === 1 ? 12 : 28);

    const HEADER_ADDR = printerSettings.fileVersion[0] === 516 ? 0x34 : 0x30;
    const PREVIEW_ADDR = printerSettings.fileVersion[0] === 516 ? 0x98 : 0x90;

    const LAYERDEF_ADDR = PREVIEW_ADDR + preview_size + (printerSettings.fileVersion[0] === 1 ? 16 : 28);
    const extra_and_machine_data_size = printerSettings.fileVersion[0] === 516 ? 228 : 0;
    const LAYERDATA_ADDR = LAYERDEF_ADDR + 20 + (32 * 1) + extra_and_machine_data_size;

    const outputBuffer = new ArrayBuffer(LAYERDATA_ADDR + layerDataBlob.length);
    const output = new DataView(outputBuffer);
    // ANYCUBIC and HEADER sections
    writePhotonHeaders(
        output,
        HEADER_ADDR,
        PREVIEW_ADDR,
        LAYERDEF_ADDR,
        LAYERDATA_ADDR,
        printerSettings.fileVersion,
        Math.max(printerSettings.xRes, printerSettings.yRes),
        exposureTime,
        printerSettings.resolution,
    );

    //PREVIEW section
    output.setUint32(PREVIEW_ADDR, 1447383632, true); //"PREVIEW"
    output.setUint32(PREVIEW_ADDR + 4, 5719369, true); //"PREVIEW" (cont.)
    output.setUint32(PREVIEW_ADDR + 8, 0, true); //"PREVIEW" (cont.)
    output.setUint32(PREVIEW_ADDR + 12, preview_size, true); // preview data length
    output.setUint32(PREVIEW_ADDR + 16, printerSettings.previewResolution[0], true); // preview x res
    output.setUint32(PREVIEW_ADDR + 20, printerSettings.fileVersion[0] === 1 ? 42 : 120, true); // '*' or 'x' character
    output.setUint32(PREVIEW_ADDR + 24, printerSettings.previewResolution[1], true); // preview y res

    // Write preview image
    console.assert(previewData.length / 4 === previewPixels);
    for (let i = 0; i < previewData.length / 4; ++i){
        let rgb_565_encoded_pixel = 0;
        rgb_565_encoded_pixel = rgb_565_encoded_pixel | ((previewData[i*4 + 1] >> 2) << 5)   // Green

        // For some reason, enabling the two other color channels causes horrible distortions.
        // So thumbnails are green :)
        // rgb_565_encoded_pixel = rgb_565_encoded_pixel | ((previewData[i*4 + 2] >> 3) << 11)  // Blue
        // rgb_565_encoded_pixel = rgb_565_encoded_pixel | (previewData[i*4] >> 3)      // Red
        output.setUint16(PREVIEW_ADDR + 28 + (i * 2), rgb_565_encoded_pixel, true);
    }

    // Write post-preview static bytes (if applicable)
    if (printerSettings.fileVersion[0] !== 1){
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2), 0, true);
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2) + 4, 16, true);
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2) + 8, 0xFFFFFFFF, true);
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2) + 12, 0xFFFFFFFF, true);
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2) + 16, 0xFFFFFFFF, true);
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2) + 20, 0xFFFFFFFF, true);
        output.setUint32(PREVIEW_ADDR + 28 + (previewPixels * 2) + 24, 0, true);
    }

    //LAYERDEF section
    output.setUint32(LAYERDEF_ADDR, 1163477324, true); //"LAYERDEF"
    output.setUint32(LAYERDEF_ADDR + 4, 1178944594, true); //"LAYERDEF" (cont.)
    output.setUint32(LAYERDEF_ADDR + 8, 0, true); //"LAYERDEF" (cont.)
    output.setUint32(LAYERDEF_ADDR + 12, 4 + (32 * 1), true); // bytes in LAYERDEF
    output.setUint32(LAYERDEF_ADDR + 16, 1, true); // number of layers

    // Set single layer of metadata
    output.setUint32(LAYERDEF_ADDR + 20, LAYERDATA_ADDR, true); // Layer0 data start
    output.setUint32(LAYERDEF_ADDR + 20 + 4, layerDataBlob.length, true); // Layer0 data length
    output.setFloat32(LAYERDEF_ADDR + 20 + 8, 0.0, true) // Layer0 lift height
    output.setFloat32(LAYERDEF_ADDR + 20 + 12, 4.0, true) // Layer0 lift speed
    output.setFloat32(LAYERDEF_ADDR + 20 + 16, exposureTime, true) // Layer0 exposure time
    output.setFloat32(LAYERDEF_ADDR + 20 + 20, 0.050, true) // Layer0 layer height
    output.setUint32(LAYERDEF_ADDR + 20 + 24, 0, true) // Padding?
    output.setUint32(LAYERDEF_ADDR + 20 + 28, 0, true) // Padding?


    if (printerSettings.fileVersion[0] === 516){
        // EXTRA Layer
        const EXTRA_ADDR = LAYERDEF_ADDR + 20 + 32;
        output.setUint32(EXTRA_ADDR, 1381259333, true); //"EXTRA"
        output.setUint32(EXTRA_ADDR + 4, 65, true); //"EXTRA" (cont.)
        output.setUint32(EXTRA_ADDR + 8, 0, true); //"LAYERDEF" (cont.)
        output.setUint32(EXTRA_ADDR + 12, 24, true); // unknown
        output.setUint32(EXTRA_ADDR + 16, 2, true);  // unknown
        output.setFloat32(EXTRA_ADDR + 20, 0.0, true) // Bottom lift height 1
        output.setFloat32(EXTRA_ADDR + 24, 4.0, true) // Bottom lift speed 1
        output.setFloat32(EXTRA_ADDR + 28, 4.0, true) // Bottom retract speed 1
        output.setFloat32(EXTRA_ADDR + 32, 0.0, true) // Bottom lift height 2
        output.setFloat32(EXTRA_ADDR + 36, 4.0, true) // Bottom lift speed 2
        output.setFloat32(EXTRA_ADDR + 40, 4.0, true) // Bottom retract speed 2
        output.setUint32(EXTRA_ADDR + 44, 2, true);  // unknown
        output.setFloat32(EXTRA_ADDR + 48, 0.0, true) // lift height 1
        output.setFloat32(EXTRA_ADDR + 52, 4.0, true) // lift speed 1
        output.setFloat32(EXTRA_ADDR + 56, 4.0, true) // retract speed 1
        output.setFloat32(EXTRA_ADDR + 60, 0.0, true) // lift height 2
        output.setFloat32(EXTRA_ADDR + 64, 4.0, true) // lift speed 2
        output.setFloat32(EXTRA_ADDR + 68, 4.0, true) // retract speed 2

        // MACHINE Layer
        const MACHINE_ADDR = EXTRA_ADDR + 72;
        output.setUint32(MACHINE_ADDR, 1212367181, true); //"MACHINE"
        output.setUint32(MACHINE_ADDR + 4, 4542025, true); //"MACHINE" (cont.)
        output.setUint32(MACHINE_ADDR + 8, 0, true); //"MACHINE" (cont.)
        output.setUint32(MACHINE_ADDR + 12, 156, true); // unknown

        const enc = new TextEncoder();
        const printer_name = enc.encode(printerSettings.printerModel);
        for (let i = 0; i < Math.min(printer_name.length, 96); ++i){
            output.setUint8(MACHINE_ADDR + 16 + i, printer_name[i]);
        }

        const file_format = enc.encode("pw0Img");
        for (let i = 0; i < file_format.length; ++i){
            output.setUint8(MACHINE_ADDR + 112 + i, file_format[i]);
        }

        output.setFloat32(MACHINE_ADDR + 136, printerSettings.physicalDimensions[0], true); // display width (mm)
        output.setFloat32(MACHINE_ADDR + 136 + 4, printerSettings.physicalDimensions[1], true); // display height (mm)
        output.setFloat32(MACHINE_ADDR + 136 + 8, printerSettings.physicalDimensions[2], true); // machine z (mm)
        output.setUint32(MACHINE_ADDR + 136 + 12, printerSettings.fileVersion[0], true); // file version (again)
        output.setUint32(MACHINE_ADDR + 136 + 16, 6506241, true); // unknown
    }

    for (let i = 0; i < layerDataBlob.length; ++i){
        output.setUint8(LAYERDATA_ADDR + i, layerDataBlob[i]);
    }

    return new Blob([outputBuffer]);
}

async function buildPhotonFile518(layerDataBlob: Uint8Array, previewData, preview2Data, exposureTime: number, printerSettings) {
    const FILEMARK_SIZE = 64;  // 16 uint32 fields (magic[3] + version + numTables + 11 addresses)

    // Section data sizes (not including 16-byte table headers)
    const HEADER_DATA_SIZE = 96;
    const SOFTWARE_DATA_SIZE = 164;

    const previewPixels = printerSettings.previewResolution[0] * printerSettings.previewResolution[1];
    const PREVIEW_DATA_SIZE = previewPixels * 2 + 28; // RGB565 + 28 bytes header within data

    const LAYER_IMG_COLOR_TABLE_DATA_SIZE = 28; // UseFullGreyscale(4) + GreyMaxCount(4) + Grey(16) + Unknown(4)
    const LAYERDEF_DATA_SIZE = 4 + (32 * 1); // 4 bytes layer count + 32 bytes per layer
    const EXTRA_DATA_SIZE = 56; // 14 fields: 2 uint32 counts + 12 float motion params
    const MACHINE_DATA_SIZE = 224;
    const MODEL_DATA_SIZE = 52; // MinX/Y/Z, MaxX/Y/Z, SupportsEnabled, SupportsDensity + padding (13 fields)
    const SUBIMGS_DATA_SIZE = 8 + 44 + 16; // header(LayerCount+Index=8) + 1 SubLayerDef entry(44) + padding(16)

    const preview2Pixels = printerSettings.preview2Resolution[0] * printerSettings.preview2Resolution[1];
    const PREVIEW2_DATA_SIZE = preview2Pixels * 2 + 28; // RGB565 + 28 bytes header

    // Calculate addresses — match Photon Workshop section order:
    // HEADER → PREVIEW → LayerImgColor → LAYERDEF → EXTRA → MACHINE → LayerData → MODEL → SUBIMGS → SOFTWARE → PREVIEW2
    const headerAddr = FILEMARK_SIZE;
    const previewAddr = headerAddr + 16 + HEADER_DATA_SIZE;
    const layerImgColorTableAddr = previewAddr + 16 + PREVIEW_DATA_SIZE;
    const layerDefAddr = layerImgColorTableAddr + LAYER_IMG_COLOR_TABLE_DATA_SIZE; // no 16-byte table header
    const extraAddr = layerDefAddr + 16 + LAYERDEF_DATA_SIZE;
    const machineAddr = extraAddr + 16 + EXTRA_DATA_SIZE;
    const layerDataAddr = machineAddr + 16 + MACHINE_DATA_SIZE;
    const modelAddr = layerDataAddr + layerDataBlob.length;
    const subImgsAddr = modelAddr + 16 + MODEL_DATA_SIZE;
    const softwareAddr = subImgsAddr + 16 + SUBIMGS_DATA_SIZE;
    const preview2Addr = softwareAddr + SOFTWARE_DATA_SIZE; // SOFTWARE has no 16-byte table header

    const totalSize = preview2Addr + 16 + PREVIEW2_DATA_SIZE;
    const outputBuffer = new ArrayBuffer(totalSize);
    const output = new DataView(outputBuffer);

    // --- FILEMARK (60 bytes) ---
    // "ANYCUBIC\0\0\0\0" (12 bytes)
    output.setUint32(0x00, 1129926209, true); // "ANYC"
    output.setUint32(0x04, 1128874581, true); // "UBIC"
    output.setUint32(0x08, 0, true);          // null padding
    output.setUint32(0x0C, 518, true);        // Version
    output.setUint32(0x10, 11, true);         // NumberOfTables
    output.setUint32(0x14, headerAddr, true);
    output.setUint32(0x18, softwareAddr, true);
    output.setUint32(0x1C, previewAddr, true);
    output.setUint32(0x20, layerImgColorTableAddr, true);
    output.setUint32(0x24, layerDefAddr, true);
    output.setUint32(0x28, extraAddr, true);
    output.setUint32(0x2C, machineAddr, true);
    output.setUint32(0x30, layerDataAddr, true);
    output.setUint32(0x34, modelAddr, true);
    output.setUint32(0x38, subImgsAddr, true);
    output.setUint32(0x3C, preview2Addr, true);

    const enc = new TextEncoder();

    // --- HEADER section ---
    output.setUint32(headerAddr, 1145128264, true); // "HEAD"
    output.setUint32(headerAddr + 4, 21061, true);  // "ER\0\0"
    output.setUint32(headerAddr + 8, 0, true);
    output.setUint32(headerAddr + 12, HEADER_DATA_SIZE, true);

    const pixelSizeUm = printerSettings.xRes * 1000; // Use X pixel size (matches Photon Workshop)
    const hd = headerAddr + 16; // header data start
    output.setFloat32(hd + 0, pixelSizeUm, true);  // PixelSizeUm
    output.setFloat32(hd + 4, 0.050, true);            // LayerHeight
    output.setFloat32(hd + 8, 0.0, true);              // ExposureTime (global default)
    output.setFloat32(hd + 12, 0.0, true);             // WaitTimeBeforeCure
    output.setFloat32(hd + 16, exposureTime, true);    // BottomExposureTime
    output.setFloat32(hd + 20, 1, true);               // BottomLayerCount
    output.setFloat32(hd + 24, 0.0, true);             // LiftHeight
    output.setFloat32(hd + 28, 4.0, true);             // LiftSpeed
    output.setFloat32(hd + 32, 4.0, true);             // RetractSpeed
    output.setFloat32(hd + 36, 0.0, true);             // VolumeMl
    output.setUint32(hd + 40, 1, true);                // AntiAliasCount
    output.setUint32(hd + 44, printerSettings.resolution[0], true); // ResX
    output.setUint32(hd + 48, printerSettings.resolution[1], true); // ResY
    output.setFloat32(hd + 52, 1.04, true);            // Weight
    output.setFloat32(hd + 56, 1.04, true);            // Price
    output.setUint32(hd + 60, 36, true);               // ResinType
    output.setUint32(hd + 64, 0, true);                // PerLayerSettings = OFF (CRITICAL!)
    output.setUint32(hd + 68, 2060, true);             // Unknown field
    output.setUint32(hd + 72, 0, true);                // TransitionLayerCount
    output.setUint32(hd + 76, 0, true);                // Padding
    output.setUint32(hd + 80, 0, true);                // TSMC disabled
    output.setUint32(hd + 84, 0, true);                // Padding
    output.setUint32(hd + 88, 0, true);                // Padding
    output.setUint32(hd + 92, 0, true);                // IntelligentMode = false

    // --- SOFTWARE section (no 16-byte table header — UVtools reads struct directly) ---
    // Struct: SoftwareName(32) + TableLength(4) + Version(32) + OS(32) + OpenGL(64) = 164 bytes
    const softwareName = enc.encode("photonic-etcher");
    for (let i = 0; i < Math.min(softwareName.length, 32); i++) {
        output.setUint8(softwareAddr + i, softwareName[i]);
    }
    output.setUint32(softwareAddr + 32, SOFTWARE_DATA_SIZE, true); // TableLength = 164
    const versionStr = enc.encode("1.0.0");
    for (let i = 0; i < Math.min(versionStr.length, 32); i++) {
        output.setUint8(softwareAddr + 36 + i, versionStr[i]);
    }
    // OS (32 bytes at +68) and OpenGL (64 bytes at +100) left as zeros

    // --- PREVIEW section ---
    output.setUint32(previewAddr, 1447383632, true);     // "PREV"
    output.setUint32(previewAddr + 4, 5719369, true);    // "IEW\0"
    output.setUint32(previewAddr + 8, 0, true);
    output.setUint32(previewAddr + 12, PREVIEW_DATA_SIZE, true);
    const previewPixelBytes = previewPixels * 2;
    output.setUint32(previewAddr + 16, printerSettings.previewResolution[0], true); // Width
    output.setUint32(previewAddr + 20, 120, true); // Mark byte 'x'
    output.setUint32(previewAddr + 24, printerSettings.previewResolution[1], true); // Height
    output.setUint32(previewAddr + 28, previewPixelBytes, true); // DataLength
    output.setUint32(previewAddr + 32, 0, true); // Padding
    output.setUint32(previewAddr + 36, 0, true); // Padding
    output.setUint32(previewAddr + 40, 0, true); // Padding

    // Write preview RGB565 pixels (offset 44 = 16 table header + 28 data header)
    for (let i = 0; i < previewData.length / 4; i++) {
        let rgb565 = 0;
        rgb565 = rgb565 | ((previewData[i*4 + 1] >> 2) << 5); // Green only (matching existing code)
        output.setUint16(previewAddr + 44 + (i * 2), rgb565, true);
    }

    // --- LayerImageColorTable section (no table header — struct directly like SOFTWARE) ---
    // UseFullGreyscale(4) + GreyMaxCount(4) + Grey(16 bytes all 0xFF) + Unknown(4)
    output.setUint32(layerImgColorTableAddr + 0, 0, true);   // UseFullGreyscale = 0
    output.setUint32(layerImgColorTableAddr + 4, 16, true);  // GreyMaxCount = 16
    for (let i = 0; i < 16; i++) {
        output.setUint8(layerImgColorTableAddr + 8 + i, 0xFF); // Grey table (all 0xFF)
    }
    output.setUint32(layerImgColorTableAddr + 24, 0, true);  // Unknown = 0

    // --- LAYERDEF section ---
    output.setUint32(layerDefAddr, 1163477324, true);     // "LAYE"
    output.setUint32(layerDefAddr + 4, 1178944594, true); // "RDEF"
    output.setUint32(layerDefAddr + 8, 0, true);
    output.setUint32(layerDefAddr + 12, LAYERDEF_DATA_SIZE, true);
    output.setUint32(layerDefAddr + 16, 1, true); // layer count = 1

    // Layer 0 metadata (32 bytes)
    const ld = layerDefAddr + 20;
    output.setUint32(ld + 0, layerDataAddr, true);        // data address
    output.setUint32(ld + 4, layerDataBlob.length, true); // data length
    output.setFloat32(ld + 8, 0.0, true);                 // lift height
    output.setFloat32(ld + 12, 4.0, true);                // lift speed
    output.setFloat32(ld + 16, exposureTime, true);       // exposure time
    output.setFloat32(ld + 20, 0.050, true);              // layer height
    output.setUint32(ld + 24, 0, true);                   // padding
    output.setUint32(ld + 28, 0, true);                   // padding

    // --- EXTRA section ---
    output.setUint32(extraAddr, 1381259333, true);  // "EXTR"
    output.setUint32(extraAddr + 4, 65, true);      // "A\0\0\0"
    output.setUint32(extraAddr + 8, 0, true);
    output.setUint32(extraAddr + 12, EXTRA_DATA_SIZE, true);
    // EXTRA data: 56 bytes (14 fields)
    const ed = extraAddr + 16;
    output.setUint32(ed + 0, 2, true);        // BottomLiftCount
    output.setFloat32(ed + 4, 0.0, true);     // BottomLiftHeight1
    output.setFloat32(ed + 8, 4.0, true);     // BottomLiftSpeed1
    output.setFloat32(ed + 12, 4.0, true);    // BottomRetractSpeed1
    output.setFloat32(ed + 16, 0.0, true);    // BottomLiftHeight2
    output.setFloat32(ed + 20, 4.0, true);    // BottomLiftSpeed2
    output.setFloat32(ed + 24, 4.0, true);    // BottomRetractSpeed2
    output.setUint32(ed + 28, 2, true);       // NormalLiftCount
    output.setFloat32(ed + 32, 0.0, true);    // LiftHeight1
    output.setFloat32(ed + 36, 4.0, true);    // LiftSpeed1
    output.setFloat32(ed + 40, 4.0, true);    // RetractSpeed1
    output.setFloat32(ed + 44, 0.0, true);    // LiftHeight2
    output.setFloat32(ed + 48, 4.0, true);    // LiftSpeed2
    output.setFloat32(ed + 52, 4.0, true);    // RetractSpeed2

    // --- MACHINE section (224 bytes data) ---
    output.setUint32(machineAddr, 1212367181, true);  // "MACH"
    output.setUint32(machineAddr + 4, 4542025, true); // "INE\0"
    output.setUint32(machineAddr + 8, 0, true);
    output.setUint32(machineAddr + 12, MACHINE_DATA_SIZE, true);

    const md = machineAddr + 16;
    // MachineName: 96 bytes at offset 0
    // Extract machine name: "AnyCubic Photon Mono M5s (.pm5s)" -> "Anycubic Photon Mono M5s"
    const rawName = printerSettings.printerModel || "Anycubic Photon Mono M5s";
    const cleanName = rawName.replace(/\s*\(\..*\)\s*$/, '').replace(/^AnyCubic/, 'Anycubic');
    const printerName = enc.encode(cleanName);
    for (let i = 0; i < Math.min(printerName.length, 96); i++) {
        output.setUint8(md + i, printerName[i]);
    }
    // LayerImageFormat: 16 bytes at offset 96
    const fileFormat = enc.encode("pw0Img");
    for (let i = 0; i < fileFormat.length; i++) {
        output.setUint8(md + 96 + i, fileFormat[i]);
    }
    // Fields at offset 112+
    output.setUint32(md + 112, 1, true);       // MaxAntialiasingLevel
    output.setUint32(md + 116, 15, true);      // PropertyFields (v518=15)
    output.setFloat32(md + 120, printerSettings.physicalDimensions[0], true); // DisplayWidth mm
    output.setFloat32(md + 124, printerSettings.physicalDimensions[1], true); // DisplayHeight mm
    output.setFloat32(md + 128, printerSettings.physicalDimensions[2], true); // MachineZ mm
    output.setUint32(md + 132, 518, true);     // MaxFileVersion
    output.setUint32(md + 136, 0, true);       // MachineBackground
    output.setFloat32(md + 140, printerSettings.xRes * 1000, true);  // PixelWidthUm (19.0)
    output.setFloat32(md + 144, printerSettings.yRes * 1000, true);  // PixelHeightUm (24.0)
    // Padding: offsets 148-179 (8 float fields, all zeros from ArrayBuffer init)
    output.setUint32(md + 180, 1, true);       // DisplayCount
    output.setUint32(md + 184, 0, true);       // Padding9
    output.setUint16(md + 188, printerSettings.resolution[0], true); // ResolutionX (uint16!)
    output.setUint16(md + 190, printerSettings.resolution[1], true); // ResolutionY (uint16!)
    // Remaining to 224 bytes is zero padding (already zero)

    // --- MODEL section (28 bytes data) ---
    const modelTag = enc.encode("MODEL\0\0\0\0\0\0\0");
    for (let i = 0; i < Math.min(modelTag.length, 12); i++) {
        output.setUint8(modelAddr + i, modelTag[i]);
    }
    output.setUint32(modelAddr + 12, MODEL_DATA_SIZE, true);
    // All zeros: MinX/Y/Z=0, MaxX/Y/Z=0, SupportsEnabled=0

    // --- SUBIMGS section (60 bytes data: 16 header + 44 SubLayerDef entry) ---
    const subimgsTag = enc.encode("SUBIMGS\0\0\0\0\0");
    for (let i = 0; i < Math.min(subimgsTag.length, 12); i++) {
        output.setUint8(subImgsAddr + i, subimgsTag[i]);
    }
    output.setUint32(subImgsAddr + 12, SUBIMGS_DATA_SIZE, true);
    output.setUint32(subImgsAddr + 16, 1, true); // LayerCount = 1 (must match LAYERDEF count)
    output.setUint32(subImgsAddr + 20, 1, true); // Index = 1
    // SubLayerDef entry 0 (44 bytes at offset 24, right after LayerCount+Index)
    const sd = subImgsAddr + 24;
    output.setUint32(sd + 0, layerDataAddr, true);         // DataAddress
    output.setUint32(sd + 4, layerDataBlob.length, true);  // DataLength
    output.setUint32(sd + 8, 0, true);                     // NonZeroPixelCount (0 = unknown)
    // Remaining 32 bytes padding (8 floats, all zero from ArrayBuffer init)

    // --- PREVIEW2 section (320x190) ---
    output.setUint32(preview2Addr, 1447383632, true);     // "PREV"
    output.setUint32(preview2Addr + 4, 844580169, true);  // "IEW2"
    output.setUint32(preview2Addr + 8, 0, true);
    output.setUint32(preview2Addr + 12, PREVIEW2_DATA_SIZE, true);
    const preview2PixelBytes = preview2Pixels * 2;
    output.setUint32(preview2Addr + 16, printerSettings.preview2Resolution[0], true); // Width
    output.setUint32(preview2Addr + 20, 120, true); // Mark byte 'x'
    output.setUint32(preview2Addr + 24, printerSettings.preview2Resolution[1], true); // Height
    output.setUint32(preview2Addr + 28, preview2PixelBytes, true); // DataLength
    output.setUint32(preview2Addr + 32, 0, true); // Padding
    output.setUint32(preview2Addr + 36, 0, true); // Padding
    output.setUint32(preview2Addr + 40, 0, true); // Padding
    // Write preview2 RGB565 pixels if data is provided (offset 44 = 16 table header + 28 data header)
    if (preview2Data) {
        for (let i = 0; i < preview2Data.length / 4; i++) {
            let rgb565 = 0;
            rgb565 = rgb565 | ((preview2Data[i*4 + 1] >> 2) << 5); // Green only (matching preview1 encoding)
            output.setUint16(preview2Addr + 44 + (i * 2), rgb565, true);
        }
    }

    // --- Layer image data ---
    for (let i = 0; i < layerDataBlob.length; i++) {
        output.setUint8(layerDataAddr + i, layerDataBlob[i]);
    }

    return new Blob([outputBuffer]);
}
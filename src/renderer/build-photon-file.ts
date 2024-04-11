import { PrinterModel } from "../ui/export_dialog";
import { BuildOutputFileArgs } from "./render-to-photon";

const RLE_MAX_RUN = 0x7f;
const RLE4_MAX_RUN = 0xfff;

function scanForRun(imageDataArray, start, maxRun) {
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

    for (let i = 0; i < greyScaleImageData.length;) {
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

export function encodeRLE(greyScaleImageData, maxRun = RLE_MAX_RUN) {
    const output: number[] = [];

    for (let i = 0; i < greyScaleImageData.length;) {
        const run_len = scanForRun(greyScaleImageData, i, maxRun);

        // This combined with the logic in scanForRun treats any non-255 pixels as black, essentially removing
        // any anti-aliasing because it's complex to encode & we don't need it for PCBs
        const color = greyScaleImageData[i] === 255 ? 0x1 : 0x0;

        output.push((color << 7) | run_len);
        i += run_len
    }

    return new Uint8Array(output);
}

function writePhotonHeaders(output: DataView, headerAddr: number, previewAddr: number, layerdefAddr: number, layerdataAddr: number, fileVersion: number[], pixelSizemm: number, exposureTime: number, resolution: [number, number]) {
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


export async function buildPhotonFile({ layerData, exposureTime, previewData, printerSettings }: BuildOutputFileArgs) {
    const greyScaleImageData = new Uint8Array(layerData.length / 4);
    console.assert(layerData.length / 4 === printerSettings.resolution[0] * printerSettings.resolution[1]);
    for (let i = 0; i < layerData.length / 4; ++i) {
        greyScaleImageData[i] = layerData[i * 4];
    }

    let layerDataBlob: Uint8Array | null = null;
    if (printerSettings.encoding === "RLE4") {
        layerDataBlob = encodeRLE4(greyScaleImageData);
    } else if (printerSettings.encoding === "RLE") {
        layerDataBlob = encodeRLE(greyScaleImageData)
    } else {
        throw Error("Unknown image encoding: " + printerSettings.encoding);
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
        printerSettings.xyRes,
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
    for (let i = 0; i < previewData.length / 4; ++i) {
        let rgb_565_encoded_pixel = 0;
        rgb_565_encoded_pixel = rgb_565_encoded_pixel | ((previewData[i * 4 + 1] >> 2) << 5)   // Green

        // For some reason, enabling the two other color channels causes horrible distortions.
        // So thumbnails are green :)
        // rgb_565_encoded_pixel = rgb_565_encoded_pixel | ((previewData[i*4 + 2] >> 3) << 11)  // Blue
        // rgb_565_encoded_pixel = rgb_565_encoded_pixel | (previewData[i*4] >> 3)      // Red
        output.setUint16(PREVIEW_ADDR + 28 + (i * 2), rgb_565_encoded_pixel, true);
    }

    // Write post-preview static bytes (if applicable)
    if (printerSettings.fileVersion[0] !== 1) {
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


    if (printerSettings.fileVersion[0] === 516) {
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
        for (let i = 0; i < printer_name.length; ++i) {
            output.setUint8(MACHINE_ADDR + 16 + i, printer_name[i]);
        }

        const file_format = enc.encode("pw0Img");
        for (let i = 0; i < file_format.length; ++i) {
            output.setUint8(MACHINE_ADDR + 112 + i, file_format[i]);
        }

        output.setFloat32(MACHINE_ADDR + 136, printerSettings.physicalDimensions[0], true); // display width (mm)
        output.setFloat32(MACHINE_ADDR + 136 + 4, printerSettings.physicalDimensions[1], true); // display height (mm)
        output.setFloat32(MACHINE_ADDR + 136 + 8, printerSettings.physicalDimensions[2], true); // machine z (mm)
        output.setUint32(MACHINE_ADDR + 136 + 12, printerSettings.fileVersion[0], true); // file version (again)
        output.setUint32(MACHINE_ADDR + 136 + 16, 6506241, true); // unknown
    }

    for (let i = 0; i < layerDataBlob.length; ++i) {
        output.setUint8(LAYERDATA_ADDR + i, layerDataBlob[i]);
    }

    return new Blob([outputBuffer]);
}
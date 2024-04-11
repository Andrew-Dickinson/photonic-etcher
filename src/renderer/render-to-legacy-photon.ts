import { encodeRLE } from "./build-photon-file";
import { PrinterModel } from "../ui/export_dialog";
import { BuildOutputFileArgs } from "./render-to-photon";

class OutputWriter {

    private pos: number = 0;
    constructor(private data: DataView) { }

    writeUint8(val: number) {
        this.data.setUint8(this.pos, val);
        this.pos += 1;
    }

    writeUint16(val: number) {
        this.data.setUint16(this.pos, val, true);
        this.pos += 2;
    }

    writeUint32(val: number) {
        this.data.setUint32(this.pos, val, true);
        this.pos += 4;
    }

    writeFloat32(val: number) {
        this.data.setFloat32(this.pos, val, true);
        this.pos += 4;
    }

    writeBlob(blob: Uint8Array) {
        for (let i = 0; i < blob.length; ++i) {
            this.writeUint8(blob[i]);
        }
    }
}

export async function buildLegacyPhotonFile({ layerData, exposureTime, previewData, printerSettings }: BuildOutputFileArgs) {

    const greyScaleImageData = new Uint8Array(layerData.length / 4);
    const previewPixels = printerSettings.previewResolution[0] * printerSettings.previewResolution[1];
    console.assert(previewData.length / 4 === previewPixels);
    for (let i = 0; i < layerData.length / 4; ++i) {
        greyScaleImageData[i] = layerData[i * 4];
    }

    let layerDataBlob: Uint8Array = encodeRLE(greyScaleImageData, 125);

    const preview_size = previewPixels * 2 + 32; // two bytes per pixel plus header, we do not do RLE encoding on the preview image

    const HEADER_ADDR = 0;
    const PREVIEW1_ADDR = 0x70;
    const PREVIEW2_ADDR = PREVIEW1_ADDR + preview_size;
    const LAYERDEF_ADDR = PREVIEW2_ADDR + preview_size;
    const LAYERDATA_ADDR = LAYERDEF_ADDR + 36;

    const outputBuffer = new ArrayBuffer(LAYERDATA_ADDR + layerDataBlob.length);
    const output = new OutputWriter(new DataView(outputBuffer));

    //HEADER section
    // 0x00
    output.writeUint32(0x12fd0019); // Magic
    output.writeUint32(1); // version 
    output.writeFloat32(68.04) // BedSizeX
    output.writeFloat32(120.96) // BedSizeY

    // 0x10
    output.writeFloat32(150) // BedSizeZ
    output.writeUint32(0) // Unknown1
    output.writeUint32(0) // Unknown2
    output.writeFloat32(0.1) // TotalHeightMillimeter

    // 0x20
    output.writeFloat32(0.1) // LayerHeightMillimeter
    output.writeFloat32(exposureTime) // Exposure time setting used at slicing, in seconds, for normal (non-bottom) layers, respectively. Actual time used by the machine is in the layer table.
    output.writeFloat32(exposureTime) // Exposure time setting used at slicing, in seconds, for bottom layers. Actual time used by the machine is in the layer table.
    output.writeFloat32(1) // Light off time setting used at slicing, for normal layers, in seconds. Actual time used by the machine is in the layer table. Note that light_off_time_s appears in both the file header and ExtConfig.

    // 0x30
    output.writeUint32(1) // Number of layers configured as "bottom." Note that this field appears in both the file header and ExtConfig..
    output.writeUint32(1440) // Printer resolution along X axis, in pixels. This information is critical to correctly decoding layer images.
    output.writeUint32(2560) // Printer resolution along Y axis, in pixels. This information is critical to correctly decoding layer images.
    output.writeUint32(PREVIEW1_ADDR) // File offsets of ImageHeader records describing the larger preview images.

    // 0x40
    output.writeUint32(LAYERDEF_ADDR) // file offset of a table of LayerHeader records giving parameters for each printed layer.
    output.writeUint32(1) // LayerCount. Number of records in the layer table. 
    output.writeUint32(PREVIEW2_ADDR) // PreviewSmallOffsetAddress. File offsets of ImageHeader records describing the smaller preview images.
    output.writeUint32(exposureTime + 1) // PrintTime. Estimated duration of print, in seconds.

    // 0x50
    output.writeUint32(1) // Records whether this file was generated assuming normal (0) or mirrored (1) image projection. LCD printers are "mirrored" for this purpose.
    output.writeUint32(0) // PrintParametersOffsetAddress. Print parameters table offset
    output.writeUint32(60) // PrintParametersSize. Gets the print parameters table size in bytes.
    output.writeUint32(1) // AntiAliasLevel. The number of times each layer image is repeated in the file.
    //     /// This is used to implement antialiasing in cbddlp files. When greater than 1,
    //     /// the layer table will actually contain layer_table_count * level_set_count entries.
    //     /// See the section on antialiasing for details.

    // 0x60
    output.writeUint16(0xFF) // LightPWM: PWM duty cycle for the UV illumination source on normal levels, respectively.
    //     /// This appears to be an 8-bit quantity where 0xFF is fully on and 0x00 is fully off.
    output.writeUint16(0xFF) // BottomLightPWM: PWM duty cycle for the UV illumination source on bottom levels, respectively.
    // This appears to be an 8-bit quantity where 0xFF is fully on and 0x00 is fully off.
    output.writeUint32(0) // EncryptionKey. The key used to encrypt layer data, or 0 if encryption is not used.
    output.writeUint32(0) // SlicerOffset. The slicer tablet offset 
    output.writeUint32(0) // SlicerSize. The slicer tablet size in bytes 

    // PREVIEW section
    // 0x70
    writePreview(output, PREVIEW1_ADDR, printerSettings.previewResolution, previewData);
    // E6E0
    writePreview(output, PREVIEW2_ADDR, printerSettings.previewResolution, previewData);

    // 12B72
    // LAYER DEFINITION section
    // if there were multiple layers, this section would be repeated for each layer, followed by all the data
    output.writeFloat32(0.1); // PositionZ. The build platform Z position for this layer, measured in millimeters.
    output.writeFloat32(exposureTime); // ExposureTime. The exposure time for this layer, in seconds.
    output.writeFloat32(1); // LightOffSeconds. How long to keep the light off after exposing this layer, in seconds.
    output.writeUint32(LAYERDATA_ADDR); // DataAddress. The layer image offset to encoded layer data.

    output.writeUint32(layerDataBlob.length); // DataSize. The layer image length in bytes.
    output.writeUint32(0); // PageNumber
    output.writeUint32(36); // TableSize
    output.writeUint32(0); // Unknown3

    output.writeUint32(0); // Unknown4

    // LAYER DATA section
    output.writeBlob(layerDataBlob);

    return new Blob([outputBuffer]);
}

function writePreview(output: OutputWriter, previewAddr: number, resolution: [number, number], previewData: Uint8ClampedArray) {
    // PREVIEW section
    // 0x70
    output.writeUint32(resolution[0]); // ResolutionX. The X dimension of the preview image, in pixels.
    output.writeUint32(resolution[1]); // ResolutionY. The Y dimension of the preview image, in pixels.
    output.writeUint32(previewAddr + 32); // ImageOffset. The image offset of the encoded data blob.
    output.writeUint32(resolution[0] * resolution[1] * 2); // ImageLength. The image length in bytes.

    //0x80
    output.writeUint32(0); // Unknown1
    output.writeUint32(0); // Unknown2
    output.writeUint32(0); // Unknown3
    output.writeUint32(0); // Unknown4

    for (let i = 0; i < previewData.length / 4; ++i) {
        let pixel = 0;

        pixel = pixel | (((previewData[i * 4] >> 3) & 0x1F) << 11)      // Red
        pixel = pixel | (((previewData[i * 4 + 1] >> 3) & 0x1F) << 6)   // Green
        pixel = pixel | ((previewData[i * 4 + 2] >> 3) & 0x1F)  // Blue

        output.writeUint16(pixel);
    }
}
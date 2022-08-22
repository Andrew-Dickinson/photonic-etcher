const {XMLParser} = require('fast-xml-parser');
const {SVG} = require('@svgdotjs/svg.js');

const {buildPhotonFile} = require("./build-photon-file");
const {SVGToImage} = require("./svg_to_png");
const {CanvasToImage} = require("./canvas_to_img");

 export default async function renderToPhoton(layers, options){
    const outputResolution = options.printerSettings.resolution; // px * px
    const xyRes = options.printerSettings.xyRes; // mm

    const longRes = Math.max(outputResolution[0], outputResolution[1]);
    const shortRes = Math.min(outputResolution[0], outputResolution[1]);

    const flipTopLayersHorizontal = options.flipBools[0];
    const flipTopLayersVertical = options.flipBools[1];
    const flipBottomLayersHorizontal = options.flipBools[2];
    const flipBottomLayersVertical = options.flipBools[3];

    // const buildPlateSize = outputResolution.map(i => i * xyRes); // mm * mm

    const xmlOptions = {
        ignoreAttributes: false,
        attributeNamePrefix : "@_"
    };

    const parser = new XMLParser(xmlOptions);

    const output = [];
    const fileNameCounts = {};

    for (const layer of layers) {
        const svgXMLObj = parser.parse(layer.svg);
        const board_width_mm = parseFloat(svgXMLObj.svg['@_width'].replace("mm", ""));
        const board_height_mm = parseFloat(svgXMLObj.svg['@_height'].replace("mm", ""));
        const viewbox = svgXMLObj.svg['@_viewBox'].split(' ');
        const exposureTime = options.exposureTimes[layer.id];
        let outputFileName = ""

        if (!fileNameCounts[layer.filename]) {
            fileNameCounts[layer.filename] = 0
        }

        if (fileNameCounts[layer.filename] === 0){
            outputFileName = layer.filename + "." + options.printerSettings.fileFormat;
        } else {
            const duplicate_num = fileNameCounts[layer.filename] + 2;
            if (layer.filename.includes(".")){
                outputFileName = layer.filename.replace(".", "_" + duplicate_num + ".") + "." + options.printerSettings.fileFormat
            } else {
                outputFileName = layer.filename + "_" + duplicate_num +  "." + options.printerSettings.fileFormat;
            }
        }
        fileNameCounts[layer.filename] += 1;


        ////////////////////////////////// HANDLE FLIP BOOLS //////////////////////////////////////////////////
        const flipHorizontal = layer.side === "top" ? flipTopLayersHorizontal : flipBottomLayersHorizontal;
        const flipVertical = layer.side === "top" ? flipTopLayersVertical : flipBottomLayersVertical;

        const translateX = flipHorizontal ? viewbox[2] : "0";
        const translateY = flipVertical ? viewbox[3] : "0";

        const scaleX = flipHorizontal ? "-1" : "1";
        const scaleY = flipVertical ? "-1" : "1";

        const transformStr = "translate(" + translateX + ", " + translateY + ") " +
                             "scale(" + scaleX + ", " + scaleY + ")";

        const originalSVG = SVG(layer.svg);
        originalSVG.attr('shape-rendering', "crispEdges");
        const elements = originalSVG.children();
        const new_group = originalSVG.group();
        new_group.attr("transform", transformStr)
        elements.filter((el) => el.type !== "defs").forEach((el) => new_group.add(el));
        const finalSVG = originalSVG.svg();
        ///////////////////////////////// END HANDLE FLIP BOOLS ////////////////////////////////////////////////

        //////////////////// RENDER SVG INTO RASTERIZED PNG /////////////////////////
        const board_width_px = Math.round(board_width_mm / xyRes);
        const board_height_px = Math.round(board_height_mm / xyRes);

        const layerImg = await SVGToImage({
            svg: finalSVG,
            width: board_width_px,
            height: board_height_px,
            outputFormat: "img"
        });
        //////////////////// END RENDER SVG INTO RASTERIZED PNG /////////////////////////


        //////////////////// RENDER SVG INTO RASTERIZED PNG (Preview) /////////////////////////
        const previewSVG = SVG(finalSVG);

        const previewConverterOptions = {
            svg: previewSVG.svg(),
            outputFormat: "img",
            width: options.printerSettings.previewResolution[0],
            height: options.printerSettings.previewResolution[1]
        }

        previewSVG.attr('shape-rendering', "geometricPrecision");
        const previewImg = await SVGToImage(previewConverterOptions);

        let previewCanvas = document.createElement('canvas');
        let previewContext = previewCanvas.getContext("2d");
        previewCanvas.width = options.printerSettings.previewResolution[0];
        previewCanvas.height = options.printerSettings.previewResolution[1];

        previewContext.drawImage(previewImg, 0, 0);

        //////////////////// END RENDER SVG INTO RASTERIZED PNG (Preview) /////////////////////////

        const canvas = document.createElement('canvas');
        canvas.width = outputResolution[0];
        canvas.height = outputResolution[1];
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = layer.inverted ? "black" : "white";
        ctx.fillRect(0, 0, outputResolution[0], outputResolution[1]);

        //////////////////////////////// DRAW BOARD IN CORRECT LOCATION ON CANVAS ////////////////////////
        const x_offset_px = Math.round(options.anchorOffset[0] / xyRes);
        const y_offset_px = Math.round(options.anchorOffset[1] / xyRes);

        const cornerToCoords = {
            "TL": [x_offset_px, y_offset_px],
            "TR": [longRes - x_offset_px - board_width_px, y_offset_px],
            "BL": [x_offset_px, shortRes - y_offset_px - board_height_px],
            "BR": [
                longRes - x_offset_px - board_width_px,
                shortRes - y_offset_px - board_height_px
            ]
        }
        const anchorCoords = cornerToCoords[options.anchorCorner];

        if (options.printerSettings.rotate180) {
            ctx.translate(outputResolution[0]/2,outputResolution[1]/2);
            ctx.rotate(Math.PI);
            ctx.translate(-outputResolution[0]/2, -outputResolution[1]/2);
        }

        if (outputResolution[0] < outputResolution[1]) {
            ctx.translate(outputResolution[0]/2,outputResolution[1]/2);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-outputResolution[1]/2, -outputResolution[0]/2);
        }

        ctx.drawImage(layerImg, anchorCoords[0], anchorCoords[1])

        //////////////////////////////// END DRAW BOARD IN CORRECT LOCATION ON CANVAS ////////////////////////

        ///// Generate PWMS file /////
        const rawLayerIMGData = ctx.getImageData(0, 0, outputResolution[0], outputResolution[1]);
        const rawPreviewData = previewContext.getImageData(
            0,
            0,
            options.printerSettings.previewResolution[0],
            options.printerSettings.previewResolution[1]
        );
        const photonFileBlob = await buildPhotonFile(
            rawLayerIMGData.data,
            rawPreviewData.data,
            exposureTime,
            options.printerSettings
        );
        ///// END Generate PWMS file /////

        ///// Generate PNG preview (for the UI) /////

        // We need to generate the output PNG rotated 90 degrees from the actual output for display purposes
        // we could re-do the render steps above without the rotations, but that will likely be error prone, and
        // since this is an output preview it is extremely important that it is an accurate reflection of the file
        // that is generated, therefore we render the above canvas to PNG and then draw it un-rotated on a new one

        const rotatedCanvas = document.createElement('canvas');

        rotatedCanvas.width = Math.max(outputResolution[0], outputResolution[1]);
        rotatedCanvas.height = Math.min(outputResolution[0], outputResolution[1]);

        const originalCanvasImg = await CanvasToImage(canvas);

        const previewCTX = rotatedCanvas.getContext("2d");

        if (options.printerSettings.rotate180 && outputResolution[0] < outputResolution[1]) {
            previewCTX.translate(outputResolution[1]/2,outputResolution[0]/2);
            previewCTX.rotate(Math.PI / 2);
            previewCTX.translate(-outputResolution[0]/2, -outputResolution[1]/2);
        } else if (options.printerSettings.rotate180) {
            previewCTX.translate(outputResolution[0]/2,outputResolution[1]/2);
            previewCTX.rotate(-Math.PI);
            previewCTX.translate(-outputResolution[0]/2, -outputResolution[1]/2);
        } else if (outputResolution[0] < outputResolution[1]) {
            previewCTX.translate(outputResolution[1]/2,outputResolution[0]/2);
            previewCTX.rotate(-Math.PI / 2);
            previewCTX.translate(-outputResolution[0]/2, -outputResolution[1]/2);
        }

        previewCTX.drawImage(originalCanvasImg, 0, 0);
        ////////

        output.push({
            'layerId': layer.id,
            'layer': layer,
            'layerPNGURL': rotatedCanvas.toDataURL(),
            'fileName': outputFileName,
            'slicedFile': photonFileBlob
        });
    }

    return output;
}

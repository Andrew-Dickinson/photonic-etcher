import {SVG as SVGJS} from '@svgdotjs/svg.js';
import {renderPhoton, renderStackup, downloadFiles as downloadFilesFunc} from "../../renderer/pcbAPI";

export async function loadFiles(fileList) {
    let files = Array.from(fileList);

    return await Promise.all(files.map(async (file, i) => {
        const text = await file.text();
        return {
            fileId: i,
            filename: file.name,
            gerber: text
        };
    }));
}

export async function renderPCB(files, checkList) {
    if (files) {
        let rendered_layers = files.filter((_, idx) => checkList[idx]);

        if (rendered_layers.length > 0) {
            const options = {color: {fr4: '#916b55'}};
            return await renderStackup(rendered_layers, options);
        } else {
            return [null, null];
        }
    } else {
        return [null, null];
    }
}

export async function renderPhotonFiles(layersToExport, export_options) {
    return await renderPhoton(layersToExport, export_options);
}

export async function downloadFiles(filesToDownload) {
    return await downloadFilesFunc(filesToDownload);
}

export function modifyRawSVG(layer, invert, drill, drillLayerSVGs) {
    const layerSVG = SVGJS(layer.svg);
    if (drill) {
        const originalG = layerSVG.find('g').filter((g) => g.parent() === layerSVG.root())[0];
        const newG = layerSVG.group().add(originalG);

        // const blueBG = layerSVG.rect().width("100%").height("100%").back().fill("#00f");
        const maskBG = layerSVG.rect().width("100%").height("100%").fill("#fff");
        const drillMask = layerSVG.mask().add(maskBG);

        drillLayerSVGs.forEach((singleDrillSVG) => {
            const drillSVG = SVGJS(singleDrillSVG);

            // Import defs from the drill file to the current layer
            const drillDefs = drillSVG.find('defs')[0].children();
            drillDefs.forEach((def) => layerSVG.find('defs')[0].svg(def.svg()))

            const drillG = drillSVG.find('g').filter((g) => g.parent() === drillSVG.root())[0];
            drillG.fill("#000")
            drillMask.svg(drillG.svg())
        })

        newG.maskWith(drillMask);
    }

    if (invert) {
        layerSVG.attr({color: "#fff"});
        layerSVG.rect().width("100%").height("100%").fill("#000").back();
    } else {
        layerSVG.attr({color: "#000"});
        layerSVG.rect().width("100%").height("100%").fill("#fff").back();
    }

    const newLayer = {...layer};
    newLayer['svg'] = layerSVG.svg();
    return newLayer;
}

export function addDisplayOrderField(layerList){
    const type_order = ["drill", "outline", "silkscreen", "soldermask",  "copper"];

    const sortedList = [...layerList].sort((layerA, layerB) => {
        if (layerA.type === layerB.type) return -layerA.side.localeCompare(layerB.side)
        return type_order.indexOf(layerB.type) - type_order.indexOf(layerA.type)
    })

    return sortedList.map((layer, i) => {return {...layer, displayOrder: i}})
}

export function renderAllLayers(layerList, invertedList, drilledList, drillLayerSVGs){
    const newLayerList = Array(layerList.length).fill(null);
    layerList.filter((layer) => layer != null)
        .map((layer) => modifyRawSVG(layer, invertedList[layer.id], drilledList[layer.id], drillLayerSVGs))
        .forEach((layer) => newLayerList[layer.id] = layer);
    return newLayerList;
}
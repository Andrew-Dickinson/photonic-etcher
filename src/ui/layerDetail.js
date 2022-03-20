import React, {useEffect, useState} from "react";
import LayerCard from "./layer_card";
import {titleCase} from "title-case";


function LayerDetail(props){
    const {layerIMGs} = props;
    const {onLayerEnabledChange, onLayerDrilledChange, onLayerInvertedChange} = props;
    const {enabledList, drilledList, invertedList} = props;

    const [groupedLayers, setGroupedLayers] = useState({});
    const [drillAndOutlineLayers, setDrillAndOutlineLayers] = useState([]);
    const [misfitLayers, setMisfitLayers] = useState([]);

    useEffect(() => {
        const grouped_by_type = {"drill": []};
        if (!layerIMGs || layerIMGs.length === 0){
            setGroupedLayers(grouped_by_type);
            setMisfitLayers([]);
            setDrillAndOutlineLayers([]);
            return;
        }

        layerIMGs.filter((layer) => layer != null).forEach((layer) => {
            if (!grouped_by_type[layer.type]) grouped_by_type[layer.type] = []
            grouped_by_type[layer.type].push(layer)
        })

        Object.entries(grouped_by_type).forEach(([_, layers]) => {
            layers.sort((a, b) => -a.side.localeCompare(b.side))
        })
        setGroupedLayers(grouped_by_type);

        const misfit_layers = [];
        Object.entries(grouped_by_type)
            .filter(([type, _]) => ["copper", "soldermask", "silkscreen", "outline", "drill"].indexOf(type) === -1)
            .forEach(([_, layers]) => {
                misfit_layers.push(...layers)
            })
        setMisfitLayers(misfit_layers)

        let drill_and_outline = [];
        if (grouped_by_type["outline"]) {
            drill_and_outline = drill_and_outline.concat(grouped_by_type["outline"]);
        }
        if (grouped_by_type["drill"]) {
            drill_and_outline = drill_and_outline.concat(grouped_by_type["drill"]);
        } else {
            grouped_by_type["drill"] = []
        }
        setDrillAndOutlineLayers(drill_and_outline);
    }, [layerIMGs])

    let layerIndex = 0;
    return <div className={"box"}>
        <div className={"rows content ps-4"}>
            { ["copper", "soldermask", "silkscreen"].map((known_layer_name, i) =>
                groupedLayers[known_layer_name] ?
                    <div className={"mt-3"} key={i}>
                        <h3> {titleCase(known_layer_name)}</h3>
                        <div className="row row-cols-1 row-cols-md-2 row-cols-xxl-3 g-4 w-100 pt-4">
                            {groupedLayers[known_layer_name].map((layer, i) =>
                                <LayerCard layerData={{...layer, 'displayOrder': layerIndex++}}
                                           enabled={enabledList[layer['id']]}
                                           drillHoles={drilledList[layer['id']]}
                                           inverted={invertedList[layer['id']]}
                                           onEnabledChange={(newVal) => onLayerEnabledChange(layer['id'], newVal)}
                                           onInvertedChange={(newVal) => onLayerInvertedChange(layer['id'], newVal)}
                                           onDrillChange={(newVal) => onLayerDrilledChange(layer['id'], newVal)}
                                           enableDrilling={groupedLayers['drill'].length > 0}
                                           key={i}
                                />
                            )}
                        </div>
                    </div>
                :
                    ""
            )}
            { drillAndOutlineLayers.length > 0 ?
                <div className={"mt-3"}>
                    <h3>{"Drill & Outline"}</h3>
                    <div className="row row-cols-1 row-cols-md-2 row-cols-xxl-3 g-4 w-100 pt-4">
                        {drillAndOutlineLayers.map((layer, i) =>
                            <LayerCard layerData={{...layer, 'displayOrder': layerIndex++}}
                                       enabled={enabledList[layer['id']]}
                                       drillHoles={drilledList[layer['id']]}
                                       inverted={invertedList[layer['id']]}
                                       onEnabledChange={(newVal) => onLayerEnabledChange(layer['id'], newVal)}
                                       onInvertedChange={(newVal) => onLayerInvertedChange(layer['id'], newVal)}
                                       onDrillChange={(newVal) => onLayerDrilledChange(layer['id'], newVal)}
                                       enableDrilling={groupedLayers['drill'].length > 0}
                                       key={i}
                            />
                        )}
                    </div>
                </div>
            :
                ""
            }
            { misfitLayers.length > 0 ?
                <div className={"mt-3"}>
                    <h3>{"Other Layers"}</h3>
                    <div className="row row-cols-1 row-cols-md-2 row-cols-xxl-3 g-4 w-100 pt-4">
                        {misfitLayers.map((layer, i) =>
                            <LayerCard layerData={{...layer, 'displayOrder': layerIndex++}}
                                       enabled={enabledList[layer['id']]}
                                       drillHoles={drilledList[layer['id']]}
                                       inverted={invertedList[layer['id']]}
                                       onEnabledChange={(newVal) => onLayerEnabledChange(layer['id'], newVal)}
                                       onInvertedChange={(newVal) => onLayerInvertedChange(layer['id'], newVal)}
                                       onDrillChange={(newVal) => onLayerDrilledChange(layer['id'], newVal)}
                                       enableDrilling={groupedLayers['drill'].length > 0}
                                       key={i}
                            />
                        )}
                    </div>
                </div>
                :
                ""
            }
        </div>
    </div>
}

export default LayerDetail;
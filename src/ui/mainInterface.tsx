import { useEffect, useState } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import React from "react";
import PCBPreview from "./pcb_preview";
import FileSelectSideBar from "./file_select_sidebar";
import LayerDetail from "./layerDetail";
import StepWizard from "./utils/step_wizard";
import Nav from "./utils/nav";
import { GerberFile, GerberFileHandle, loadFiles, modifyRawSVG, renderAllLayers, renderPCB } from "./utils/pcb_api_utils";
import { usePrevious } from "./utils/util";
import ExportDialog from "./export_dialog";
import { StackupLayer } from "../renderer/stackup-renderer";
import gerberToSvg from "gerber-to-svg";

function allowPageChange(dir, curPage, loading, checkList, enabledList) {
    if (loading) return false;

    const numChecked = checkList ? checkList.reduce((prev, cur) => cur ? prev + 1 : prev, 0) : 0;
    if (curPage === 0 && dir === "next") {
        return numChecked > 0;
    }

    if (curPage === 1) {
        if (dir === "prev") return true;

        const numEnabled = enabledList ? enabledList.reduce((prev, cur) => cur ? prev + 1 : prev, 0) : 0;
        if (dir === "next") return numEnabled > 0
    }
    return false;
}

function MainInterface(props) {
    const [curPage, setCurPage] = useState(0);

    const [fileList, setFileList] = useState<GerberFileHandle[]>([]);
    const [files, setFiles] = useState<GerberFile[]>([]);
    const [checkList, setCheckList] = useState<boolean[]>([]);
    const [rootFileName, setRootFileName] = useState("");

    const [loading, setLoading] = useState(false);
    const [renderError, setRenderError] = useState(null);

    const [fullBoardIMGs, setFullBoardIMGs] = useState([null, null]);
    const [rawLayers, setRawLayers] = useState<StackupLayer[]>([]);
    const [drillLayerSVGs, setDrillLayerSVGs] = useState<(gerberToSvg.Converter<string> | string)[]>([]);
    const [processedLayers, setProcessedLayers] = useState<StackupLayer[]>([]);

    const [enabledList, setEnabledList] = useState<boolean[]>([]);
    const [invertedList, setInvertedList] = useState<boolean[]>([]);
    const [drilledList, setDrilledList] = useState<boolean[]>([]);

    const [showExportDialog, setShowExportDialog] = useState(false);

    const previousInvertedList = usePrevious(invertedList);
    const previousDrilledList = usePrevious(drilledList);

    useEffect(() => {
        setEnabledList(new Array(fileList.length).fill(false));
        setInvertedList(new Array(fileList.length).fill(false));
        setDrilledList(new Array(fileList.length).fill(false));

        loadFiles(fileList).then(setFiles);
    }, [fileList])

    useEffect(() => {
        (async () => {
            const numChecked = checkList ? checkList.reduce((prev, cur) => cur ? prev + 1 : prev, 0) : 0;
            if (numChecked === 0) {
                setFullBoardIMGs([null, null]);
                setRawLayers([]);
                return;
            }

            setLoading(true);
            try {
                const renderResult = await renderPCB(files, checkList);

                if (renderResult != null) {
                    setFullBoardIMGs([renderResult.combinedIMGs.top_png_blob_url, renderResult.combinedIMGs.bottom_png_blob_url]);
                } else {
                    setFullBoardIMGs([null, null]);
                }

                const rawLayerIMGs: StackupLayer[] = Array(files.length).fill(null);
                let drillSVGs: (gerberToSvg.Converter<string> | string)[] = [];
                if (renderResult != null) {
                    renderResult.individualLayerSVGs.forEach((layer) => rawLayerIMGs[layer.id] = layer);
                    drillSVGs = renderResult.individualLayerSVGs.filter((layer) => layer.type === "drill").map((layer) => layer.svg);
                }
                setDrillLayerSVGs(drillSVGs);
                setRawLayers(rawLayerIMGs);
            } catch (e) {
                console.log("Unable to load Preview", e)
                setFullBoardIMGs([null, null])
                setRenderError(e);
            } finally {
                setLoading(false);
            }
        })()
    }, [files, checkList])

    useEffect(() => {
        setProcessedLayers(renderAllLayers(rawLayers, invertedList, drilledList, drillLayerSVGs))
    }, [rawLayers])

    useEffect(() => {
        invertedList.forEach((inverted, i) => {
            if (previousInvertedList![i] != null && previousInvertedList![i] !== inverted) {
                setProcessedLayers((oldLayerIMGs) => {
                    oldLayerIMGs[i] = modifyRawSVG(rawLayers[i], invertedList[i], drilledList[i], drillLayerSVGs);
                    return [...oldLayerIMGs]
                })
            }
        })
    }, [invertedList])

    useEffect(() => {
        drilledList.forEach((drilled, i) => {
            if (previousDrilledList![i] != null && previousDrilledList![i] !== drilled) {
                setProcessedLayers((oldLayerIMGs) => {
                    oldLayerIMGs[i] = modifyRawSVG(rawLayers[i], invertedList[i], drilledList[i], drillLayerSVGs);
                    return [...oldLayerIMGs]
                })
            }
        })
    }, [drilledList])

    return (
        <div className={"h-100"}>
            <div className={"container-fluid h-100"}>
                <div className={"row h-100"}>
                    <FileSelectSideBar onFileListChange={setFileList}
                        onCheckListChange={setCheckList}
                        onRootFileNameChange={setRootFileName}
                    />
                    <div className={"col p-0 h-100"}>
                        <StepWizard nav={<Nav />} className={"box pagefill"}
                            loading={loading}
                            onExport={() => setShowExportDialog(true)}
                            allowNext={allowPageChange("next", curPage, loading, checkList, enabledList)}
                            allowBack={allowPageChange("prev", curPage, loading, checkList, enabledList)}
                            pageChange={(page) => setCurPage(page)}>
                            <PCBPreview boardIMGs={fullBoardIMGs} previewError={renderError} />
                            <LayerDetail layerIMGs={processedLayers}
                                enabledList={enabledList}
                                invertedList={invertedList}
                                drilledList={drilledList}
                                onLayerEnabledChange={(layer_id, enabled) => {
                                    setEnabledList((oldLayersEnabled) => {
                                        const newLayersEnabled = [...oldLayersEnabled];
                                        newLayersEnabled[layer_id] = enabled;
                                        return newLayersEnabled;
                                    })
                                }}
                                onLayerInvertedChange={(layer_id, inverted) => {
                                    setInvertedList((oldLayersInverted) => {
                                        const newLayersInverted = [...oldLayersInverted];
                                        newLayersInverted[layer_id] = inverted;
                                        return newLayersInverted;
                                    })
                                }}
                                onLayerDrilledChange={(layer_id, drilled) => {
                                    setDrilledList((oldLayersDrilled) => {
                                        const newLayersDrilled = [...oldLayersDrilled];
                                        newLayersDrilled[layer_id] = drilled;
                                        return newLayersDrilled;
                                    })
                                }}
                            />
                        </StepWizard>
                    </div>
                </div>
            </div>
            <ExportDialog layers={processedLayers}
                enabledLayers={enabledList}
                invertedLayers={invertedList}
                showDialog={showExportDialog}
                setShowDialog={setShowExportDialog}
                rootFileName={rootFileName}
                onLayerEnabledChange={(layer_id, enabled) => {
                    setEnabledList((oldLayersEnabled) => {
                        const newLayersEnabled = [...oldLayersEnabled];
                        newLayersEnabled[layer_id] = enabled;
                        return newLayersEnabled;
                    })
                }}
            />
        </div>
    );
}

export default MainInterface;
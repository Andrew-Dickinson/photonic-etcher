import {Button, Modal, ProgressBar, Table} from "react-bootstrap";
import React, {useEffect, useState} from "react";
import {titleCase} from "title-case";
import {addDisplayOrderField, downloadFiles, renderPhotonFiles} from "./utils/pcb_api_utils";

const printerModels = {
    'AnyCubic Photon Mono SE': {
        "xyRes": 0.051,
        "resolution": [1620, 2560],
        "previewResolution": [224, 168],
        "fileFormat": "pwms"
    }
}


function ExportDialog(props){
    const {showDialog, setShowDialog} = props;
    const {layers, enabledLayers, onLayerEnabledChange, invertedLayers} = props;

    const [printerModel, setPrinterModel] = useState(Object.entries(printerModels)[0][0]);
    const [anchorCorner, setAnchorCorner] = useState("TR");
    const [anchorOffset, setAnchorOffset] = useState([0, 0]);
    const [anchorOffsetText, setAnchorOffsetText] = useState(["0.0", "0.0"]);
    const [flipBools, setFlipBools] = useState([false, true, false, false]);

    const [exposureTimes, setExposureTimes] = useState([]);

    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    const [photonFiles, setphotonFiles] = useState([]);
    const [outputPath, setOutputPath] = useState("");

    const sortedLayers = addDisplayOrderField(layers.filter((l) => l !== null));
    sortedLayers.sort((layerA, layerB) => {
        if (layerA.displayOrder < layerB.displayOrder) return -1;
        if (layerA.displayOrder > layerB.displayOrder) return 1;
        return 0;
    })

    useEffect(() => {
        setExposureTimes(Array(layers.length).fill(10));
    }, [layers])

    useEffect(() => {
        let newVals = [null, null]
        if (anchorOffsetText[0].length > 0) {
            try {
                newVals[0] = parseFloat(anchorOffsetText[0]);
                if (newVals[0] < 0) newVals[0] = null;
            } catch {}
        }
        if (anchorOffsetText[1].length > 0) {
            try {
                newVals[1] = parseFloat(anchorOffsetText[1]);
                if (newVals[1] < 0) newVals[1] = null;
            } catch {}
        }
        setAnchorOffset(newVals);
    }, [anchorOffsetText])

    const inputsValid = () => {
        if (exposureTimes.reduce((oldVal, current, i) => {
            if (oldVal) return true;
            return !!(enabledLayers[i] && current == null);
        }, false)) return false;
        return enabledLayers.reduce((old, current) => current ? old + 1 : old, 0) > 0
            && anchorOffset[0] != null && anchorOffset[1] != null
    }

    const setExposureTime = (layer_id, exposureTime) => {
        setExposureTimes((oldExposureTimes) => {
            const newExposureTimes = [...oldExposureTimes];
            newExposureTimes[layer_id] = exposureTime;
            return newExposureTimes;
        })
    }

    return <Modal show={showDialog}
                  onHide={() => setShowDialog(false)}
                  onExited={() => {
                      setShowPreview(false);
                      setPreviewLoading(false);
                      setOutputPath("");
                  }}
                  size={"lg"}>
        <Modal.Header closeButton>
            <Modal.Title>Export Layers</Modal.Title>
        </Modal.Header>

        <Modal.Body>
            <div className={"container"}>
                {showPreview ?
                    <div className={"row"}>
                        {previewLoading ?
                            <div className={"d-flex justify-content-center"}>
                                <div className={"col-lg-7 col-md-12 col-12"}>
                                    <ProgressBar animated now={100}/>
                                    <div className={"text-center m-2"}>
                                        Generating Photon Files...
                                    </div>
                                </div>
                            </div>
                            :
                            photonFiles ?
                                outputPath ?
                                    <div className="alert alert-success" role="alert">
                                        <h4 className="alert-heading">Export Successful</h4>
                                        <p>Wrote <b>{enabledLayers.filter(e => e).length}</b> files to: <i>{outputPath}</i></p>

                                    </div>
                                    :
                                    <div>
                                        {
                                            photonFiles.map(photonFile =>
                                                <div className={"row mb-3"} key={photonFile.layerId}>
                                                    <div className={"col-12"}>
                                                        <div className="card">
                                                            <div className="card-header">
                                                                <h5 className="card-title">
                                                                    {titleCase(photonFile.layer.type) + " "}
                                                                    ({titleCase(photonFile.layer.side)})</h5>
                                                            </div>
                                                            <div className={"grey card-body"}>
                                                                <img src={photonFile.layerPNGURL} className={"w-100"}/>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    </div>
                                :
                                <></>
                        }
                    </div>
                    :
                    <div className={"row"}>
                        <div className={"col-lg-6"}>
                            <h5>Selected Layers</h5>
                            <Table striped={true}>
                                <thead>
                                <tr>
                                    <td></td>
                                    <td>Type</td>
                                    <td>Side</td>
                                    {/*<td>File Name</td>*/}
                                    <td style={{width: "170px"}}>Exposure Time</td>
                                </tr>
                                </thead>
                                <tbody>
                                {
                                    sortedLayers.filter((l) => l != null).map(
                                        (layer) => <tr key={layer.id}>
                                            <td>
                                                <div className="form-check">
                                                    <input className="form-check-input" type="checkbox"
                                                           checked={enabledLayers[layer.id]}
                                                           onChange={(e) => {
                                                               e.persist();
                                                               onLayerEnabledChange(layer.id, e.target.checked)
                                                           }}
                                                           id={"layerenabled" + layer.id}/>
                                                </div>
                                            </td>
                                            <td className={enabledLayers[layer.id] ? "" : "light"}>{titleCase(layer.type)}</td>
                                            <td className={enabledLayers[layer.id] ? "" : "light"}>{titleCase(layer.side)}</td>
                                            {/*<td>{layer.filename}</td>*/}
                                            <td>
                                                <div className="input-group has-validation">
                                                    <span className="input-group-text" id="addon-wrapping">
                                                        <i className="icon bi-clock"/>
                                                    </span>
                                                    <input type="number" disabled={!enabledLayers[layer.id]} className={
                                                        "form-control" + (exposureTimes[layer.id] <= 0 ? " is-invalid" : "")
                                                    }
                                                           aria-label="exposure-time"
                                                           aria-describedby="addon-wrapping"
                                                           value={enabledLayers[layer.id] ? exposureTimes[layer.id] : ""}
                                                           onChange={(e) => {
                                                               if (e.target.value.length > 0) {
                                                                   setExposureTime(layer.id, parseInt(e.target.value))
                                                               } else {
                                                                   setExposureTime(layer.id, undefined);
                                                               }
                                                           }}
                                                    />
                                                    <span className="input-group-text">s</span>
                                                    <div className="invalid-feedback">Enter a positive integer</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                }

                                </tbody>
                            </Table>
                        </div>
                        <div className={"col-lg-6"}>
                            <h5>Export Options</h5>
                            <div className={"mb-3"}>
                                <label className={"form-label"}>
                                    Printer Model
                                </label>
                                <div className="input-group flex-nowrap">
                                    <select className="form-select" aria-label="Default select example"
                                            defaultValue={Object.entries(printerModels)[0][0]}
                                            onChange={(e) => setPrinterModel(e.target.value)}>
                                        {
                                            Object.entries(printerModels).map((entry, _) => {
                                                const modelName = entry[0];
                                                return <option key={modelName} value={modelName}>{modelName}</option>
                                            })
                                        }
                                    </select>
                                </div>
                            </div>
                            <div className={"mb-3"}>
                                <label className={"form-label"}>Anchor Corner</label>
                                <div className={"w-50"}>
                                    <div className="card">
                                        <div className="card-body box p-2">
                                            <div className={"rows header"}>
                                                <input className="form-check-input float-start" type="radio"
                                                       name={"anchorCorner"} id="anchorTopLeft" aria-label=""
                                                       checked={anchorCorner === "TL"}
                                                       onChange={() => setAnchorCorner("TL")}
                                                />
                                                <input className="form-check-input float-end" type="radio"
                                                       name={"anchorCorner"} id="anchorTopRight" aria-label=""
                                                       checked={anchorCorner === "TR"}
                                                       onChange={() => setAnchorCorner("TR")}
                                                />
                                            </div>
                                            <div className={"rows content"} style={{height: "40px"}}/>
                                            <div className={"rows header"}>
                                                <input className="form-check-input float-start" type="radio"
                                                       name={"anchorCorner"} id="anchorBottomLeft" aria-label=""
                                                       checked={anchorCorner === "BL"}
                                                       onChange={() => setAnchorCorner("BL")}
                                                />
                                                <input className="form-check-input float-end" type="radio"
                                                       name={"anchorCorner"} id="anchorBottomRight" aria-label=""
                                                       checked={anchorCorner === "BR"}
                                                       onChange={() => setAnchorCorner("BR")}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <label className="text-center w-100 float mt-2 light">Printer Front</label>
                                </div>
                            </div>
                            <div className={"mb-3"}>
                                <label htmlFor="exampleFormControlInput1" className="form-label">
                                    Anchor Offset
                                </label>
                                <div className={"row"}>
                                    <div className={"col-6"}>
                                        <div className="input-group me-3 has-validation">
                                                <span className="input-group-text" id="addon-wrapping">
                                                    X
                                                </span>
                                            <input type="number"
                                                   className={"form-control" + (anchorOffset[0] == null ? " is-invalid" : "")}
                                                   aria-label="exposure-time"
                                                   aria-describedby="addon-wrapping" value={anchorOffsetText[0]}
                                                   onChange={(e) => {
                                                       e.persist();
                                                       setAnchorOffsetText((oldOffset) => {
                                                           oldOffset[0] = e.target.value
                                                           return [...oldOffset]
                                                       })
                                                   }}
                                            />
                                            <span className="input-group-text">mm</span>
                                            <div className="invalid-feedback">Enter a non-negative number</div>
                                        </div>
                                    </div>
                                    <div className={"col-6"}>
                                        <div className="input-group has-validation">
                                                <span className="input-group-text" id="addon-wrapping">
                                                    Y
                                                </span>
                                            <input type="number"
                                                   className={"form-control" + (anchorOffset[1] == null ? " is-invalid" : "")}
                                                   aria-label="exposure-time"
                                                   aria-describedby="addon-wrapping" value={anchorOffsetText[1]}
                                                   onChange={(e) => {
                                                       e.persist();
                                                       setAnchorOffsetText((oldOffset) => {
                                                           oldOffset[1] = e.target.value
                                                           return [...oldOffset]
                                                       })
                                                   }}
                                            />
                                            <span className="input-group-text">mm</span>
                                            <div className="invalid-feedback">Enter a non-negative number</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="exampleFormControlInput1" className="form-label">
                                    Flip Exported Layers
                                </label>
                                <div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="checkbox" checked={flipBools[0]}
                                               onChange={(e) => {
                                                   e.persist();
                                                   setFlipBools((oldVals) => {
                                                       oldVals[0] = e.target.checked;
                                                       return [...oldVals];
                                                   })
                                               }}
                                               id="topHorizontal"/>
                                        <label className="form-check-label" htmlFor="flexCheckDefault">
                                            Top Horizontal
                                        </label>
                                    </div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="checkbox" checked={flipBools[1]}
                                               onChange={(e) => {
                                                   e.persist();
                                                   setFlipBools((oldVals) => {
                                                       oldVals[1] = e.target.checked;
                                                       return [...oldVals];
                                                   })
                                               }}
                                               id="topVertical"/>
                                        <label className="form-check-label" htmlFor="flexCheckChecked">
                                            Top Vertical
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="checkbox" checked={flipBools[2]}
                                               onChange={(e) => {
                                                   e.persist();
                                                   setFlipBools((oldVals) => {
                                                       oldVals[2] = e.target.checked;
                                                       return [...oldVals];
                                                   })
                                               }}
                                               id="bottomHorizontal"/>
                                        <label className="form-check-label" htmlFor="flexCheckDefault">
                                            Bottom Horizontal
                                        </label>
                                    </div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="checkbox" checked={flipBools[3]}
                                               onChange={(e) => {
                                                   e.persist();
                                                   setFlipBools((oldVals) => {
                                                       oldVals[3] = e.target.checked;
                                                       return [...oldVals];
                                                   })
                                               }}
                                               id="bottomVertical"/>
                                        <label className="form-check-label" htmlFor="flexCheckChecked">
                                            Bottom Vertical
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                }
            </div>


        </Modal.Body>

        <Modal.Footer>
            <Button variant="secondary" onClick={() => {
                if (showPreview) {
                    setShowPreview(false);
                    setPreviewLoading(false);
                    setOutputPath("");
                } else {
                    setShowDialog(false);
                }
            }}>
                Back
            </Button>
            {outputPath ?
                <></>
                :
                <Button variant="primary" disabled={!inputsValid() || previewLoading}
                        onClick={() => {
                            if (showPreview) {
                                downloadFiles(photonFiles).then(filePath => {
                                    if (filePath) {
                                        setOutputPath(filePath);
                                    }
                                })
                            } else {
                                setShowPreview(true);
                                setPreviewLoading(true);

                                const options = {
                                    printerSettings: {...printerModels[printerModel], printerModel},
                                    exposureTimes,
                                    anchorOffset,
                                    anchorCorner,
                                    flipBools
                                };

                                const layersToRender = addDisplayOrderField(layers
                                    .map((layer, i) => {
                                        return {...layer, inverted: invertedLayers[i]}
                                    })
                                    .filter((_, idx) => enabledLayers[idx]));

                                console.log(layersToRender)

                                renderPhotonFiles(layersToRender, options).then(results => {
                                    setphotonFiles(results);
                                    setPreviewLoading(false);
                                });
                            }
                        }}>
                    {showPreview ? "Download All" : "Preview"}
                </Button>
            }
        </Modal.Footer>
    </Modal>
}

export default ExportDialog;
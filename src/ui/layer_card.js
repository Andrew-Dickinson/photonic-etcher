import {SVG} from "./utils/render_img";
import React from "react";
import { titleCase } from "title-case";

function LayerCard(props) {
    const {layerData, enableDrilling} = props;
    const {enabled, inverted, drillHoles} = props;

    const drillDisabled = !enableDrilling || layerData.type === "drill" || layerData.type === "outline";

    return <div className="col mt-2">
            <div className="card h-100 text-dark">
                <a href={"#"}
                    className="card-header pb-0 btn btn-box-header text-start"
                   data-bs-toggle="button"
                   role="button"
                   onClick={() => {if (props.onEnabledChange) props.onEnabledChange(!enabled)}}
                >
                    <div className={"form-check form-switch"}>
                        <input type={'checkbox'}
                               className={"form-check-input cursor-pointer"}
                               checked={enabled}
                               tabIndex="-1"
                               readOnly={true}
                        />
                        <h5 className="card-title">{titleCase(layerData.type) + " "}
                            ({titleCase(layerData.side)})
                        </h5>
                    </div>
            </a>
            <SVG text={layerData.svg}
                 draggable={enabled}
                 className={"card-img-top p-2 selectDisable" + (enabled ? "" : " disabled-button")}
            />

            <ul className={"list-group list-group-flush" + (enabled ? "" : " disabled-button")}>
                <a href={"#"}
                   className={"list-group-item btn btn-outline-secondary text-start"}
                   data-bs-toggle="button"
                   tabIndex={!enabled ? -1 : ""}
                   role="button"
                   // disabled={!enabled}
                   onClick={() => {if (props.onInvertedChange) props.onInvertedChange(!inverted)}}>

                    <div className="form-check form-switch">
                        <input id={"inverted-checkbox"}
                               className={"form-check-input cursor-pointer"}
                               type={'checkbox'}
                               role={'switch'}
                               tabIndex="-1"
                               checked={inverted}
                               readOnly={true}
                        />
                        Invert Colors
                    </div>
                </a>
                <a href={"#"}
                   className={"list-group-item btn btn-outline-secondary text-start"
                       + (drillDisabled ? " disabled" : "")}
                   data-bs-toggle="button"
                   role="button"
                   tabIndex={(!enabled || drillDisabled) ? -1 : ""}
                   aria-disabled={!enabled || drillDisabled}
                   onClick={() => {if (props.onDrillChange) props.onDrillChange(!drillHoles)}}>

                    <div className="form-check form-switch">
                        <input id={"drill-checkbox"}
                               className={"form-check-input cursor-pointer"}
                               type={'checkbox'}
                               role={'switch'}
                               tabIndex="-1"
                               checked={drillHoles}
                               readOnly={true}
                        />
                        Subtract Drill Layer(s)
                    </div>
                </a>
            </ul>
        </div>
    </div>
}

export default LayerCard;
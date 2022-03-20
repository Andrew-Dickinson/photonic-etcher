import React from "react";

import {URLPNG} from "./utils/render_img";
import {Alert} from "react-bootstrap";

function PCBPreview(props) {
    const {boardIMGs, previewError} = props;

    return <div className={"h-100 w-100"}>
        {
            previewError ?
                    <Alert className={"alert-danger m-4"}>
                        <h4>Unable to load preview</h4>
                        {previewError.toString()}
                    </Alert>
                :
                boardIMGs[0] && boardIMGs[1] ?
                    <div className={"box"}>
                        <div className={"container rows content"}>
                            <div className={"row d-flex justify-content-center p-2"}>
                                <div className={"col-10"}>
                                    <URLPNG url={boardIMGs[0]} className={"w-100"}/>
                                </div>
                            </div>
                            <div className={"row d-flex justify-content-center p-2"}>
                                <div className={"col-10"}>
                                    <URLPNG url={boardIMGs[1]} className={"w-100"}/>
                                </div>
                            </div>
                        </div>
                    </div>
                :
                    <div className={"d-flex justify-content-center text-center h-100 align-items-center"}>
                        <div>
                            <p>No files to preview</p>
                        </div>
                    </div>
        }
    </div>
}

export default PCBPreview;
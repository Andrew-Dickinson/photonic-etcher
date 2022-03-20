import Filelist from "./filelist";
import Button from "react-bootstrap/Button";
import {useEffect, useRef, useState} from "react";
import React from "react";


function FileSelectSideBar(props){
    const [checkList, setCheckList] = useState([]);
    const [fileList, setFileList] = useState([]);

    const inputFile = useRef(null);
    const inputFile2 = useRef(null);

    const onButtonClick = (ref) => {
        ref.current.click();
    };

    useEffect(() => {
        props.onCheckListChange(checkList)
    }, [checkList])

    useEffect(() => {
        props.onFileListChange(fileList)
    }, [fileList])

    const filesText = fileList.length === 0 ?
        "" :
        fileList.length + " File" + (fileList.length > 1 ? "s" : "") + " Found:";

    const FileSelectButtons = ({primary}) => <div>
        <Button onClick={() => onButtonClick(inputFile)} className={"m-1"}
                variant={primary ? "primary" : "outline-light"}>
            Select {primary ? "" : "New"} Files
        </Button>

        <Button onClick={() => onButtonClick(inputFile2)} className={"m-1"}
                variant={primary ? "primary" : "outline-light"}>
            Select {primary ? "" : "New"} Folder
        </Button>
    </div>;

    return <div className={"col-4 dark-bg p-3 h-100"}>
        <input type='file' id='file' ref={inputFile2} className={"hidden"} directory=""
               webkitdirectory="" onInput={() => setFileList(inputFile2.current.files)}/>
        <input type='file' id='folder' ref={inputFile} className={"hidden"}
               multiple="multiple"
               onInput={() => setFileList(inputFile.current.files)}/>
        <div className={"box"}>
            <div className={"rows header"}>
                <FileSelectButtons primary={fileList.length === 0}/>
            </div>

            {
                fileList.length > 0 ?
                    <>
                        <div className={"rows header"}>
                            <hr/>
                            <p className={"px-2 mb-1"}>{filesText}</p>
                        </div>
                        <div className={"rows content mb-3"}>
                            <Filelist fileList={fileList}
                                      onChange={(newCheckList) => setCheckList(newCheckList)}/>
                        </div>
                    </>
                    :
                    ""
            }
            <div className={"rows content"}/>
        </div>
    </div>
}

export default FileSelectSideBar;
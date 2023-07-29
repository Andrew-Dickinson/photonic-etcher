import Filelist from "./filelist";
import Button from "react-bootstrap/Button";
import { useEffect, useRef, useState } from "react";
import React from "react";
import { GerberFileHandle, convertZIPToFileList } from "./utils/pcb_api_utils";

function FileSelectSideBar(props: {
    onFileListChange: (files: GerberFileHandle[]) => void,
    onCheckListChange: (checkList: boolean[]) => void,
    onRootFileNameChange: (rootFileName: string) => void
}) {
    const [checkList, setCheckList] = useState([]);
    const [fileList, setFileList] = useState<GerberFileHandle[]>([]);
    const [rootFileName, setRootFileName] = useState("");

    const inputFile = useRef<HTMLInputElement>(null);
    const inputFile2 = useRef<HTMLInputElement>(null);
    const inputFile3 = useRef<HTMLInputElement>(null);

    const onButtonClick = (ref) => {
        ref.current.click();
    };

    useEffect(() => {
        props.onCheckListChange(checkList)
    }, [checkList])

    useEffect(() => {
        props.onFileListChange(fileList)
    }, [fileList])

    useEffect(() => {
        props.onRootFileNameChange(rootFileName)
    }, [rootFileName])

    const filesText = fileList.length === 0 ?
        "" :
        fileList.length + " File" + (fileList.length > 1 ? "s" : "") + " Found:";

    const FileSelectButtons = ({ primary }) => <div>
        <Button onClick={() => onButtonClick(inputFile)} className={"m-1"}
            variant={primary ? "primary" : "outline-light"}>
            Select {primary ? "" : "New"} Gerber Files
        </Button>

        <Button onClick={() => onButtonClick(inputFile2)} className={"m-1"}
            variant={primary ? "primary" : "outline-light"}>
            Select {primary ? "" : "New"} Folder
        </Button>

        <Button onClick={() => onButtonClick(inputFile3)} className={"m-1"}
            variant={primary ? "primary" : "outline-light"}>
            Select {primary ? "" : "New"} ZIP
        </Button>
    </div>;

    return <div className={"col-4 dark-bg p-3 h-100"}>
        <input type='file' id='files' ref={inputFile} className={"hidden"}
            multiple={true} accept={".g*,.zip,.txt,.xln,.drl"}
            onInput={() => {
                if (inputFile.current?.files != null && inputFile.current.files.length > 0) {
                    setRootFileName("")
                    setFileList(Array.from(inputFile.current.files))
                }
            }} />
        <input type='file' id='folder' ref={inputFile2} className={"hidden"}
            onInput={() => {
                if (inputFile2.current?.files != null && inputFile2.current.files.length > 0) {
                    setRootFileName(inputFile2.current.files[0].webkitRelativePath.split("/")[0]);
                    setFileList(Array.from(inputFile2.current.files));
                }
            }} />
        <input type='file' id='zip_file' ref={inputFile3} className={"hidden"}
            accept={".zip"}
            onInput={async () => {
                if (inputFile3.current?.files != null && inputFile3.current.files.length > 0) {
                    setRootFileName(inputFile3.current.files[0].name.replace(".zip", ""))
                    convertZIPToFileList(inputFile3.current.files[0]).then(setFileList)
                }
            }} />
        <div className={"box"}>
            <div className={"rows header"}>
                <FileSelectButtons primary={fileList.length === 0} />
            </div>

            {
                fileList.length > 0 ?
                    <>
                        <div className={"rows header"}>
                            <hr />
                            <p className={"px-2 mb-1"}>{filesText}</p>
                        </div>
                        <div className={"rows content mb-3"}>
                            <Filelist fileList={fileList}
                                onChange={(newCheckList) => setCheckList(newCheckList)} />
                        </div>
                    </>
                    :
                    <div className={"rows content"} />
            }
            <div className={"rows footer"}>
                <a href={"https://github.com/Andrew-Dickinson/photonic-etcher"} className={"btn btn-light"} target={"_blank"}>
                    <i className="bi-github" role="img" aria-label="GitHub"></i> View on Github
                </a>
            </div>
        </div>
    </div>
}

export default FileSelectSideBar;
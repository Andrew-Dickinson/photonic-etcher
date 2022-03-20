import prettyBytes from "pretty-bytes";
import {useEffect, useState} from "react";

function FileList(props) {
    const {fileList} = props;
    const files = Array.from(fileList);
    const [filesChecked, setFilesChecked] = useState(files.map((file) => true));

    useEffect(() => {
        setFilesChecked(files.map((file) => file.name.indexOf('solderpaste') === -1));
    }, [props.fileList])

    useEffect(() => {
        props.onChange(filesChecked);
    }, [filesChecked])

    return (
        <div className={"container"}>
            <div className={"row"}>
                {
                    files.map((file, idx) => <div key={idx} className={"form-check"}>
                        <input id={"file-picker-checkbox-" + idx}
                               className={"form-check-input"}
                               type={'checkbox'}
                               checked={filesChecked[idx]}
                               onChange={({target}) => {
                                   setFilesChecked(oldValues => {
                                       let newValues = [...oldValues];
                                       newValues[idx] = target.checked;
                                       return newValues;
                                   })
                               }}/>
                        <label className={"form-check-label"}
                               htmlFor={"file-picker-checkbox-" + idx}>
                            {file.name} ({prettyBytes(file.size)})
                        </label>
                    </div>)
                }
            </div>
        </div>
    )
}

export default FileList;
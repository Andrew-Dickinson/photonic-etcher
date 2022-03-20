import React, {useEffect, useState} from "react";


function modifyBounded(current_val, delta, lower_bound, upper_bound, onExport = null){
    let newVal = current_val + delta;
    if (newVal < lower_bound) { newVal = lower_bound; }
    if (newVal > upper_bound) {
        newVal = upper_bound;
        if (onExport) onExport();
    }
    return newVal;
}


function StepWizard(props) {
    let { children } = props;
    const { nav, pageChange, loading, onExport } = props;

    if (!children.length) children = [children];

    const [curPage, setCurPage] = useState(0);


    useEffect(() => {
        if (pageChange) pageChange(curPage);
    }, [curPage])

    const nav_props = {
        prevPage: () => {
            setCurPage((val) => modifyBounded(val, -1, 0, children.length - 1))
        },
        nextPage: () => {
            setCurPage((val) => modifyBounded(val, 1, 0, children.length - 1, onExport))
        },
        allowNext: props.allowNext,
        allowBack: props.allowBack,
        curPage: curPage,
        className: "row footer"
    };

    const child_props = {
        previousStep: () => {
            setCurPage((val) => modifyBounded(val, -1, 0, children.length - 1))
        },
        nextStep: () => {
            setCurPage((val) => modifyBounded(val, 1, 0, children.length - 1))
        }
    };


    return <div className={props.className}>
        {
            children.map((child, i) => {
                let classes = "rows content w-100";

                if (i !== curPage || loading) {
                    classes = "hidden"
                }

                return <div key={i} className={classes}>
                    {React.cloneElement(child, child_props)}
                </div>
            })
        }
        <div className={
            (loading ? "" : "hidden ") +
            "flex justify-content-center h-100 align-items-center"
        }>
            <div className="spinner-border" role="status">
            </div>
            <strong className={"px-3"}>Loading files...</strong>
        </div>
        {nav ? React.cloneElement(nav, nav_props) : ""}
    </div>
}

export default StepWizard;
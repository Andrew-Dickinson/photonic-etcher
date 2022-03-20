import React from "react";
import Button from 'react-bootstrap/Button';

function Nav(props){
    const {prevPage, nextPage, curPage, allowNext, allowBack} = props;
    return <div className={"rows footer button-box p-2"}>
        { curPage === 1 ?
            <div className={"left me-2"}>
                <Button onClick={() => {prevPage()}}
                        disabled={!allowBack}
                        variant={"outline-secondary"}>
                    <span aria-hidden="true">&laquo; </span>
                    Back to Board Preview
                </Button>
            </div>
            :
            ""
        }
        <div className={"spacer"}/>
        <div className={"right ms-2"}>
            <Button onClick={() => {nextPage()}}
                    disabled={!allowNext}
            //         loading || fileList.length === 0 || numChecked === 0 ||
            // (curPage === 1 && numLayersSelected === 0)
            >
                { curPage === 1 ? "Export" : "View Layers"}
                { curPage === 0 ?  <span aria-hidden="true"> &raquo;</span> : ""}
            </Button>
        </div>
    </div>
}

export default Nav;
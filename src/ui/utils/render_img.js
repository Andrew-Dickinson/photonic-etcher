import React from "react";
// import Convert from 'convert-svg-react'


export function SVG(props){
    let width = props.width ? props.width : '500px';
    return <img width={width} src={`data:image/svg+xml;base64,${btoa(props.text)}`} className={props.className}/>
    // return <div dangerouslySetInnerHTML={{__html: props.text}}/>
}

export function PNG(props){
    let width = props.width ? props.width : '500px';
    return <img width={width} src={`data:image/png;base64,${props.text}`} className={props.className}/>
}

export function URLPNG(props){
    let width = props.width ? props.width : '500px';
    return <img width={width} src={props.url} className={props.className}/>
}
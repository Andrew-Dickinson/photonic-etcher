# Photonic Etcher

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

Photonic Etcher is a browser-based tool for converting gerber files into "printable" exposure files for Anycubic Photon SLA 3D printers. This allows you to use your SLA printer to do photo-lithography without the need for transparency sheets or a separate UV light source.

![An animated GIF showing how Photonic Etcher is used](/demo.gif?raw=true)

### Features

- Automatic layer identification & full-board preview (thanks [tracespace](https://github.com/tracespace/tracespace)!)
- Output any gerber layer type
- PCB Preview Rendered into file thumbnail
- Flip output (horizontal and vertical)
- Configurable exposure times per layer
- Invert mask per layer (for photo-positive vs. photo-negative processes)
- Subtract drill layers from output (to see where to manually drill holes)
- Configurable anchor corner and jig offsets (allows repeatable etching for multi-layer processes e.g. copper & solder mask)

### Formats Currently Supported

- AnyCubic Photon Ultra (.dlp)
- AnyCubic Photon M3 (.pm3)
- AnyCubic Photon M3 Max (.pm3m)
- AnyCubic Photon Mono SQ (.pwsq)
- AnyCubic Photon Zero (.pw0)
- AnyCubic Photon Mono 4K (.pwma)
- AnyCubic Photon Mono X 6K & Photon M3 Plus (.pwmb)
- AnyCubic Photon Mono (.pwmo)
- AnyCubic Photon Mono SE (.pwms)
- AnyCubic Photon Mono X (.pwmx)
- AnyCubic Photon & Photon S (.pws)
- AnyCubic Photon (.photon)
- AnyCubic Photon X (.pwx)

If you're interested in support for additional formats, [open an issue](https://github.com/Andrew-Dickinson/photonic-etcher/issues/new), and I'll look into it.

## Get Started

Get started by visiting the hosted site at: https://andrew-dickinson.github.io/photonic-etcher

Also available as an offline application for [Windows, MacOS, and Linux](https://github.com/Andrew-Dickinson/photonic-etcher/releases) as a [neutralino.js](https://neutralino.js.org/) build.

## Built With

- [React](https://reactjs.org/)
- [Bootstrap](https://getbootstrap.com/)
- pcb-stackup & gerber-to-svg ([Tracespace](https://github.com/tracespace/tracespace))
- [svg.js](https://svgjs.dev/)

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Contact

Andrew Dickinson - andrew.dickinson.0216@gmail.com

Project Link: [https://github.com/Andrew-Dickinson/nyct-gtfs](https://github.com/Andrew-Dickinson/photonic-etcher)

## Acknowledgments

- [Choose an Open Source License](https://choosealicense.com)
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
- [Thomas Sanladerer's Video (Inspiration)](https://www.youtube.com/watch?v=RudStbSApdE)
- Icon - Pcb by Hai Studio from [NounProject.com](https://thenounproject.com/icon/pcb-3188305/)

[contributors-shield]: https://img.shields.io/github/contributors/Andrew-Dickinson/photonic-etcher.svg?style=for-the-badge
[contributors-url]: https://github.com/Andrew-Dickinson/photonic-etcher/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/Andrew-Dickinson/photonic-etcher.svg?style=for-the-badge
[forks-url]: https://github.com/Andrew-Dickinson/photonic-etcher/network/members
[stars-shield]: https://img.shields.io/github/stars/Andrew-Dickinson/photonic-etcher.svg?style=for-the-badge
[stars-url]: https://github.com/Andrew-Dickinson/photonic-etcher/stargazers
[issues-shield]: https://img.shields.io/github/issues/Andrew-Dickinson/photonic-etcher.svg?style=for-the-badge
[issues-url]: https://github.com/Andrew-Dickinson/photonic-etcher/issues
[license-shield]: https://img.shields.io/github/license/Andrew-Dickinson/photonic-etcher.svg?style=for-the-badge
[license-url]: https://github.com/Andrew-Dickinson/photonic-etcher/blob/master/LICENSE.txt

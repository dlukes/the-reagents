# Palimptastic

This is an app prototype developed during the 2019 Hands:On Hackathon in
Cambridge by team Reagents. Its intended use is as an interactive kiosk
at the upcoming palimpsest exhibition at the Cambridge University
Library.

# Instructions

Clone the repository and then:

```sh
# install dependencies
npm install
# run the development server
npm start
# build a static version of the app under dist/
npm run build
```

Note that the manuscript images are loaded as IIIF tiles from
<https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/>, so if
that server is not running, the app won't show anything interesting.

# License

All content is &copy; 2019 by Melonie Schmierer-Lee, Petra Mijanović,
Rebeka Laučíková and David Lukeš, with contributions by Chris Sparks.
Thank you to all the testers (designated or impromptu) for taking the
time to provide valuable feedback!

The code is provided under the terms of the [2-Clause BSD
license](https://opensource.org/licenses/bsd-license.php).

Non-code content is provided under the terms of the [Creative Commons
Attribution 4.0 International (CC BY
4.0)](https://creativecommons.org/licenses/by/4.0/).

The `coffe-stain.png` asset is off the internet somewhere and you should
probably get a different one if you're worried about being in the clear
legally speaking :)

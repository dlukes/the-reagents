// import bootstrap from "bootstrap";
import $ from "jquery";
import "bootstrap/dist/css/bootstrap.css";

import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import IIIF from "ol/source/IIIF";
import IIIFInfo from "ol/format/IIIFInfo";
import RasterSource from "ol/source/Raster";
import ImageLayer from "ol/layer/Image";

import "./index.css";

const info1 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_PSC/info.json";
const info2 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_KTK_triple/info.json";

const container = document.getElementById("map");
const contrast = document.getElementById("contrast");
const contrastOut = document.getElementById("contrast-out");
const opacity = document.getElementById("opacity");
const opacityOut = document.getElementById("opacity-out");

map = new Map({
  target: container
});

const radius = 70;

// get the pixel position with every move
let mousePosition = null;
container.addEventListener("mousemove", function (event) {
  mousePosition = map.getEventPixel(event);
  map.render();
});
container.addEventListener("mouseout", function () {
  mousePosition = null;
  map.render();
});

async function createImageLayer(iiifInfoUrl, map) {
  const response = await fetch(iiifInfoUrl);
  const iiifInfo = await response.json();
  const options = new IIIFInfo(iiifInfo).getTileSourceOptions();
  options.zdirection = -1;
  options.crossOrigin = "anonymous";

  const iiif = new IIIF(options);
  const tiles = new TileLayer({ source: iiif });
  const raster = new RasterSource({
    sources: [tiles],
    operation: function (pixels_1, data) {
      const contrast = data.contrast || 0;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < 3; i++) {
        const ans = factor * (pixels_1[0][i] - 128) + 128;
        if (ans < 0) {
          pixels_1[0][i] = 0;
        }
        else if (ans > 255) {
          pixels_1[0][i] = 255;
        }
        else {
          pixels_1[0][i] = ans;
        }
      }
      ;
      return pixels_1[0];
    }
  });
  const image = new ImageLayer({ source: raster });

  map.addLayer(image);
  map.setView(new View({
    resolutions: iiif.getTileGrid().getResolutions(),
    extent: iiif.getTileGrid().getExtent(),
    constrainOnlyCenter: true
  }));
  map.getView().fit(iiif.getTileGrid().getExtent());

  return { iiif, raster, image };
}

(async () => {
  const { image: image1 } = await createImageLayer(info1, map);
  const { raster: raster2, image: image2 } = await createImageLayer(info2, map);

  // hook up input events to the "map"
  contrast.addEventListener("input", () => raster2.changed());
  opacity.addEventListener("input", () => map.render());

  // dynamically set the contrast value
  raster2.on("beforeoperations", (event) => {
    // this is where you can pass data into the pixel operation
    const contrastVal = parseInt(contrast.value);
    contrastOut.innerText = contrastVal;
    const data = event.data;
    data.contrast = contrastVal;
  });

  // before rendering the layer, do some clipping / or adjust opacity
  image2.on("prerender", function (event) {
    var ctx = event.context;
    var pixelRatio = event.frameState.pixelRatio;
    ctx.save();
    ctx.beginPath();
    if (mousePosition) {
      image1.setOpacity(1);
      image2.setOpacity(1);
      // only show a circle around the mouse
      ctx.arc(mousePosition[0] * pixelRatio, mousePosition[1] * pixelRatio, radius * pixelRatio, 0, 2 * Math.PI);
      ctx.lineWidth = 5 * pixelRatio;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.stroke();
      ctx.clip();
    } else {
      // check opacity slider and do some blending based on that
      // the opacity slider should probably continuously fade in the multi-spectrum
      // image while continuously fading out the original one
      const opacityVal = parseInt(opacity.value);
      image1.setOpacity(1 - opacityVal / 100);
      image2.setOpacity(opacityVal / 100);
      opacityOut.innerText = `${100 - opacityVal}/${opacityVal}`;
    }
  });

  // after rendering the layer, restore the canvas context
  image2.on("postrender", function (event) {
    const ctx = event.context;
    ctx.restore();
  });

})();

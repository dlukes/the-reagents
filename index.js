import $ from "jquery";
import popper from "popper.js";
import bootstrap from "bootstrap";
import noUiSlider from "nouislider";
import "nouislider/distribute/nouislider.css";
import "bootstrap/dist/css/bootstrap.css";
import "@fortawesome/fontawesome-free/css/all.css";

import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import IIIF from "ol/source/IIIF";
import IIIFInfo from "ol/format/IIIFInfo";
import RasterSource from "ol/source/Raster";
import ImageLayer from "ol/layer/Image";
import Static from "ol/source/ImageStatic.js";
import Overlay from "ol/Overlay";

import "./index.css";

const info1 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_PSC/info.json";
const info2 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_KTK_triple/info.json";

const container = document.getElementById("map");
const intensity = document.getElementById("intensity");
const contrast = document.getElementById("contrast");
const split = document.getElementById("split");
const reset = document.getElementById("reset");
const coffee = document.getElementById("coffee");

noUiSlider.create(intensity, {
  start: 30,
  connect: "lower",
  range: {
    "min": 30,
    "max": 100,
  }
});
noUiSlider.create(contrast, {
  start: 0,
  connect: "lower",
  range: {
    "min": -150,
    "max": 255,
  }
});
noUiSlider.create(split, {
  start: 50,
  connect: "lower",
  range: {
    "min": 0,
    "max": 100,
  }
});

const $info = $("#info");
const $done = $("#done");
const $sun = $("#sun");
const $flask = $("#flask");
const $coffee = $("#coffee");

map = new Map({
  target: container,
  controls: [],
});

function initializeOverlay(map, id, positioning, x, y) {
  const overlay = new Overlay({
    element: document.getElementById(id),
    positioning,
  });
  overlay.setPosition([x, y]);
  map.addOverlay(overlay);
}

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

  const iiifExtent = iiif.getTileGrid().getExtent();
  map.addLayer(image);
  map.setView(new View({
    resolutions: iiif.getTileGrid().getResolutions(),
    extent: iiifExtent,
    constrainOnlyCenter: true
  }));
  map.getView().fit(iiifExtent);
  const midX = iiifExtent[2] / 2,
    midY = iiifExtent[1] / 2;
  initializeOverlay(map, "left-overlay", "center-right", midX - 150, midY);
  initializeOverlay(map, "right-overlay", "center-left", midX + 150, midY);

  return { iiif, raster, image };
}

function createCoffeeLayer() {
  const coffeeWidth = 555,
    coffeeHeight = 472,
    coffeeLeft = 1000,
    coffeeBottom = -4000,
    scale = 4,
    coffeeRight = coffeeLeft + coffeeWidth * scale,
    coffeeTop = coffeeBottom + coffeeHeight * scale;
  const coffee = new ImageLayer({
    source: new Static({
      url: require("./images/coffee-stain.png"),
      imageExtent: [coffeeLeft, coffeeBottom, coffeeRight, coffeeTop],
    }),
    zindex: 10
  });
  map.addLayer(coffee);
  coffee.setVisible(false);
  // coffee.on("prerender", (event) => {
  //   event.context.globalCompositeOperation = "color-burn";
  // })
  return coffee;
}

(async () => {
  await createImageLayer(info1, map);
  const { raster, image } = await createImageLayer(info2, map);
  const coffeeLayer = createCoffeeLayer();

  // hook up input events to the "map"
  contrast.noUiSlider.on("update", () => raster.changed());
  intensity.noUiSlider.on("update", () => map.render());
  split.noUiSlider.on("update", () => map.render());
  coffee.addEventListener("click", () => {
    coffeeLayer.setVisible(true)
  });
  // TODO: reset should probably also reset the sliders...?
  reset.addEventListener("click", () => {
    coffeeLayer.setVisible(false);
  });

  // dynamically set the contrast value
  raster.on("beforeoperations", (event) => {
    // this is where you can pass data into the pixel operation
    const contrastVal = parseInt(contrast.noUiSlider.get());
    const data = event.data;
    data.contrast = contrastVal;
  });

  // before rendering the layer...
  image.on("prerender", function (event) {
    // ... adjust opacity...
    const opacityVal = parseInt(intensity.noUiSlider.get());
    image.setOpacity(opacityVal / 100);

    // ... and perform the splitscreen clipping
    const ctx = event.context;
    const pixelRatio = event.frameState.pixelRatio;
    const splitVal = parseInt(split.noUiSlider.get());
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width * splitVal / 100, ctx.canvas.height);
    ctx.lineWidth = 5 * pixelRatio;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
    ctx.clip();
  });

  // after rendering the layer, restore the canvas context
  image.on("postrender", function (event) {
    const ctx = event.context;
    ctx.restore();
  });

  map.render()
})();

$(".tour").popover({
  trigger: "manual",
});
$info.on("click", () => $info.popover("toggle"));
const tour = [
  [
    () => {
      $info.popover("show");
      $done.addClass("hi");
    },
    () => {
      $info.popover("hide");
      $done.removeClass("hi");
    }
  ],
  [
    () => {
      $sun.popover("show");
      $sun.addClass("hi");
    },
    () => {
      $sun.popover("hide");
      $sun.removeClass("hi");
    }
  ],
  [
    () => {
      $coffee.popover("show");
      $coffee.addClass("hi");
    },
    () => {
      $coffee.popover("hide");
      $coffee.removeClass("hi");
    }
  ],
  [
    () => {
      $flask.popover("show");
      $flask.addClass("hi");
    },
    () => {
      $flask.popover("hide");
      $flask.removeClass("hi");
    }
  ],
]

function tourNext() {
  if (!tour.length) {
    return;
  };
  const [before, after] = tour.shift();
  before();
  setTimeout(() => {
    after();
    setTimeout(tourNext, 10000);
  }, 5000);
}

const tourTriggers = "click touchend wheel";
function startTour() {
  $(document).off(tourTriggers, startTour);
  map.getOverlays().clear();
  tourNext();
}
$(document).on(tourTriggers, startTour);

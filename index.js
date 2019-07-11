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

// ---------------------------------------- UI elements ----------------------------------------

const container = document.getElementById("map");
const intensity = document.getElementById("intensity");
const contrast = document.getElementById("contrast");
const split = document.getElementById("split");

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
const $reset = $("#reset");
const $sun = $("#sun");
const $flask = $("#flask");
const $coffee = $("#coffee");

// ---------------------------------------- "Map" (= manuscript) and layer helpers ----------------------------------------

map = new Map({
  target: container,
  controls: [],
});
let baseZoom, baseCenter, baseRotation;
let maxXCoord, maxYCoord;
let exposedToSun = false,
  exposedToReagent = false;
const info1 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_PSC/info.json";
const info2 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_KTK_triple/info.json";

function initializeOverlay(map, id, positioning, x, y) {
  const overlay = new Overlay({
    element: document.getElementById(id),
    positioning,
  });
  overlay.setPosition([x, y]);
  map.addOverlay(overlay);
}

async function createManuscriptLayer(iiifInfoUrl, map, useRaster) {
  const response = await fetch(iiifInfoUrl);
  const iiifInfo = await response.json();
  const options = new IIIFInfo(iiifInfo).getTileSourceOptions();
  options.zdirection = -1;
  options.crossOrigin = "anonymous";

  const iiif = new IIIF(options);
  // TODO get rid of preload, it doesn't seem to be doing anything
  // const tiles = new TileLayer({ source: iiif, preload: Infinity });
  const tiles = new TileLayer({ source: iiif });
  let raster, image;
  if (useRaster) {
    raster = new RasterSource({
      sources: [tiles],
      operation: function (pixels, data) {
        const contrast = data.contrast || 0;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        for (let i = 0; i < 3; i++) {
          const ans = factor * (pixels[0][i] - 128) + 128;
          if (ans < 0) {
            pixels[0][i] = 0;
          }
          else if (ans > 255) {
            pixels[0][i] = 255;
          }
          else {
            pixels[0][i] = ans;
          }
        }
        return pixels[0];
      },
    });
    image = new ImageLayer({ source: raster });
  }

  const iiifExtent = iiif.getTileGrid().getExtent();
  map.addLayer(useRaster ? image : tiles);
  map.setView(new View({
    resolutions: iiif.getTileGrid().getResolutions(),
    extent: iiifExtent,
    constrainOnlyCenter: true
  }));
  map.getView().fit(iiifExtent);
  maxYCoord = iiifExtent[1];
  maxXCoord = iiifExtent[2];
  const midX = maxXCoord / 2,
    midY = maxYCoord / 2;
  initializeOverlay(map, "left-overlay", "center-right", midX - 150, midY);
  initializeOverlay(map, "right-overlay", "center-left", midX + 150, midY);

  const view = map.getView();
  baseCenter = view.getCenter();
  baseZoom = view.getZoom();
  baseRotation = view.getRotation();

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
    zindex: 10,
    opacity: 0,
  });
  map.addLayer(coffee);
  return coffee;
}

function createExposureRect(fillStyle, ctx, pixelRatio) {
  const [xStart, yStart] = map.getPixelFromCoordinate([0, 0]).map(x => x * pixelRatio);
  const [xEnd, yEnd] = map.getPixelFromCoordinate([maxXCoord, maxYCoord]).map(x => x * pixelRatio);
  ctx.fillStyle = fillStyle;
  ctx.fillRect(xStart, yStart, xEnd - xStart, yEnd - yStart);
}

// ---------------------------------------- Create layers ----------------------------------------
//
// NOTE: Some of these functions have an async API, so it's all wrapped in an
// async IIFE.

(async () => {
  await createManuscriptLayer(info1, map, false);
  const { raster, image } = await createManuscriptLayer(info2, map, true);
  const coffeeLayer = createCoffeeLayer();

  // hook up input events to the "map"
  contrast.noUiSlider.on("update", () => raster.changed());
  intensity.noUiSlider.on("update", () => map.render());
  split.noUiSlider.on("update", () => map.render());
  $reset.click(() => {
    map.getView().animate(
      { zoom: baseZoom, center: baseCenter, rotation: baseRotation, duration: 500 },
      hideTour
    );
    coffeeLayer.setOpacity(0);
    exposedToSun = false;
    exposedToReagent = false;
  });
  $sun.click(() => {
    const view = map.getView();
    const zoom = view.getZoom();
    view.animate(
      { zoom: zoom + 1 },
      { zoom },
      () => {
        exposedToSun = true;
        map.render();
        setTimeout(() => {
          $("#sun-modal").modal("show");
          hideTour();
        }, 1000);
      },
    );
  });
  $flask.click(() => {
    const view = map.getView();
    const rotation = view.getRotation();
    const duration = 200;
    view.animate(
      { rotation: rotation + Math.PI, duration },
      { rotation: rotation + 2 * Math.PI, duration },
      { rotation: rotation + Math.PI, duration },
      { rotation: rotation + 2 * Math.PI, duration },
      { rotation: rotation + Math.PI, duration },
      { rotation: rotation + 2 * Math.PI, duration },
      { rotation: rotation + Math.PI, duration },
      { rotation: rotation + 2 * Math.PI, duration },
      () => {
        exposedToReagent = true;
        map.render();
        setTimeout(() => {
          $("#flask-modal").modal("show");
          hideTour();
        }, 1000);
      },
    );
  });
  $coffee.click(() => {
    const duration = 200;
    map.getView().animate(
      { zoom: baseZoom, center: baseCenter, rotation: baseRotation, duration },
      { zoom: baseZoom, duration },
      { zoom: baseZoom + 1, duration },
      { zoom: baseZoom, duration },
      { zoom: baseZoom + 1, duration },
      { zoom: baseZoom, duration },
      { zoom: baseZoom + 1, duration },
      { zoom: baseZoom, duration },
      () => {
        coffeeLayer.setOpacity(1);
        setTimeout(() => {
          $("#coffee-modal").modal("show");
          hideTour();
        }, 1000);
      },
    );
  });

  // dynamically set the contrast value
  raster.on("beforeoperations", (event) => {
    // this is where you can pass data into the pixel operation
    const contrastVal = parseInt(contrast.noUiSlider.get());
    const data = event.data;
    data.contrast = contrastVal;
  });

  // before rendering the layer
  image.on("prerender", (event) => {
    const ctx = event.context;
    const pixelRatio = event.frameState.pixelRatio;

    if (exposedToReagent) {
      // if a reagent has been applied, "darken" the manuscript
      createExposureRect("rgba(0, 0, 0, .9)", ctx, pixelRatio);
    } else if (exposedToSun) {
      // else if sunlight has been applied, "fade" the manuscript
      createExposureRect("rgba(255, 255, 255, .7)", ctx, pixelRatio);
    }

    // adjust opacity
    const opacityVal = parseInt(intensity.noUiSlider.get());
    image.setOpacity(opacityVal / 100);

    // perform the splitscreen clipping
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
  image.on("postrender", (event) => {
    const ctx = event.context;
    ctx.restore();
  });

  map.render()
})();

// ---------------------------------------- Tour ----------------------------------------

$(".tour").popover({
  trigger: "manual",
});
$info.on("click", () => {
  $info.popover("toggle");
  $done.toggleClass("hi");
});
const tour = [
  [$info, $done],
  [$sun, $sun],
  [$coffee, $coffee],
  [$flask, $flask],
];

function hideTour() {
  $(".tour").popover("hide");
  $(".hi").removeClass("hi");
}

function tourNext() {
  if (!tour.length) {
    return;
  }
  const [$popover, $hi] = tour.shift();
  $popover.popover("show");
  $hi.addClass("hi");
  let firstCall = true;
  const destroy = () => {
    if (firstCall) {
      $popover.off("click", destroy);
      $hi.off("click", destroy);
      $popover.popover("hide");
      $hi.removeClass("hi");
      // TODO: adjust or get rid of timeout for the demo
      setTimeout(() => {
        tourNext()
      }, 10000);
      firstCall = false;
    }
  }
  $popover.click(destroy);
  $hi.click(destroy);
}

const tourTriggers = "click touchend wheel";
function startTour() {
  $(document).off(tourTriggers, startTour);
  map.getOverlays().clear();
  tourNext();
}
$(document).on(tourTriggers, startTour);

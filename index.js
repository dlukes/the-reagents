import $ from "jquery";
import popper from "popper.js";
import bootstrap from "bootstrap";
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

import "./index.css";

const info1 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_PSC/info.json";
const info2 = "https://cdhlab-dev.lib.cam.ac.uk/handson/digilib/Scaler/IIIF/Codex_Zacynthius!Zacy_separate_images!00019-V_KTK_triple/info.json";

const container = document.getElementById("map");
const contrast = document.getElementById("contrast");
const intensity = document.getElementById("intensity");
const split = document.getElementById("split");
const info = document.getElementById("info");
const reset = document.getElementById("reset");
const coffee = document.getElementById("coffee");

const $info = $("#info");
const $done = $("#done");
const $reset = $("#reset");
const $sun = $("#sun");
const $flask = $("#flask");
const $coffee = $("#coffee");

const map = new Map({
  target: container,
  controls: [],
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
      // attributions: "© <a href="http://xkcd.com/license.html">xkcd</a>",
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
  contrast.addEventListener("input", () => raster.changed());
  intensity.addEventListener("input", () => map.render());
  split.addEventListener("input", () => map.render());
  coffee.addEventListener("click", () => {
    // $("#coffee")
    //   .animate({ "left": (-10) + "px" }, 200)
    //   .animate({ "left": (+20) + "px" }, 200)
    //   .animate({ "left": (-10) + "px" }, 200);
    coffeeLayer.setVisible(true)
  });
  // TODO: reset should probably also reset the sliders...?
  reset.addEventListener("click", () => {
    // $("#reset")
    //   .animate({ "left": (-100) + "px" }, 200)
    //   .animate({ "left": (+200) + "px" }, 200)
    //   .animate({ "left": (-100) + "px" }, 200);
    coffeeLayer.setVisible(false);
  });

  // dynamically set the contrast value
  raster.on("beforeoperations", (event) => {
    // this is where you can pass data into the pixel operation
    const contrastVal = parseInt(contrast.value);
    const data = event.data;
    data.contrast = contrastVal;
  });

  // before rendering the layer, do some clipping and adjust opacity
  image.on("prerender", function (event) {
    const opacityVal = parseInt(intensity.value);
    // image1.setOpacity(1 - opacityVal / 100);
    image.setOpacity(opacityVal / 100);

    const ctx = event.context;
    const pixelRatio = event.frameState.pixelRatio;
    const splitVal = parseInt(split.value);
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

const msgs = [
  {
    msg: "Looks like you’re trying to read a palimpsest!",
  },
  {
    msg: "Psst… pinch to zoom, rotate with three fingers.",
  },
  {
    msg: "When you’ve finished, you can keep your image!",
    call: () => $done.addClass("hi"),
  },
  {
    msg: "Earlier scholars found sunlight useful.",
    call: () => $sun.addClass("hi"),
  },
  {
    msg: "This may take some time… would you like some coffee while you work?",
    call: () => $coffee.addClass("hi"),
  },
  {
    msg: "Have you considered applying a chemical reagent?",
    call: () => $flask.addClass("hi"),
  },
  {
    msg: "Hope you had fun exploring this page from the Codex Zacynthius!"
  },
];

let { msg, timeout, call } = msgs.shift();
$info.popover({ content: msg, trigger: "manual" });
$info.on("shown.bs.popover", (event) => {
  event.target.classList.remove("fa-info");
  event.target.classList.add("fa-times");
  if (typeof call !== "undefined") {
    call();
  };
  if (msgs.length) {
    const msgObj = msgs.shift();
    msg = msgObj.msg;
    timeout = msgObj.timeout;
    call = msgObj.call;
    // TODO: set a reasonable default timeout here and/or custom timeouts for
    // the individual messages in the msgs array above.
    timeout = timeout || 5000;
  };
});
$info.on("hidden.bs.popover", (event) => {
  event.target.classList.remove("fa-times");
  event.target.classList.add("fa-info");
  $(".hi").removeClass("hi");
  $info.attr("data-content", msg);
  if (msgs.length) {
    const timer = setTimeout(() => {
      $info.popover("show");
      clearTimeout(timer);
    }, timeout);
  };
});

// TODO: change click → touchend for running on iPad
// Handling this in a robust way is surprisingly hard:
// https://stackoverflow.com/questions/25572070/javascript-touchend-versus-click-dilemma
// In particular, adding two event listeners for both click and touchend ends
// up firing the callback twice on devices which trigger both events.
const startTourEventType = "touchend";
function startTour() {
  $info.popover("show");
  document.removeEventListener(startTourEventType, startTour);
  info.addEventListener("click", () => $info.popover("toggle"));
}
document.addEventListener(startTourEventType, startTour);

// TODO: rework this entire message thing so that messages reliably don't get lost

export function initDistanceMeasure(ctx) {
  const { map } = ctx;

  let measureSource = new ol.source.Vector();
  let measureLayer = new ol.layer.Vector({
    source: measureSource
  });
  map.addLayer(measureLayer);

  const finalMeasureStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: 'orange',
      width: 4
    })
  });


  let measureDraw;
  let measureCoords = [];
  let totalDistance = 0;
  let isMeasuring = false;

  // ======================
  // 計測開始
  // ======================
  document.getElementById("btnMeasureStart").addEventListener("click", () => {

    clearMeasure();

    isMeasuring = true;
    measureCoords = [];
    totalDistance = 0;

    measureDraw = new ol.interaction.Draw({
      source: measureSource,
      type: "LineString"
    });

    map.addInteraction(measureDraw);
  });

  // ======================
  // クリック処理
  // ======================
  map.on("singleclick", async function (evt) {
    if (!isMeasuring) return;

    const coord = evt.coordinate;

    if (measureCoords.length > 0) {

      const prevCoord = measureCoords[measureCoords.length - 1];
      const line = new ol.geom.LineString([prevCoord, coord]);
      const distance = ol.sphere.getLength(line);

      totalDistance += distance;

      const name = await getDisplayName(coord);

      addMeasureRow(name, distance);

      document.getElementById("measureTotal").innerText =
        (totalDistance / 1000).toFixed(2) + " km";
    }

    measureCoords.push(coord);
  });

  // ======================
  // ダブルクリック終了
  // ======================
  map.on("dblclick", function (evt) {

    if (!isMeasuring) return;

    evt.preventDefault();

    isMeasuring = false;
    map.removeInteraction(measureDraw);

    // 最後に描かれた線を取得
    const features = measureSource.getFeatures();
    const lastFeature = features[features.length - 1];

    if (lastFeature) {
      lastFeature.setStyle(finalMeasureStyle);
    }
  });


  // ======================
  // 右クリックUndo
  // ======================
  map.getViewport().addEventListener("contextmenu", (e) => {
    e.preventDefault();

    if (!isMeasuring || measureCoords.length === 0) return;

    measureDraw.removeLastPoint();
    measureCoords.pop();
  });

  // ======================
  // 住所取得
  // ======================
//  async function getAddressFromCoord(coord) {
//
//    const lonlat = ol.proj.toLonLat(coord);
//    const lat = lonlat[1];
//    const lon = lonlat[0];
//
//    const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`;
//
//    try {
//      const res = await fetch(url);
//      const data = await res.json();
//
//      if (data.results) {
//        return data.results.lv01Nm;
//      }
//    } catch (err) {
//      console.error(err);
//    }
//
//    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
//  }
//
//  async function getDisplayName(coord) {
//
//    let name = "";
//
//    map.forEachFeatureAtPixel(
//      map.getPixelFromCoordinate(coord),
//      (feature) => {
//        name =
//          feature.get("name") ||
//          feature.get("名称") ||
//          "";
//      }
//    );
//
//    if (name) return name;
//
//    return await getAddressFromCoord(coord);
//  }

  function addMeasureRow(name, distance) {
//    const tbody = document.getElementById("measureList");
//
//    const tr = document.createElement("tr");
//
//    tr.innerHTML = `
//      <td>${name}</td>
//      <td>${(distance / 1000).toFixed(2)} km</td>
//    `;
//
//    tbody.appendChild(tr);
  }

  // ======================
  // クリア
  // ======================
  document.getElementById("btnMeasureClear").addEventListener("click", clearMeasure);

  function clearMeasure() {
    measureSource.clear();
    document.getElementById("measureList").innerHTML = "";
    document.getElementById("measureTotal").innerText = "0 km";
    totalDistance = 0;
    measureCoords = [];
    isMeasuring = false;

    if (measureDraw) {
      map.removeInteraction(measureDraw);
    }
  }
}

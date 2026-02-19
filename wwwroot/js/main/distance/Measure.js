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

  // ヘルパ：Featureから距離を計算して表示
  function updateTotalFromGeometry(geom) {
    if (!geom) return;
    // LineString 全長を計算
    const length = ol.sphere.getLength(geom) || 0;
    totalDistance = length;
    document.getElementById("measureTotal").innerText =
      (totalDistance / 1000).toFixed(2) + " km";
  }

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

    // drawend: ダブルクリック等で描画終了したときに最終結果を確定する
    measureDraw.on('drawend', (evt) => {
      const feature = evt.feature;
      const geom = feature.getGeometry();
      updateTotalFromGeometry(geom);
      feature.setStyle(finalMeasureStyle);
      // 座標を保持しておく
      measureCoords = geom.getCoordinates ? geom.getCoordinates() : [];
      // 描画終了後は計測状態を解除してインタラクションを外す
      isMeasuring = false;
      if (measureDraw) {
        map.removeInteraction(measureDraw);
        measureDraw = null;
      }
    });

    console.log("BTN Click! -----");
    map.addInteraction(measureDraw);
  });

  // ======================
  // クリック処理
  // ======================
  map.on("singleclick", async function (evt) {
    if (!isMeasuring) return;
    console.log("singleclick! -----");

    const coord = evt.coordinate;

    // 前点が無ければ距離計算をせずに最初の点として追加する
    if (measureCoords.length === 0) {
      measureCoords.push(coord);
      document.getElementById("measureTotal").innerText =
        (totalDistance / 1000).toFixed(2) + " km";
      return;
    }

    const prevCoord = measureCoords[measureCoords.length - 1];
    if (!prevCoord || !Array.isArray(prevCoord) || prevCoord.length !== 2) {
      // 安全策：prevCoord が正しい座標でないときは追加のみ
      measureCoords.push(coord);
      return;
    }

    const line = new ol.geom.LineString([prevCoord, coord]);
    const distance = ol.sphere.getLength(line) || 0;

    totalDistance += distance;

    document.getElementById("measureTotal").innerText =
      (totalDistance / 1000).toFixed(2) + " km";

    measureCoords.push(coord);
  });

  // ======================
  // ダブルクリック終了
  // ======================
  map.on("dblclick", function (evt) {
    console.log("dbclick! -----");

    if (!isMeasuring) return;

    evt.preventDefault();

    isMeasuring = false;
    // drawend ハンドラで既に remove されている可能性があるのでガード
    if (measureDraw) {
      map.removeInteraction(measureDraw);
      measureDraw = null;
    }

    // 最後に描かれた線を取得してスタイルを設定（保険）
    const features = measureSource.getFeatures();
    const lastFeature = features[features.length - 1];

    if (lastFeature) {
      lastFeature.setStyle(finalMeasureStyle);
      // 最終フィーチャから改めて合計を計算して表示（drawend が動作しない環境向けの保険）
      updateTotalFromGeometry(lastFeature.getGeometry());
      measureCoords = lastFeature.getGeometry().getCoordinates ? lastFeature.getGeometry().getCoordinates() : [];
    }
  });


  // ======================
  // 右クリックUndo
  // ======================
  map.getViewport().addEventListener("contextmenu", (e) => {
    console.log("Undo!  -----");
    e.preventDefault();

    if (!isMeasuring || measureCoords.length === 0) return;

    measureDraw.removeLastPoint();
    measureCoords.pop();
  });

  // ======================
  // クリア
  // ======================
  document.getElementById("btnMeasureClear").addEventListener("click", clearMeasure);

  function clearMeasure() {
    measureSource.clear();
    document.getElementById("measureTotal").innerText = "0 km";
    totalDistance = 0;
    measureCoords = [];
    isMeasuring = false;

    if (measureDraw) {
      map.removeInteraction(measureDraw);
      measureDraw = null;
    }
  }
}

export function leftMenuManager(ctx) {
  const {
    base_url,
    threadId,
    map,
    layer調査地点,
    layer調査ルート,
  } = ctx;

  // ---------------------------------------------------------------------------------
  // 
  function initialize() {

  }

  // ====================================================================
  // リアルタイム情報表示
  // ====================================================================
  function init市区町村震度Layer() {
    const left市区町村震度Element = document.getElementById('left市区町村震度');
    // レイヤ作成
    const layer市区町村震度 = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: (feature, resolution) => {
        const rgb = feature.get('rgb');
        return new ol.style.Style({
          fill: new ol.style.Fill({ color: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.6)` }),
          stroke: new ol.style.Stroke({ color: '#00008888', width: 1 }),
        });
      },
    });
    map.addLayer(layer市区町村震度);
    // EventStreamで更新情報を受け取り
    const realtimeEventSource = new EventSource(base_url + '?Handler=RealTimeInfoStream&id=' + threadId);
    realtimeEventSource.onmessage = (e) => {
      const json = JSON.parse(e.data);
      // html表示内容を差し替え
      left市区町村震度Element.innerHTML = !json.earthquaks.length
        ? `<div>　直近の地震情報がありません。</div>`
        : json.earthquaks.map((item) => {
          // （現在選択中なら選択中状態を維持）
          const oldChecked = !!left市区町村震度Element.querySelector(`input[type="checkbox"][name="quake"][value="${item.id}"]:checked`);
          return `<div><label class="form-check">`
            + `<input class="form-check-input" type="checkbox" name="quake" value="${item.id}" ${oldChecked ? ' checked' : ''}>`
            + ` <span class="form-check-label">${item.text}</span>`
            + `</label></div>`;
        }).join('');
      // チェック状態変更時にタイル読み込み
      left市区町村震度Element.querySelectorAll(`input[type="checkbox"][name="quake"]`).forEach((chk) => {
        chk.addEventListener('change', (e) => {
          let sourceUrl = BASE_URL + 'api/mapdata/EarthquakePolygon?'
            + Array.from(left市区町村震度Element.querySelectorAll(`input[type="checkbox"][name="quake"]:checked`)).map((chk) => `quake=${chk.value}`).join('&');
          layer市区町村震度.setSource(new ol.source.Vector({ url: sourceUrl, format: new ol.format.GeoJSON() }));
        });
      });
    };
  }

  // ====================================================================
  // 事前情報表示
  // ====================================================================
  function init事前情報Layers() {
    const left事前情報Element = document.getElementById('left事前情報');
    left事前情報Element.querySelectorAll(`input[type="checkbox"][data-geojsonurl]`).forEach((chk) => {
      // レイヤ作成
      const infoType = chk.value;
      const style = (infoType == 'heliport')
        ? new ol.style.Style({
          text: new ol.style.Text({
            font: 'bold 18px bootstrap-icons',
            text: '\uF7FB',
            fill: new ol.style.Fill({ color: '#00F' }),
            stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
          })
        })
        : new ol.style.Style({
          text: new ol.style.Text({
            font: 'bold 18px bootstrap-icons',
            text: '\uF627',
            fill: new ol.style.Fill({ color: '#800' }),
            stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
          })
        });
      const layer事前情報 = new ol.layer.Vector({
        source: new ol.source.Vector({ url: chk.dataset.geojsonurl, format: new ol.format.GeoJSON() }),
        style: style,
        visible: false,
      });
      map.addLayer(layer事前情報);
      // チェック状態変更時に表示ON/Off切り替え
      chk.addEventListener('change', (e) => {
        layer事前情報.setVisible(chk.checked);
      });
    });
  }

  // --------------------------------------------------------------------
  // 調査ルート（予定）吹き出しメニュー　イベント
  document.querySelectorAll('.dropdown-item').forEach((b) => {
    b.addEventListener("click", function (e) {
      const kmlBtn = e.target.closest(".btnKml");
      // ------------------------
      // KML出力
      if (kmlBtn) {
        const id = kmlBtn.dataset.id;
        const name = kmlBtn.dataset.name;
        console.log("KML OK!!:");
        showKmlModal(name, id);
      }
      // ------------------------
      // 差し戻し
      const modBtn = e.target.closest(".btn差戻");
      if (modBtn) {
        const id = modBtn.dataset.id;
        const name = modBtn.dataset.name;
        showSendBackModal(name, id);
      }
    });
  });
  // --------------------------------------------------------------------
  // 調査ルート（予定）吹き出し KML出力 確認モーダル
  const modalKPElement = document.getElementById("modalKPDownloadConfirm");
  const modalKP = new bootstrap.Modal(modalKPElement);
  // 表示関数
  function showKmlModal(name, id) {
    // 名前表示
    document.getElementById("kmlName").textContent = name;
    // OKボタンにID保持
    const okBtn = document.getElementById("btnKMLOK");
    okBtn.dataset.id = id;
    modalKP.show();
  }
  // 非表示
  function hideKmlModal() {
    modalKP.hide();
  }
  document.getElementById("btnKMLOK").addEventListener("click", function () {
    const id = this.dataset.id;
    ajaxGetJson(base_url + '?Handler=Features&yotei=' + id)
      .then((json) => {
        downloadGeoJsonAsKml(json);
      }, showAlert);
    modalKP.hide();
  });
  document.getElementById("btnKMLCancel").addEventListener("click", function () {
    modalKP.hide();
  });
  // --------------------------------------------------------------------
  // 調査ルート（予定）吹き出し 差し戻し 確認モーダル
  const modalSendElement = document.getElementById("modalSendBackConfirm");
  const modalSend = new bootstrap.Modal(modalSendElement);
  // 表示関数
  function showSendBackModal(name, id) {
    // 名前表示
    document.getElementById("SendBackName").textContent = name;
    // OKボタンにID保持
    const okBtn = document.getElementById("btnSendOK");
    okBtn.dataset.id = id;
    modalSend.show();
  }
  // OKボタンイベント
  document.getElementById("btnSendOK").addEventListener("click", function () {
    const name = document.getElementById("SendBackName").textContent;
    const id = this.dataset.id;
    console.log("差し戻し実行:", id);
    ajaxExecute(base_url + '?Handler=UpdateStatus&id=' + id,
      {}, {}
    )
      .then((json) => {
        console.log(json);
        console.log("OK!!:", json.id);
        modalSend.hide();
        showSendBackDoneModal(name, id);
      }).catch((err) => {
        console.warn('差し戻し失敗', err);
      });
  });
  // キャンセルボタンクリック
  document.getElementById("btnSendCancel").addEventListener("click", function () {
    modalSend.hide();
  });
  // --------------------------------------------------------------------
  // 調査ルート（予定）吹き出し 差し戻し完了モーダル
  const modalSendDoneElement = document.getElementById("modalSendBackDone");
  const modalSendDone = new bootstrap.Modal(modalSendDoneElement);
  // ダイアログ表示
  function showSendBackDoneModal(name, id) {
    // 名前表示
    document.getElementById("SendBackDoneName").textContent = name;
    modalSendDone.show();
  }
  // 閉じるボタンクリック
  document.getElementById("btnSendDoneCancel").addEventListener("click", function () {
    modalSendDone.hide();
  });

  // --------------------------------------------------------------------
  // KMLダウンロード
  function downloadGeoJsonAsKml(geoJsonObject, fileName = "export.kml") {
    if (!geoJsonObject) {
      console.error("geoJsonObject が指定されていません");
      return;
    }

    const geoJsonFormat = new ol.format.GeoJSON();
    const kmlFormat = new ol.format.KML({ writeStyles: true });

    // GeoJSON -> OpenLayers Features (CRS84)
    const routeFeatures = geoJsonObject.routes
      ? geoJsonFormat.readFeatures(geoJsonObject.routes, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:4326' })
      : [];
    const spotFeatures = geoJsonObject.spots
      ? geoJsonFormat.readFeatures(geoJsonObject.spots, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:4326' })
      : [];

    const allFeatures = [...routeFeatures, ...spotFeatures];

    // スタイル設定（KML にスタイルを書き出すために feature に setStyle する）
    allFeatures.forEach((f) => {
      const geom = f.getGeometry();
      if (!geom) return;
      if (geom.getType() === 'LineString' || geom.getType() === 'MultiLineString') {
        // 線のスタイル
        f.setStyle(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: '#1f78b4', width: 4, lineCap: 'round' }),
        }));
        // KML の Placemark 名を設定（あれば properties.name を使う）
        f.set('name', f.get('name') ?? f.get('title') ?? '');
      } else if (geom.getType() === 'Point') {
        // 点のラベルスタイル（プロパティ 'text' をラベルに利用）
        const label = f.get('text') ?? f.get('name') ?? '';
        f.setStyle(new ol.style.Style({
          text: new ol.style.Text({
            text: String(label),
            font: 'bold 12px Arial',
            fill: new ol.style.Fill({ color: '#ffffff' }),
            stroke: new ol.style.Stroke({ color: '#000000', width: 3 }),
            offsetY: -12,
          }),
        }));
        f.set('name', label);
      } else {
        // その他は名前だけ設定
        f.set('name', f.get('name') ?? '');
      }
    });

    // KML文字列生成
    const kmlString = kmlFormat.writeFeatures(allFeatures, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:4326'
    });

    // ダウンロード処理
    const blob = new Blob([kmlString], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return {
    initialize,
    init市区町村震度Layer,
    init事前情報Layers
  };
}

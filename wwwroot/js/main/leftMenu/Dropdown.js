'use strict';

export function Dropdown(ctx) {
  const {
    base_url,
    root_url,
    locationReload
  } = ctx;
  function initialize() {
  }

  // ====================================================================
  // 調査ルート（予定）吹き出しメニュー　イベント KML/差し戻し
  // ====================================================================
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
        showSendBackModal(
          modBtn.dataset.name,
          modBtn.dataset.id,
          modBtn.dataset.routeid);
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
    const url = `${base_url}?handler=KmlDownload&id=${id}`;
    window.location.href = url;
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
  function showSendBackModal(name, id, routeid) {
    document.getElementById('modalSendBackConfirmHeader').innerHTML = "差し戻し";
    document.getElementById('modalSendBackConfirmTitle').innerHTML = "以下のルートを差し戻します。";
    // 名前表示
    document.getElementById("SendBackName").textContent = name;
    // OKボタンにID保持
    const okBtn = document.getElementById("btnSendOK");
    okBtn.dataset.id = id;
    okBtn.dataset.routeid = routeid;
    modalSend.show();
  }
  // OKボタンイベント
  document.getElementById("btnSendOK").addEventListener("click", function () {
    const name = document.getElementById("SendBackName").textContent;
    const id = this.dataset.id;
    const routeid = this.dataset.routeid;
    console.log("差し戻し実行:", id);
    ajaxExecute(base_url + '?Handler=UpdateStatus&id=' + id + '&rid=' + routeid,
      {}, {}
    ).then((json) => {
      modalSend.hide();
      showSendBackDoneModal(name, id, routeid);
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
  function showSendBackDoneModal(name, id, routeid) {
    if (routeid != "") {
      document.getElementById('modalSendBackDoneHeader').innerHTML = "差し戻し";
      document.getElementById('modalSendBackDoneTitle').innerHTML = "以下のルートを首都直下初動タブに差し戻しました。";
    } else {
      document.getElementById('modalSendBackDoneHeader').innerHTML = "差し戻し";
      document.getElementById('modalSendBackDoneTitle').innerHTML = "以下のルートを一時保存に差し戻しました。";
    }
    // 名前表示
    document.getElementById("SendBackDoneName").textContent = name;
    modalSendDone.show();
  }
  // 閉じるボタンクリック
  document.getElementById("btnSendDoneCancel").addEventListener("click", function () {
    modalSendDone.hide();
    locationReload();
  });

//  // --------------------------------------------------------------------
//  // KMLダウンロード
//  function downloadGeoJsonAsKml(geoJsonObject, fileName = "export.kml") {
//    if (!geoJsonObject) {
//      console.error("geoJsonObject が指定されていません");
//      return;
//    }
//
//    const geoJsonFormat = new ol.format.GeoJSON();
//    const kmlFormat = new ol.format.KML({ writeStyles: true });
//
//    // GeoJSON -> OpenLayers Features (CRS84)
//    const routeFeatures = geoJsonObject.routes
//      ? geoJsonFormat.readFeatures(geoJsonObject.routes, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:4326' })
//      : [];
//    const spotFeatures = geoJsonObject.spots
//      ? geoJsonFormat.readFeatures(geoJsonObject.spots, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:4326' })
//      : [];
//
//    const allFeatures = [...routeFeatures, ...spotFeatures];
//
//    // スタイル設定（KML にスタイルを書き出すために feature に setStyle する）
//    allFeatures.forEach((f) => {
//      const geom = f.getGeometry();
//      if (!geom) return;
//      if (geom.getType() === 'LineString' || geom.getType() === 'MultiLineString') {
//        // 線のスタイル
//        f.setStyle(new ol.style.Style({
//          stroke: new ol.style.Stroke({ color: '#1f78b4', width: 4, lineCap: 'round' }),
//        }));
//        // KML の Placemark 名を設定（あれば properties.name を使う）
//        f.set('name', f.get('name') ?? f.get('title') ?? '');
//      } else if (geom.getType() === 'Point') {
//        // 点のラベルスタイル（プロパティ 'text' をラベルに利用）
//        const label = f.get('text') ?? f.get('name') ?? '';
//        f.setStyle(new ol.style.Style({
//          text: new ol.style.Text({
//            text: String(label),
//            font: 'bold 12px Arial',
//            fill: new ol.style.Fill({ color: '#ffffff' }),
//            stroke: new ol.style.Stroke({ color: '#000000', width: 3 }),
//            offsetY: -12,
//          }),
//        }));
//        f.set('name', label);
//      } else {
//        // その他は名前だけ設定
//        f.set('name', f.get('name') ?? '');
//      }
//    });
//
//    // KML文字列生成
//    const kmlString = kmlFormat.writeFeatures(allFeatures, {
//      dataProjection: 'EPSG:4326',
//      featureProjection: 'EPSG:4326'
//    });
//
//    // ダウンロード処理
//    const blob = new Blob([kmlString], { type: "application/vnd.google-earth.kml+xml" });
//    const url = URL.createObjectURL(blob);
//    const a = document.createElement("a");
//    a.href = url;
//    a.download = fileName;
//    document.body.appendChild(a);
//    a.click();
//    document.body.removeChild(a);
//    URL.revokeObjectURL(url);
//  }
  return {
    initialize
  };
}

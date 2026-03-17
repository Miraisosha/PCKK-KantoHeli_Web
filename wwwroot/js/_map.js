'use strict';
window.app = window.app || {};

const base_url = location.origin + location.pathname.replace(/\/+$/, '');
const url = new URL(base_url);
const segments = url.pathname.split('/').filter(Boolean);
const appName = segments.length > 2 ? `/${segments[0]}` : '';
const root_url = url.origin + appName;

// ------------------------------------------------------------
// 地図表示関連(要openlayers)
// ------------------------------------------------------------
const proj3857 = "EPSG:3857"; // 球面メルカトル図法(地図表示する上での座標)
const proj4326 = "EPSG:4326"; // 地理座標系(GPSで得られる位置)
const geojsonFormatter = new ol.format.GeoJSON({ dataProjection: proj4326, featureProjection: proj3857 });

/**
 * Openlayersの地図表示オブジェクトを生成します。（背景地図選択selectElementのvalueで指定された種類の地図を背景とします）
 * @param {HTMLElement} targetElement 地図表示対象divElement
 * @param {HTMLSelectElement} sel背景地図選択Element 背景地図選択selectElement
 * @returns {ol.Map} mapオブジェクト
 */
const createMap = (targetElement, sel背景地図選択Element) => {
  // 地図表示範囲も一応定数で定義しておく
  const mapMinX = 120;
  const mapMinY = 22;
  const mapMaxX = 155;
  const mapMaxY = 46.5;
  // 初期座を表示対象Elementから取得する(指定なしの場合は東京近辺とする)
  const mapInitX = Number(sessionStorage.getItem('heliMapX') || targetElement.dataset.mapinitx) || 131.750;
  const mapInitY = Number(sessionStorage.getItem('heliMapY') || targetElement.dataset.mapinity) || 31.685;
  const mapInitZ = Number(sessionStorage.getItem('heliMapZ') || targetElement.dataset.mapinitz) || 9;

  // 地図表示View
  const mapView = new ol.View({
    extent: ol.proj.transformExtent([mapMinX, mapMinY, mapMaxX, mapMaxY], proj4326, proj3857), // 表示範囲を日本周辺に限定
    maxZoom: 18,
    minZoom: 5,
    center: ol.proj.fromLonLat([mapInitX, mapInitY]),
    zoom: mapInitZ,
  });
  // 地図本体
  const map = new ol.Map({
    target: targetElement,
    layers: [
      new ol.layer.Tile({}),
    ],
    view: mapView,
    controls: ol.control.defaults.defaults({
      attribution: false,
    }).extend([new ol.control.Attribution({ collapsible: false })]),
    interactions: ol.interaction.defaults.defaults({
      altShiftDragRotate: false,
      dragPan: false,
      pinchRotate: false,
    }).extend([new ol.interaction.DragPan({ kinetic: null })])
  });

  /**
   * 地図タイルの種類を設定(変更)します。
   * @param {ol.Map} map mapオブジェクト
   * @param {'標準地図'|'淡色地図'|'白地図'|'写真'|null} tileType タイルの種類
   */
  const setMapTileUrl = (map, tileType) => {
    const [tileurl, minzoom, maxzoom] =
      (tileType == '写真')
        ? ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', 5, 18]
        : (tileType == '白地図')
          ? ['https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png', 5, 14]
          : (tileType == '淡色地図')
            ? ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', 5, 18]
            : ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', 5, 18];
    const source = new ol.source.XYZ({
      url: tileurl,
      attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
      minZoom: minzoom,
      maxZoom: maxzoom,
    });
    map.getLayers().item(0).setSource(source);
  };
  // 地図タイルのsourceを設定（設定保存値あれば復元＆選択状態を変更）、選択変更時に変更を反映
  let tileType = sessionStorage.getItem('heliMapTile');
  if (tileType == '' || tileType == null) { tileType = '淡色地図'; }
  setMapTileUrl(map, tileType);
  if (tileType) {
    sel背景地図選択Element.value = tileType;
  }
  sel背景地図選択Element.addEventListener('change', (e) => {
    sessionStorage.setItem('heliMapTile', sel背景地図選択Element.value);
    setMapTileUrl(map, sel背景地図選択Element.value);
  });

  // 移動時/zoom時の座標等を保存
  map.on('moveend', (e) => {
    const center = ol.proj.transform(map.getView().getCenter(), proj3857, proj4326);
    sessionStorage.setItem('heliMapX', center[0]);
    sessionStorage.setItem('heliMapY', center[1]);
    sessionStorage.setItem('heliMapZ', mapView.getZoom());
  });

  // 作成されたオブジェクトを戻り値で返す
  return map;
};
window.app.map = createMap(
  document.getElementById('map'),
  document.getElementById('sel背景地図選択')
);

///**
// * 汎用：指定された色コードが明るい色か否かを返します。
// * @param {string} colorText 色コードの文字列「#FF8800」など
// * @returns 明るい色ならtrue
// */
//const isBrightColor = (colorText) => {
//  // 先頭の # を除去しRGB値に分解
//  const hex = colorText.replace('#', '');
//  const r = parseInt(hex.substring(0, 2), 16);
//  const g = parseInt(hex.substring(2, 4), 16);
//  const b = parseInt(hex.substring(4, 6), 16);
//  // 輝度を計算（一般的な加重平均式）
//  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
//  // 閾値128を基準に明るさを判定
//  return (brightness > 128);
//}

///**
// * 調査地点レイヤを作成します
// * @param {ol.Map} map mapオブジェクト
// * @param {?(feature: ol.Feature)=>boolean} isSelectedFunc 引数で指定されたfeatureを選択状態で表示するかを判定する関数
// * @remarks レイヤのfeatureに「color」プロパティで表示色を指定する。指定なしの場合は黒色表示とする。画面下部編集レイヤでは赤色固定とすること
// * @remarks レイヤのfeatureに「checkbox」プロパティで紐づくcheckboxを指定した場合、チェック状態がONであれば選択状態として表示する。チェック状態変更を行った／検知したらsource.changed()を呼び出すこと。
// */
//// rgb / color 値のパース（配列、"r,g,b"、"#rrggbb" を許容）
//// color プロパティ（"#RRGGBB"）があれば優先して使うように変更
//function parseRgbValue(val) {
//  if (!val && val !== 0) return null;
//  // 配列 [r,g,b]
//  if (Array.isArray(val) && val.length >= 3) {
//    const nums = val.slice(0, 3).map(n => Number(n));
//    if (nums.every(n => !Number.isNaN(n))) return nums;
//    return null;
//  }
//  // 文字列
//  if (typeof val === 'string') {
//    const s = val.trim();
//    // "#RRGGBB" または "RRGGBB"
//    const hexMatch = s.match(/^#?([0-9a-fA-F]{6})$/);
//    if (hexMatch) {
//      const hex = hexMatch[1];
//      const r = parseInt(hex.substr(0, 2), 16);
//      const g = parseInt(hex.substr(2, 2), 16);
//      const b = parseInt(hex.substr(4, 2), 16);
//      return [r, g, b];
//    }
//    // "r,g,b" や "r g b"
//    const parts = s.split(/[, \t]+/).map(p => Number(p));
//    if (parts.length >= 3 && parts.slice(0, 3).every(n => !Number.isNaN(n))) {
//      return parts.slice(0, 3);
//    }
//  }
//  // 数値は不正（期待しないが保険）
//  return null;
//}

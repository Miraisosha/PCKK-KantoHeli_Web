'use strict';

export function Intensity(ctx) {
  const {
    root_url,
    layerCity,
  } = ctx;

  const sourceCity = new ol.source.Vector();

  // ====================================================================
  // リアルタイム情報表示
  // ====================================================================
  function initialize() {
    // 市区町村震度ポリゴン　イベント
    const left市区町村震度Element = document.getElementById('left市区町村震度');
    left市区町村震度Element.querySelectorAll(`input[type="checkbox"][name="quake"]`).forEach((chk) => {
      loadCityGzGeoJson(chk.value);
      chk.addEventListener('change', (e) => {
        layerCity.setVisible(e.target.checked);
      });
    });
  }
  // ====================================================================
  // 市区町村震度ポリゴン 読み込み
  async function loadCityGzGeoJson(id) {
    const url = root_url + '/files/earthquake/' + id + '.geojson.gz';
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return;

    const buf = await res.arrayBuffer();
    const decompressed = pako.inflate(new Uint8Array(buf), { to: 'string' });
    const geojson = JSON.parse(decompressed);
    const features = new ol.format.GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' });
    sourceCity.addFeatures(features);
    layerCity.setSource(sourceCity);
  }
  return {
    initialize
  }
}

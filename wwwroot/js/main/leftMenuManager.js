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

  return {
    initialize,
    init市区町村震度Layer,
    init事前情報Layers
  };
}

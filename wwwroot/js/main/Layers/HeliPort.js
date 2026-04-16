'use strict';
export function HeliPort() {
  function getLayer(map) {
    const style = new ol.style.Style({
      text: new ol.style.Text({
        font: 'bold 18px bootstrap-icons',
        text: '\uF7FB',
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
      })
    });

    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        url: root_url + "/files/heliports.geojson",
        format: new ol.format.GeoJSON(),
      }),
      style: style,
      visible: false,
    });

    // --- マウスオーバーで名称表示するためのオーバーレイを作成 ---
    // popup 要素
    const popup = document.createElement('div');
    popup.className = 'ol-popup heli-popup';
    // 最低限のインラインスタイル（必要ならCSSで上書き）
    popup.style.cssText = 'background:rgba(255,255,255,0.95);padding:6px 8px;border:1px solid rgba(0,0,0,0.5);border-radius:4px;white-space:nowrap;pointer-events:none;display:none;font-size:13px;color:#000;';
    // ol.Overlay を作成して map に追加
    const overlay = new ol.Overlay({
      element: popup,
      offset: [0, -18],
      positioning: 'bottom-center',
      stopEvent: false
    });
    map.addOverlay(overlay);

    // map のターゲット要素取得（OpenLayers バージョン差を吸収）
    let mapTargetEl = null;
    if (typeof map.getTargetElement === 'function') {
      mapTargetEl = map.getTargetElement();
    } else {
      const tgt = map.getTarget();
      mapTargetEl = (typeof tgt === 'string') ? document.getElementById(tgt) : tgt;
    }

    // pointermove で該当レイヤー上の feature を取得してポップアップ表示
    map.on('pointermove', (evt) => {
      try {
        if (evt.dragging) return;
        const pixel = map.getEventPixel(evt.originalEvent);
        const feature = map.forEachFeatureAtPixel(pixel, (f, l) => {
          return (l === layer) ? f : null;
        });
        if (feature) {
          // GeoJSON のプロパティ名「名称」を優先して取得。英語 name もフォールバックで確認。
          const name = feature.get('名称') || feature.get('名称_') || feature.get('name') || feature.get('Name') || '';
          if (name) {
            popup.textContent = name;
            overlay.setPosition(evt.coordinate);
            popup.style.display = 'block';
            if (mapTargetEl) mapTargetEl.style.cursor = 'pointer';
            return;
          }
        }
      } catch (err) {
        console.warn('heliport pointermove error', err);
      }
      // 該当 feature がなければ非表示に戻す
      popup.style.display = 'none';
      if (mapTargetEl) mapTargetEl.style.cursor = '';
      overlay.setPosition(undefined);
    });

    // map がクリックや他操作でフォーカスを失ったとき等に確実に消す
    map.on('pointerdrag', () => {
      popup.style.display = 'none';
      if (mapTargetEl) mapTargetEl.style.cursor = '';
      overlay.setPosition(undefined);
    });

    return layer;
  }
  
  return {
    getLayer
  }
}

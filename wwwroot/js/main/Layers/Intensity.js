
'use strict';
export function Intensity() {
  function getLayer(){
    const layer = new ol.layer.Vector({
      style: (feature, resolution) => {
        try {
          // GeoJSON 側で color プロパティ("#RRGGBB") が入る場合は優先して使用する
          const rawColor = feature.get('color') ?? feature.get('rgb');
          const rgb = parseRgbValue(rawColor);
          // ポリゴンの背景色（半透明）
          const fillColor = rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)` : 'rgba(0,0,0,0.6)';
          // 枠線は背景色を暗くした色（なければ既定）
          let strokeColor = '#00008888';
          if (rgb) {
            const dr = Math.max(0, rgb[0] - 40);
            const dg = Math.max(0, rgb[1] - 40);
            const db = Math.max(0, rgb[2] - 40);
            strokeColor = `rgba(${dr},${dg},${db},0.9)`;
          }
          return new ol.style.Style({
            fill: new ol.style.Fill({ color: fillColor }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: 1 }),
          });
        } catch (err) {
          console.warn('layer style parse error', err);
          return new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(0,0,0,0.6)' }),
            stroke: new ol.style.Stroke({ color: '#00008888', width: 1 }),
          });
        }
      },
      visible: false,
    });
    return layer;
  }
  return {
    getLayer
  }
}

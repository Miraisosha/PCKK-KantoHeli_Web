
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
  /**
   * 調査地点レイヤを作成します
   * @param {ol.Map} map mapオブジェクト
   * @param {?(feature: ol.Feature)=>boolean} isSelectedFunc 引数で指定されたfeatureを選択状態で表示するかを判定する関数
   * @remarks レイヤのfeatureに「color」プロパティで表示色を指定する。指定なしの場合は黒色表示とする。画面下部編集レイヤでは赤色固定とすること
   * @remarks レイヤのfeatureに「checkbox」プロパティで紐づくcheckboxを指定した場合、チェック状態がONであれば選択状態として表示する。チェック状態変更を行った／検知したらsource.changed()を呼び出すこと。
   */
  // rgb / color 値のパース（配列、"r,g,b"、"#rrggbb" を許容）
  // color プロパティ（"#RRGGBB"）があれば優先して使うように変更
  function parseRgbValue(val) {
    if (!val && val !== 0) return null;
    // 配列 [r,g,b]
    if (Array.isArray(val) && val.length >= 3) {
      const nums = val.slice(0, 3).map(n => Number(n));
      if (nums.every(n => !Number.isNaN(n))) return nums;
      return null;
    }
    // 文字列
    if (typeof val === 'string') {
      const s = val.trim();
      // "#RRGGBB" または "RRGGBB"
      const hexMatch = s.match(/^#?([0-9a-fA-F]{6})$/);
      if (hexMatch) {
        const hex = hexMatch[1];
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return [r, g, b];
      }
      // "r,g,b" や "r g b"
      const parts = s.split(/[, \t]+/).map(p => Number(p));
      if (parts.length >= 3 && parts.slice(0, 3).every(n => !Number.isNaN(n))) {
        return parts.slice(0, 3);
      }
    }
    // 数値は不正（期待しないが保険）
    return null;
  }
  return {
    getLayer
  }
}

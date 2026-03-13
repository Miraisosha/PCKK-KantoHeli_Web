'use strict';
export function EditRoute() {
  function getLayer() {
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      visible:false,
      style: function (feature, resolution) {
        const color = feature.get('color') || '#0000FF';
        const strokeColor = isBrightColor(color) ? '#000000' : '#FFFFFF';
        const spotColor = feature.get('spotColor');
        const text = feature.get('text');
        const styles = [];
        if (feature.getGeometry().getType() == 'Point') {
          // 地点色が指定されているなら円で塗りつぶす
          if (spotColor) {
            styles.push(new ol.style.Style({
              image: new ol.style.Circle({
                radius: 10,
                fill: new ol.style.Fill({ color: spotColor }),
                //TODO 円の境界色も指定できる必要がありそう？(spotBorderColorが指定されてたときのみ描画、等)
                stroke: new ol.style.Stroke({ color: color, width: 1 }),
              }),
            }));
          }
          // テキストが指定されていたらそのテキストを表示
          if (text == '始') {
            // 始点 H アイコン
            styles.push(new ol.style.Style({
              text: new ol.style.Text({
                font: 'bold 20px bootstrap-icons',
                text: '\uF7FB',
                fill: new ol.style.Fill({ color: '#00F' }),
                stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
              })
            }));
            // 始点文字
            styles.push(new ol.style.Style({
              text: new ol.style.Text({
                offsetX: 25,
                text: text,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
                font: '18px Calibri,sans-serif',
              }),
            }));
          } else if (text == '終') {
            // 終点 H アイコン
            styles.push(new ol.style.Style({
              text: new ol.style.Text({
                font: 'bold 20px bootstrap-icons',
                text: '\uF7FB',
                fill: new ol.style.Fill({ color: '#00F' }),
                stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
              })
            }));
            // 終点文字
            styles.push(new ol.style.Style({
              text: new ol.style.Text({
                offsetX: -28,
                text: text,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
                font: '18px Calibri,sans-serif',
              }),
            }));
          } else if(text != "") {
            //styles.push(new ol.style.Style({
            //  text: new ol.style.Text({
            //    offsetX: 10.5,
            //    text: text,
            //    fill: new ol.style.Fill({ color: '#000' }),
            //    stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
            //    font: '22px Calibri,sans-serif',
            //  }),
            //}));
            styles.push(new ol.style.Style({
              text: new ol.style.Text({
                offsetX: 1,
                offsetY: 1,
                text: text,
                fill: new ol.style.Fill({ color: '#000' }),
                stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
                font: '18px Calibri,sans-serif',
              }),
            }));
          }
        } else {
          // 飛行ルートの線を表示
          styles.push(new ol.style.Style({
            stroke: new ol.style.Stroke({ color: strokeColor, width: 3, lineDash: [4, 10], }),
          }));
          styles.push(new ol.style.Style({
            stroke: new ol.style.Stroke({ color: color, width: 3, lineDash: [0, 1, 5, 11], }),
          }));
        }
        return styles;
      },
    });
    return layer;
  }
  return {
    getLayer
  }
}

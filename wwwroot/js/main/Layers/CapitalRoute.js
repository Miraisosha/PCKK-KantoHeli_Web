'use strict';
export function CapitalRoute () {
  function getLayer() {
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      visible:false,
      style: getStyle,
    });
    return layer;
  }

  function getStyle (feature, resolution) {
    //const color = feature.get('color') || '#0000FF';
    const color = '#00000';
    const strokeColor = '#FFFFFF';
    const spotColor = feature.get('spotColor');
    const text = feature.get('text');
    const type = feature.get('type');
    const no = feature.get('no');
    const styles = [];
    if (feature.getGeometry().getType() == 'Point') {
      // 地点色が指定されているなら円で塗りつぶす
      if (spotColor) {
        //styles.push(new ol.style.Style({
        //  image: new ol.style.Circle({
        //    radius: 14,
        //    fill: new ol.style.Fill({ color: "red" }),
        //    stroke: new ol.style.Stroke({ color: color, width: 1 }),
        //  }),
        //}));
      }
      // テキストが指定されていたらそのテキストを表示
      if (text) {
        if (type == 4) {
          //styles.push(new ol.style.Style({
          //  text: new ol.style.Text({
          //    offsetX: 10,
          //    offsetY: 10,
          //    text: text,
          //    fill: new ol.style.Fill({ color: '#000' }),
          //    stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
          //    font: '16px Calibri,sans-serif',
          //  }),
          //}));
        } else if (type == 2) {
          // 始点 H アイコン
          styles.push(new ol.style.Style({
            text: new ol.style.Text({
              font: 'bold 20px bootstrap-icons',
              text: '\uF7FB',
              fill: new ol.style.Fill({ color: '#000' }),
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
        } else if (type == 3) {
          // 終点 H アイコン
          styles.push(new ol.style.Style({
            text: new ol.style.Text({
              font: 'bold 20px bootstrap-icons',
              text: '\uF7FB',
              fill: new ol.style.Fill({ color: '#000' }),
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
        }
      }
    } else {
      const geometry = feature.getGeometry();
      const coordinates = geometry.getCoordinates();

      // ---- ライン本体 ----
      if (type == 1) {
        // 白縁
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#FFFFFF',
            width: 15
          }),
        }));
      } else {
        // 本体
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#0000FF',
            width: 5,
          }),
        }));
      }
      // ===== 始点・終点テキスト表示 =====
      if (no && coordinates.length > 1) {

        const startCoord = coordinates[0];
        const endCoord = coordinates[coordinates.length - 1];

        // 始点
        styles.push(new ol.style.Style({
          geometry: new ol.geom.Point(startCoord),
          text: new ol.style.Text({
            text: no,
            offsetY: 5,
            font: 'bold 16px Calibri,sans-serif',
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#FFF', width: 3 }),
          }),
        }));

        // 終点
        styles.push(new ol.style.Style({
          geometry: new ol.geom.Point(endCoord),
          text: new ol.style.Text({
            text: no,
            offsetY: -5,
            font: 'bold 16px Calibri,sans-serif',
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#FFF', width: 3 }),
          }),
        }));
      }
      // 飛行ルートの線を表示
      //styles.push(new ol.style.Style({
      //  stroke: new ol.style.Stroke({ color: strokeColor, width: 5, lineDash: [4, 10], }),
      //}));
      if (type == 1) {
        // 調査箇所スタイル
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: spotColor, width: 10, lineDash: [1], }),
        }));
      } else {
        // 通過用スタイル
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: '#0000FF', width: 5, lineDash: [1], }),
        }));
      }
    }
    return styles;
  }
  return {
    getLayer
  }
}

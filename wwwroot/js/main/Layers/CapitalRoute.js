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
          stroke: new ol.style.Stroke({
            color: '#FFFFFF',
            width: 15
          }),
        }));
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: spotColor, width: 10, lineDash: [1], }),
        }));
      } else {
        // 通過用スタイル
        const end = coordinates[coordinates.length - 1];
        const prev = coordinates[coordinates.length - 2];

        const dx = end[0] - prev[0];
        const dy = end[1] - prev[1];
        const rotation = Math.atan2(dy, dx);

        const size = 20 * resolution;

        const p1 = [
          end[0] - size * Math.cos(rotation),
          end[1] - size * Math.sin(rotation)
        ];

        const left = [
          p1[0] + size * 0.5 * Math.cos(rotation + Math.PI / 2),
          p1[1] + size * 0.5 * Math.sin(rotation + Math.PI / 2)
        ];

        const right = [
          p1[0] + size * 0.5 * Math.cos(rotation - Math.PI / 2),
          p1[1] + size * 0.5 * Math.sin(rotation - Math.PI / 2)
        ];

        const triangle = new ol.geom.Polygon([[
          end,
          left,
          right,
          end
        ]]);

        console.log("Yazi!" + type);
        console.log(feature.getGeometry().getType());
        styles.push(new ol.style.Style({
          geometry: triangle,
          fill: new ol.style.Fill({
            color: '#0000FF'
          }),
          stroke: new ol.style.Stroke({
            color: '#000000',
            width: 2
          })
        }));
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

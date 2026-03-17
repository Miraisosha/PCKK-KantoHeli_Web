'use strict';
export function SurveyRoute () {
  // ********************************************************************************************
  // ルート作成　調査地点　レイヤー ピンクのライン
  // 調査依頼状況　ポイント/ライン
  function getSpotLayer() {
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: function (feature, resolution) {
        const color = feature.get('color') || '#000000';
        const checkbox = feature.get('checkbox')
        const styles = [];

        if (checkbox && checkbox.checked) {
          styles.push(new ol.style.Style({
            image: new ol.style.Circle({
              radius: 20,
              fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.6)' }),
            }),
            stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 0, 0.6)', width: 18 }),
          }));
        }

        // 白縁（アウトライン）
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#ffffff',
            width: 15   // 本体より少し太く
          }),
          image: new ol.style.Circle({
            radius: 15,
            fill: new ol.style.Fill({ color: '#ffffff' })
          })
        }));

        // 本体
        styles.push(new ol.style.Style({
          image: new ol.style.Circle({
            radius: 12,
            fill: new ol.style.Fill({ color: color }),
            stroke: new ol.style.Stroke({ color: color, width: 1 }),
          }),
          stroke: new ol.style.Stroke({ color: color, width: 9 }),
        }));

        return styles;
      },
    });
    return layer;
  };

  function getLayer() {
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: getStyle,
    });
    return layer;
  }

  function getStyle (feature, resolution) {
    const color = feature.get('color') || '#FF0000';
    const strokeColor = '#FFFFFF';
    const spotColor = feature.get('spotColor');
    const text = feature.get('text');
    const type = feature.get('type');
    const styles = [];
    const geometry = feature.getGeometry();
    const coordinates = geometry.getCoordinates();
    if (feature.getGeometry().getType() == 'Point') {
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
            fill: new ol.style.Fill({ color: '#000' }),
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
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
            font: '18px Calibri,sans-serif',
          }),
        }));
      } else if (text != "") {
        styles.push(new ol.style.Style({
          text: new ol.style.Text({
            offsetX: 20,
            text: text,
            fill: new ol.style.Fill({ color: "#000" }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
            font: '18px Calibri,sans-serif',
          }),
        }));
      }
    } else if (feature.getGeometry().getType() == 'LineString') {
      // 通過用スタイル --------------------------------------------
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
    return styles;
  }
  return {
    getLayer,
    getSpotLayer
  }
}

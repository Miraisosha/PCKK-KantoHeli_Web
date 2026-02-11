'use strict';
window.app = window.app || {};

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
  const tileType = sessionStorage.getItem('heliMapTile');
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

/**
 * 汎用：指定された色コードが明るい色か否かを返します。
 * @param {string} colorText 色コードの文字列「#FF8800」など
 * @returns 明るい色ならtrue
 */
const isBrightColor = (colorText) => {
  // 先頭の # を除去しRGB値に分解
  const hex = colorText.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // 輝度を計算（一般的な加重平均式）
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  // 閾値128を基準に明るさを判定
  return (brightness > 128);
}

/**
 * 調査地点レイヤを作成します
 * @param {ol.Map} map mapオブジェクト
 * @param {?(feature: ol.Feature)=>boolean} isSelectedFunc 引数で指定されたfeatureを選択状態で表示するかを判定する関数
 * @remarks レイヤのfeatureに「color」プロパティで表示色を指定する。指定なしの場合は黒色表示とする。画面下部編集レイヤでは赤色固定とすること
 * @remarks レイヤのfeatureに「checkbox」プロパティで紐づくcheckboxを指定した場合、チェック状態がONであれば選択状態として表示する。チェック状態変更を行った／検知したらsource.changed()を呼び出すこと。
 */
const createSpotLayer = (map) => {
  const layer調査地点 = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: function (feature, resolution) {
      const color = feature.get('color') || '#000000';
      const backColor = isBrightColor(color) ? '#000000' : '#FFFFFF';
      const checkbox = feature.get('checkbox')
      const styles = [];
      if (checkbox && checkbox.checked) {
        // 選択状態の地点は黄色で表示
        styles.push(new ol.style.Style({
          image: new ol.style.Circle({
            radius: 20,
            fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.6)' }),
          }),
          stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 0, 0.6)', width: 15 }),
        }));
      }
      //TODO 点/線に応じたスタイルをもっといろいろ設定すべき？
      styles.push(new ol.style.Style({
        stroke: new ol.style.Stroke({ color: backColor, width: 5 }),
      }));
      styles.push(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 9,
          fill: new ol.style.Fill({ color: color }),
          stroke: new ol.style.Stroke({ color: backColor, width: 1 }),
        }),
        stroke: new ol.style.Stroke({ color: color, width: 4 }),
      }));
      return styles;
    },
  });
  map.addLayer(layer調査地点);
  return layer調査地点;
};

/**
 * 調査ルートレイヤを作成します。
  * @param {ol.Map} map mapオブジェクト
 * @remarks レイヤのfeatureとして、線 または 「text」プロパティで表示内容を指定したPointを指定する。
 * @remarks レイヤのfeatureには「color」プロパティで表示色を指定する。指定なしの場合は黒色表示となる。
 */
const createRouteLayer = (map) => {
  const layer調査ルート = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: function (feature, resolution) {
      const color = feature.get('color') || '#000000';
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
        if (text) {
          styles.push(new ol.style.Style({
            text: new ol.style.Text({
              offsetX: 0.5,
              text: text,
              fill: new ol.style.Fill({ color: color }),
              stroke: new ol.style.Stroke({ color: strokeColor, width: 3 }),
              font: '12px Calibri,sans-serif',
            }),
          }));
        }
      } else {
        // 飛行ルートの線を表示
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: strokeColor, width: 5, lineDash: [4, 10], }),
        }));
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: color, width: 3, lineDash: [0, 1, 2, 11], }),
        }));
      }
      return styles;
    },
  });
  map.addLayer(layer調査ルート);
  return layer調査ルート;
};


// ********************************************************************************************
// ********************************************************************************************
// 調査地点追加　距離標　登録
// ********************************************************************************************
// ********************************************************************************************
const kp_font = '14px sans-serif';
const kp_font_offset = -18;
/**
 * 河川　距離標レイヤ作成
 * 
 * @param {any} map
 * @returns
 */
const createKPRiver = (map) => {
  const layer = new ol.layer.Vector({
    style: styleKPRiver,
    visible: false
  });
  map.addLayer(layer);
  return layer;
};
function setKPSource(drawType) {
  let url = null;
  if (drawType == 'River') {
    url = '/files/kp_river.json'
  } else if (drawType == 'Road') {
    url = '/files/kp_road.json'
  } else {
    return null;
  }
  return new ol.source.Vector({
    url: url,
    format: new ol.format.GeoJSON({
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    })
  })
}
function styleKPRiver(feature) {
  const styles = [];
  styles.push(
    new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({ color: 'blue' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
      })
    })
  );
  styles.push(
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'blue',
        width: 2
      })
    })
  );
  return styles;
}
function onMouseOverKPRiver(feature) {
  feature.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: 'orange' }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
    }),
    text: new ol.style.Text({
      text: feature.get('左右岸') + " " + Number(feature.get('距離標')) + "KP",
      font: kp_font,
      fill: new ol.style.Fill({ color: '#000' }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
      offsetY: kp_font_offset,
    })
  }));
}
const createKPLineRiver = (map) => {
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: '/files/kp_river_line.json',
      format: new ol.format.GeoJSON({
        dataProjection: 'EPSG:4326',     // GeoJSON の座標系
        featureProjection: 'EPSG:3857'   // 地図表示用
      })
    }),
    style: styleKPLineRiver,
    visible:false 
  });
  map.addLayer(layer);
  return layer;
}
function styleKPLineRiver(feature) {
  return new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: '#81AFFF',
      width: 2
    })
  });
}

/**
 * 道路　距離標レイヤ作成
 * 
 * @param {any} map
 * @returns
 */
const createKPRoad = (map) => {
  const layer = new ol.layer.Vector({
    style: styleKPRoad,
    visible:false,
  });
  map.addLayer(layer);
  return layer;
};
function styleKPRoad(feature) {
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({ color: 'blue' }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
    }),
//    text: new ol.style.Text({
//      text: feature.get('路線') + "号線 " + feature.get('地点標名称') + "KP",
//      font: '8px sans-serif',
//      fill: new ol.style.Fill({ color: '#000' }),
//      stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
//      offsetY: 12
//    })
  });
}
function onMouseOverKPRoad(feature) {
  feature.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: 'orange' }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
    }),
    text: new ol.style.Text({
      text: feature.get('路線') + "号線 " + feature.get('地点標名称') + "KP",
      font: kp_font,
      fill: new ol.style.Fill({ color: '#000' }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
      offsetY: kp_font_offset,
    })
  }));

}
function onMouseOut(feature) {
  feature.setStyle(undefined);
}

/**
 * 距離標選択状態
 * 
 * @param {any} map
 * @returns
 */
const createSelectionKPLayer = (map) => {
  const selectLayer = new ol.layer.Vector({
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 10,
        stroke: new ol.style.Stroke({
          color: 'red',
          width: 3
        }),
        fill: new ol.style.Fill({
          color: 'rgba(255,0,0,0.2)'
        })
      })
    })
  });
  map.addLayer(selectLayer);
  return selectLayer;
}
/**
 * 距離標選択完了時のライン
 * @param {any} map
 */
const createSelectedKPLineLayer = (map) => {
  const layer = new ol.layer.Vector({
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: '#0396FE',
        width: 4
      })
    })
  });
  map.addLayer(layer);
  return layer;
}

const createKPLineRoad = (map) => {
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: '/files/kp_road_line.json',
      format: new ol.format.GeoJSON({
        dataProjection: 'EPSG:4326',     // GeoJSON の座標系
        featureProjection: 'EPSG:3857'   // 地図表示用
      })
    }),
    style: styleKPLineRiver,
    visible: false
  });
  map.addLayer(layer);
  return layer;
}


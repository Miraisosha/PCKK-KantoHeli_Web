'use strict';
window.app = window.app || {};

const base_url = location.origin + location.pathname.replace(/\/+$/, '');
const url = new URL(base_url);
const segments = url.pathname.split('/').filter(Boolean);
const appName = segments.length > 2 ? `/${segments[0]}` : '';
const root_url = url.origin + appName;

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
// ********************************************************************************************
// 市区町村震度ポリゴン　？？？
// ********************************************************************************************
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
function createCityLayer(map){
  const layer = new ol.layer.Vector({
    style: (feature, resolution) => {
      try {
        // GeoJSON 側で color プロパティ("#RRGGBB") が入る場合は優先して使用する
        const rawColor = feature.get('color') ?? feature.get('rgb');
        const rgb = parseRgbValue(rawColor);
        // ポリゴンの背景色（半透明）
        const fillColor = rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.6)` : 'rgba(0,0,0,0.6)';
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

// ********************************************************************************************
// 事前情報ヘリポート
// ********************************************************************************************
function createHeliPortLayer(map) {
  const style = new ol.style.Style({
    text: new ol.style.Text({
      font: 'bold 18px bootstrap-icons',
      text: '\uF7FB',
      fill: new ol.style.Fill({ color: '#00F' }),
      stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
    })
  });

  const layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: root_url + "/files/heliports.json",
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
  
// ********************************************************************************************
/**
 * 調査ルート（編集中）レイヤを作成します。
  * @param {ol.Map} map mapオブジェクト
 * @remarks レイヤのfeatureとして、線 または 「text」プロパティで表示内容を指定したPointを指定する。
 * @remarks レイヤのfeatureには「color」プロパティで表示色を指定する。指定なしの場合は黒色表示となる。
 */
// ********************************************************************************************
const createEditRouteLayer = (map) => {
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
};
// ********************************************************************************************
// ルート作成　調査地点　レイヤー ピンクのライン
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
          stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 0, 0.6)', width: 18 }),
        }));
      }
      //TODO 点/線に応じたスタイルをもっといろいろ設定すべき？
      styles.push(new ol.style.Style({
        stroke: new ol.style.Stroke({ color: backColor, width: 8 }),
      }));
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
  return layer調査地点;
};

// ********************************************************************************************
// 左メニュー　調査地点
const createLeftSpotLayer = (map) => {
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: function (feature, resolution) {
      const color = feature.get('color') || '#000000';
      const backColor = isBrightColor(color) ? '#000000' : '#FFFFFF';
      const checkbox = feature.get('checkbox')
      const styles = [];
      // 選択状態の地点は黄色で表示
      styles.push(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 20,
          fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.6)' }),
        }),
        stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 0, 0.6)', width: 18 }),
      }));
      //TODO 点/線に応じたスタイルをもっといろいろ設定すべき？
      styles.push(new ol.style.Style({
        stroke: new ol.style.Stroke({ color: backColor, width: 8 }),
      }));
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

// ********************************************************************************************
/**
 * 調査ルートレイヤを作成します。
  * @param {ol.Map} map mapオブジェクト
 * @remarks レイヤのfeatureとして、線 または 「text」プロパティで表示内容を指定したPointを指定する。
 * @remarks レイヤのfeatureには「color」プロパティで表示色を指定する。指定なしの場合は黒色表示となる。
 */
// ********************************************************************************************
const createRouteLayer = (map) => {
  const layer調査ルート = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: function (feature, resolution) {
      const color = feature.get('color') || '#FF0000';
      const strokeColor = isBrightColor(color) ? '#000000' : '#FFFFFF';
      const spotColor = feature.get('spotColor');
      const text = feature.get('text');
      const styles = [];
      if (feature.getGeometry().getType() == 'Point') {
        // 地点色が指定されているなら円で塗りつぶす
        if (spotColor) {
          //styles.push(new ol.style.Style({
          //  image: new ol.style.Circle({
          //    radius: 10,
          //    fill: new ol.style.Fill({ color: spotColor }),
          //    //TODO 円の境界色も指定できる必要がありそう？(spotBorderColorが指定されてたときのみ描画、等)
          //    stroke: new ol.style.Stroke({ color: color, width: 1 }),
          //  }),
          //}));
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
      } else {
        // 飛行ルートの線を表示
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: strokeColor, width: 5, lineDash: [4, 10], }),
        }));
        //styles.push(new ol.style.Style({
        //  stroke: new ol.style.Stroke({ color: color, width: 3, lineDash: [0, 1, 2, 11], }),
        //}));
        // 通過用スタイル
        styles.push(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: '#0000FF', width: 5, lineDash: [1], }),
        }));
      }
      return styles;
    },
  });
  return layer調査ルート;
};


// ********************************************************************************************
// 初動調査ルート　レイヤ
// ********************************************************************************************
const createCapitalRouteLayer = (map) => {
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    visible:false,
    style: function (feature, resolution) {
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
          styles.push(new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: "red",
              width: 10,
            }),
          }));
        } else {
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
            stroke: new ol.style.Stroke({ color: "red", width: 10, lineDash: [1], }),
          }));
        } else {
          // 通過用スタイル
          styles.push(new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#0000FF', width: 5, lineDash: [1], }),
          }));
        }
      }
      return styles;
    },
  });
  return layer;
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
  return layer;
};
function setKPSource(drawType) {
  let url = null;
  if (drawType == 'River') {
    url = root_url + '/files/kp_river_point.json'
  } else if (drawType == 'Road') {
    url = root_url + '/files/kp_road_point.json'
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
      url: root_url + '/files/kp_river_line.json',
      format: new ol.format.GeoJSON({
        dataProjection: 'EPSG:4326',     // GeoJSON の座標系
        featureProjection: 'EPSG:3857'   // 地図表示用
      })
    }),
    style: styleKPLineRiver,
    visible:false 
  });
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
  return layer;
}

const createKPLineRoad = (map) => {
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: root_url + '/files/kp_road_line.json',
      format: new ol.format.GeoJSON({
        dataProjection: 'EPSG:4326',     // GeoJSON の座標系
        featureProjection: 'EPSG:3857'   // 地図表示用
      })
    }),
    style: styleKPLineRiver,
    visible: false
  });
  return layer;
}
function createFlightRouteKMLLayer(map) {
  var rand = (new Date).time;
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: root_url + '/files/FlightRoute/sample.kml?k=' + rand,
      format: new ol.format.KML({
        extractStyles: true   // ← 重要
      })
    })
  });
  return layer;
}

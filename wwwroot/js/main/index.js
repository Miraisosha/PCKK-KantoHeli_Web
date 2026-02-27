'use strict';
import { initKPManager } from './kp/kpManager.js';
import { initDistanceMeasure } from './distance/Measure.js';
import { Capital } from './tabs/Capital.js';
import { leftMenuManager } from './leftMenuManager.js';
import { InvestigationRequestStatus } from './tabs/InvestigationRequestStatus.js';
import { CreateRoute } from './tabs/CreateRoute.js';


const base_url = location.origin + location.pathname;
const segments = location.pathname.split("/").filter(Boolean);
const threadId = segments[segments.length - 1];


// タブ・ないしタブ間での相互連携があるelement定義
const dispArea = document.getElementById("dispArea");
const tab特定初動調査 = document.getElementById("tab特定初動調査");
const tab調査依頼 = document.getElementById("tab調査依頼");
const tab依頼状況 = document.getElementById("tab依頼状況");
const tabルート作成 = document.getElementById('tabルート作成');
const loginUser = {
  isLogin :       document.getElementById('btnLogin').dataset.logined,
  orgId:          document.getElementById('組織id').dataset.value,
  userName :      document.getElementById('ユーザー名').dataset.value,
  userdId:        document.getElementById('ユーザーid').dataset.value,
  isRouteCreate:  document.getElementById('isルート作成可').dataset.value,
};
console.log(loginUser);

// =====================================================================
// 地図表示（以下の順にレイヤを作成・追加する（レイヤ作成処理は後ろで宣言する関係でfunctionとして定義しホイスティング））
// =====================================================================
//const map = createMap(document.getElementById('map'), document.getElementById('sel背景地図選択'));
const map = window.app.map;

// 選択中状態で表示すべきfeatureのidの一覧
let selectedFeatureIds = [];

// 防災ヘリ関連情報
const layer調査地点 = createSpotLayer(map);
const layer調査ルート = createRouteLayer(map);

// 調査依頼　距離標選択
const layerKPLine河川         = createKPLineRiver(map);           // 距離標　河川 Line
const layerKPLine道路         = createKPLineRoad(map);            // 距離標　道路 Line
const layerKP河川             = createKPRiver(map);               // 距離標　河川 Point
const layerKP道路             = createKPRoad(map);                // 距離標　道路 Point
const layerSelectionKP        = createSelectionKPLayer(map);      // 選択中 Point
const layerSelectedKPLine     = createSelectedKPLineLayer(map);   // 選択完了 Line
const mapKPSource             = new ol.source.Vector();
const mapSelectedKPLineSource =  new ol.source.Vector();
const mapKPSource河川         = setKPSource('River');
const mapKPSource道路         = setKPSource('Road');
layerKP河川.set('drawType', 'River');
layerKP道路.set('drawType', 'Road');
layerKP河川.setSource(mapKPSource河川);
layerKP道路.setSource(mapKPSource道路);
layerSelectionKP.setSource(mapKPSource);
layerSelectedKPLine.setSource(mapSelectedKPLineSource);
// タブ
const layer編集中調査地点 = createSpotLayer(map);
//const layer編集中調査ルート = createRouteLayer(map);
const /** @type{Map<string, ol.source.Vector>} */ map調査地点Source = {};
const /** @type{Map<string, ol.source.Vector>} */ map調査ルートSource = {};
// 調査ルート作成　（編集中）
const layer編集調査ルート = createEditRouteLayer(map);

// 地図に対する描画操作（地点追加等）
let /** @type{ol.interaction.Draw?} */ mapDraw = null;
// 何らかの表示中のtoast
let /** @type{bootstrap.Toast?} */ displayingToast = null;

// ====================================================================
const 調査依頼タブ = init調査依頼タブ();
//init依頼状況タブ();
//if (tabルート作成) {
//  initルート作成タブ();
//}

// ====================================================================
// 調査依頼　距離標入力
const kpManager = initKPManager({
  map,
  layers: {
    layerKP河川,
    layerKP道路,
    layerKPLine河川,
    layerKPLine道路,
    layerSelectedKPLine
  },
  sources: {
    mapKPSource,
    mapKPSource河川,
    mapKPSource道路,
    mapSelectedKPLineSource
  },
  ui: {
    modalKPPoint: document.getElementById('modalKPPoint'),
    selRoadRiver: document.getElementById('selRoadRiver'),
    startKp: document.getElementById('startKp'),
    endKp: document.getElementById('endKp')
  },
  onConfirm: (kpResult) => {
    調査依頼タブ.create調査依頼行FromKP(kpResult);
  }
});
// ====================================================================
// 左メニュー
// 距離計測
const distance = initDistanceMeasure({ map });
const leftMenu = leftMenuManager({
  base_url,
  threadId,
  map,
  layer調査地点,
  layer調査ルート
});
leftMenu.init市区町村震度Layer();
leftMenu.init事前情報Layers();

init防災ヘリ関連情報Layers();

// ====================================================================
// タブ　調査依頼状況
const reload防災ヘリ関連情報 = () => {
  return new Promise((resolve, reject) => {
    return resolve();
  });
}
const requestStatus = InvestigationRequestStatus({
  base_url,
  tab依頼状況,
  set調査地点Source,
  geojsonFormatter,
  ajaxExecute,
  reload防災ヘリ関連情報,
  showAlert,
  showConfirm
});
requestStatus.initialize();
requestStatus.reload();
// ====================================================================
// 首都直下初動
const capital = Capital({
  base_url,
  tabElement: tab特定初動調査,
  set調査地点Source,
  create明細行,
  ajaxExecute,
  geojsonFormatter,
  createDetailRecord: (tab, feature) => {
    create明細行(ta, feature);
  }
})
if (loginUser.isRouteCreate) {
  capital.initialize();
}
// ====================================================================
// 調査ルート作成
const createRoute = CreateRoute({
    base_url,
    tabElement: tabルート作成,
    map,
    layer: layer編集調査ルート,
    set調査地点Source,
    ajaxExecute,
    geojsonFormatter,
    showAlert,
    showConfirm,
    proj3857,
    proj4326,
    getSelectedFeatureIds: () => selectedFeatureIds,
    setSelectedFeatureIds: (v) => selectedFeatureIds = v,
    reverseSelectedFeatureIds: () => { selectedFeatureIds.reverse() },
  });
if (loginUser.isRouteCreate) {
  createRoute.initialize();
}

// ====================================================================
// 共通：地図上をマウスクリックした際の制御
map.on('click', (e) => {
  if (mapDraw != null) { return; } // ただし描画操作中は除く
  map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
    // 現在表示中の画面下部タブの当該featureの選択状態を反転させる
    if (layer == layer編集中調査地点) {
      const checkbox = feature.get('checkbox');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }
    }
    // 距離標ポイント　クリックイベント
    if (kpManager.handleMapClick(feature, layer)) {
      return;
    }
  });
});
// 共通：右クリックでLineString等描画のundo
map.getViewport().addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (mapDraw != null) {
    mapDraw.removeLastPoint();
  }
});

// ====================================================================
// 全タブ共通：全選択チェック変更⇒一覧のチェック状態に反映
document.querySelectorAll('#bottomArea table>thead input[name="chk全選択"]').forEach((cb) => {
  cb.addEventListener('change', (e) => {
    const checked = cb.checked;
    const checkboxes = cb.closest('table').querySelectorAll('tbody>tr:not(.d-none) input[type="checkbox"][name="id"]:not(:disabled)');
    checkboxes.forEach((cb) => {
      cb.checked = checked;
      const index = selectedFeatureIds.indexOf(cb.value);
      console.log("All Change");
      if (cb.checked && index == -1) {
        selectedFeatureIds.push(cb.value);
      } else if (!cb.checked && index != -1) {
        selectedFeatureIds.splice(index, 1);
      }
    });
    //source調査地点.changed(); // レイヤ再描画
    if (tabルート作成) createRoute.autoCalculateDistance();
  });
});
// ====================================================================
// 全タブ共通：一覧チェック変更⇒選択状態を変更し画面に反映
document.querySelectorAll('#bottomArea table>tbody').forEach((tbody) => {
  tbody.addEventListener('change', (e) => {
    const cb = (e.target.type == 'checkbox' && e.target.name == 'id') ? e.target : e.target.closest('input[type="checkbox"][name="id"]');
    //    if (cb) {
    //      layer編集中調査地点.getSource().changed();
    //    }
    if (cb) {
      const index = selectedFeatureIds.indexOf(cb.value);
      console.log("Single Change");
      if (cb.checked && index == -1) {
        selectedFeatureIds.push(cb.value);
      } else if (!cb.checked && index != -1) {
        selectedFeatureIds.splice(index, 1);
      }
      //source調査地点.changed(); // レイヤ再描画
      if (tabルート作成) createRoute.autoCalculateDistance();
    }
  });
});

// ====================================================================
// 調査ルート作成　調査ルートツールチップ
// ツールチップ用の要素を作成
const tooltipElement = document.createElement('div');
tooltipElement.className = 'ol-tooltip';
tooltipElement.style.position = 'absolute';
tooltipElement.style.backgroundColor = '#FFFCA6';
tooltipElement.style.padding = '4px 8px';
tooltipElement.style.border = '1px solid #FFF837';
tooltipElement.style.borderRadius = '4px';
tooltipElement.style.whiteSpace = 'nowrap';
tooltipElement.style.pointerEvents = 'none';
tooltipElement.style.fontSize = '16px';

const tooltipOverlay = new ol.Overlay({
  element: tooltipElement,
  offset: [30, 0],
  positioning: 'center-left',
});

map.addOverlay(tooltipOverlay);

// マウス移動イベント
map.on('pointermove', function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    return feature;
  });

  if (feature) {
    const name = feature.get('name');
    if (name) {
      tooltipElement.innerHTML = name;
      tooltipOverlay.setPosition(evt.coordinate);
      tooltipElement.style.display = 'block';
    }
  } else {
    tooltipElement.style.display = 'none';
  }
});


// 登録方法　表示用
const getSpotTypeDisplay = (spottype) => {
  let text = spottype;
  text = text.replace('河川KP', 'KPデータ（河川）');
  text = text.replace('道路KP', 'KPデータ（道路）');
  return text;
};

// ====================================================================
// 防災ヘリ関連情報
// ====================================================================
// ※防災ヘリ関連情報部の再読み込み時にも設定を行う
function init防災ヘリ関連情報Layers() {
  const form防災ヘリ関連情報 = document.getElementById('form防災ヘリ関連情報');

  // 何らかの値を持っているチェックボックスについては単一項目とみなし、チェック状態変更に応じ表示更新
  form防災ヘリ関連情報.querySelectorAll('input[type="checkbox"]').forEach((check) => {
    if (check.value) {
      check.addEventListener('change', (e) => { show表示対象Features(); });
    }
  });
  // 「すべて選択」チェックボックスクリック時、data-target内のcheckboxを全反映する
  form防災ヘリ関連情報.querySelectorAll('input[type="checkbox"][name="chkすべて選択"][data-target]').forEach((cb) => {
    const exec全選択 = () => {
      const checked = cb.checked;
      const checkboxes = document.querySelector(cb.dataset.target).querySelectorAll('input[type="checkbox"][value]');
      checkboxes.forEach((check) => { if (check.value) { check.checked = checked; } });
      show表示対象Features();
    }
    cb.addEventListener('change', (e) => { exec全選択(); });
    // 初期状態で全選択チェック有ならばイベント設定時にも実施
    if (cb.checked) { exec全選択(); }
  })
  const routeColors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
    '#ff4500', '#2e8b57', '#daa520', '#1e90ff', '#ff1493',
    '#9400d3', '#00ced1', '#ff69b4', '#7cfc00', '#ffb6c1',
    '#20b2aa', '#dda0dd', '#cd853f', '#fafad2', '#b22222',
    '#98fb98', '#6b8e23', '#ffdead', '#191970', '#a9a9a9',
    '#ff6347', '#228b22', '#b8860b', '#4169e1', '#ff00ff',
    '#8a2be2', '#00ffff', '#ff1493', '#adff2f', '#ffc0cb',
    '#008b8b', '#ba55d3', '#d2691e', '#ffffe0', '#8b0000',
    '#90ee90', '#556b2f', '#ffe4b5', '#000080', '#c0c0c0',
    '#ff7f50', '#32cd32', '#ffd700', '#6495ed', '#db7093',
    '#9932cc', '#40e0d0', '#ff00ff', '#7fff00', '#ff69b4',
    '#48d1cc', '#ee82ee', '#a0522d', '#fffacd', '#dc143c',
    '#00fa9a', '#808000', '#ffdab9', '#00008b', '#696969',
    '#ff8c00', '#3cb371', '#f0e68c', '#4682b4', '#ff1493',
    '#9370db', '#00bfff', '#ff6eb4', '#9acd32', '#ffc1c1',
    '#008080', '#dda0dd', '#8b4513', '#fff8dc', '#b03060'
  ];
  const yoteiColor = new Map();
  var i = 0;
  form防災ヘリ関連情報.querySelectorAll('input[name="yotei"]').forEach((r) => {
    yoteiColor[r.value] = routeColors[i]; 
    addRouteToLegend(r.dataset.title, routeColors[i]);
    i++;
  });
  // チェック状態に応じた（調査依頼中／調査予定などの）対象地点一覧を表示
  const show表示対象Features = () => {
    const formData = new FormData(form防災ヘリ関連情報);
    // 調査依頼、および調査予定データをまとめて取得
    console.log("init防災ヘリ関連情報Layers.show表示対象Features")
    ajaxGetJson(base_url + '?Handler=Features&' + new URLSearchParams(formData).toString())
      .then((json) => {
        const spots = geojsonFormatter.readFeatures(json.spots);
        layer調査地点.getSource().clear();
        layer調査地点.getSource().addFeatures(spots);
        const routes = geojsonFormatter.readFeatures(json.routes);
        routes.forEach(r => {
          if (r.get('name') && r.get('id')) {
            const id = r.get('id');
            const name = r.get('name');
            r.set("color", yoteiColor[id]);
          }
        })
        layer調査ルート.getSource().clear();
        layer調査ルート.getSource().addFeatures(routes);
        //rebuildLegendFromLayer(layer調査ルート);
      }, showAlert);
  }

  // ---------------------------------------
  // 地図　凡例表示
  function addRouteToLegend(name, color) {
    const container = document.querySelector('.legend-section');

    const row = document.createElement('div');
    row.className = 'legend-route';

    row.innerHTML = `
      <span class="legend-line" style="border-top:3px dotted ${color};"></span>
      <span class="legend-label">${name}</span>
    `;

    container.appendChild(row);
  }

  // 初期化時にも読み込み
  show表示対象Features();
}

// **********************************************************************************************************
// **********************************************************************************************************
// **********************************************************************************************************
// タブ制御（※画面表示は#dispArea[data-bottomtab="(タブ名)"]で制御)
// **********************************************************************************************************
// **********************************************************************************************************
// **********************************************************************************************************

/**
 * 画面下部タブ共通：当該タブ表示時の地図上表示内容を設定する
 * @param {HTMLDivElement} tab 画面下部の表示対象タブ
 * @param {*} source調査地点
 * @param {*} source調査ルート
 */
function set調査地点Source(tab, source調査地点, source調査ルート) {
  map調査地点Source[tab.id] = source調査地点;
  map調査ルートSource[tab.id] = source調査ルート;
  if (dispArea.dataset.bottomtab == tab.id) {
    layer編集中調査地点.setSource(source調査地点);
    source調査地点.changed(); // レイヤ再描画
//    layer編集中調査ルート.setSource(source調査ルート);
    source調査ルート.changed(); // レイヤ再描画
  }
}

// --------------------------------
// タブ変更時に呼び出し
// --------------------------------
document.querySelectorAll('button[name="btnタブ選択"]').forEach((button) => {
  button.addEventListener('click', e => {
    // URL変更
    history.replaceState({}, '', `?tab=${button.value}`);
    // 未ログインならログインモーダル表示、ログイン済なら表示タブ切り替え
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement) {
      const modal = bootstrap.Modal.getOrCreateInstance(loginModalElement);
      modal.show();
    } else if (dispArea.dataset.bottomtab != button.value) {
console.log("TAB Change:" + button.value);
      // ログイン済なら表示タブ切り替え
      dispArea.dataset.bottomtab = button.value;
      const source調査地点 = map調査地点Source[button.value] ?? new ol.source.Vector();
      layer編集中調査地点.setSource(source調査地点);
      source調査地点.changed(); // レイヤ再描画
      const source調査ルート = map調査ルートSource[button.value] ?? new ol.source.Vector();
//      layer編集中調査ルート.setSource(source調査ルート);
      source調査ルート.changed(); // レイヤ再描画
      //TODO おそらくはinteraction停止が必要

      console.log("TAB Change:" + button.value);
      layer編集調査ルート.setVisible(button.value == "tabルート作成");

      kpManager.hideAllKPLayers();
    }
  });
});

/**
 * featureをもとに一覧明細行を作成します。featureのcheckboxプロパティには明細行のcheckboxオブジェクトを設定します。
 * @param {HTMLDivElement} tab 画面下部の表示対象タブ
 * @param {ol.Feature} feature 調査箇所のFeature
 * @returns {HTMLTableRowElement} 明細行
 */
function create明細行(tab, feature) {
  const /** 調査箇所id */ id = feature.get('id') ?? ''; //
  const /** 調査地点名 */ name = feature.get('name') ?? '';
  const /** 依頼者名 */ requester = feature.get('requester') ?? '';
  const /** 優先度 */ priority = feature.get('priority') ?? '';
  const /** 調査手法名 */ survey = feature.get('survey') ?? '';
  const /** 搭乗希望人数(0-8) */ persons = feature.get('persons') ?? '';
  const /** 登録方法 */ spottype = feature.get('spottype') ?? '';
  const /** 備考 */ remarks = feature.get('remarks') ?? ''; // ※特定初動調査でid指定有(調査地点相当)なら入力可にするかも？？？
  const /** 調査状況 */ status = feature.get('status') ?? ''; // 調査依頼状況タブのみ
  const /** 更新日時 */ updated = feature.get('updated') ?? '';

  const trElement = document.createElement('tr');
  trElement.classList.add('align-middle');
  trElement.dataset.irai = feature.get('irai'); // 調査依頼による絞り込みで参照
  trElement.dataset.priority = priority; // 優先度による絞り込みで参照
  trElement.dataset.persons = persons; // 搭乗人数による絞り込みで参照
  let innerHTML = '';

  // 先頭列（チェックボックス、ただし特定初動調査は巡回順テキスト表示）
  if (tab == tab特定初動調査) {
    innerHTML += `<td class="text-center">${feature.get('text')}</td>`;
  } else {
    innerHTML += `<td class="text-center"><input type="checkbox" name="id" value="${id}" class="form-check-input"></td>`;
  }
  // 地点名・依頼者
  innerHTML += `<td><input type="text" readonly class="py-0 my-0 form-control-plaintext" value="${htmlEncode(name)}"></td>`;
  innerHTML += `<td><input type="text" readonly class="py-0 my-0 form-control-plaintext" value="${htmlEncode(requester)}"></td>`;
  // 優先度
  innerHTML += `<td><div class="btn-group" name="input.prioritygroup">`;
  for (let value of ['高', '中', '低']) {
    const checked = (priority == value);
    innerHTML += `<button type="button" name="priority" value="${value}" class="btn btn-sm ${checked ? 'btn-primary' : 'btn-secondary'} ${checked ? '' : 'disabled'}">${value}</button>`;
  }
  innerHTML += `</div></td>`;
  // 調査手法・搭乗人数・登録方法・備考
  innerHTML += `<td class="text-center">${survey}</td>`;
  innerHTML += `<td class="text-center">${persons === 0 ? 'なし' : persons ? persons + '名' : ''}</td>`;
  innerHTML += `<td class="text-center">${getSpotTypeDisplay(spottype)}</td>`;
  innerHTML += `<td><input type="text" readonly class="py-0 my-0 form-control-plaintext" value="${htmlEncode(remarks)}"></td>`;
  if (tab == tab依頼状況) {
    innerHTML += `<td>${status}</td>`;
    innerHTML += `<td class="text-center">${updated}</td>`;
  }

  trElement.innerHTML = innerHTML;
  const checkbox = trElement.querySelector('input[type="checkbox"]');
  if (checkbox) { feature.set('checkbox', checkbox); }
  return trElement;
}

// 全タブ共通：全選択チェック変更⇒一覧のチェック状態に反映
//document.querySelectorAll('#bottomArea table>thead input[name="chk全選択"]').forEach((cb) => {
//  cb.addEventListener('change', (e) => {
//    const checked = cb.checked;
//    const checkboxes = cb.closest('table').querySelectorAll('tbody>tr:not(.d-none) input[type="checkbox"][name="id"]:not(:disabled)');
//    checkboxes.forEach((cb) => {
//      cb.checked = checked;
//      const index = selectedFeatureIds.indexOf(cb.value);
//      console.log("All Change");
//      if (cb.checked && index == -1) {
//        selectedFeatureIds.push(cb.value);
//      } else if (!cb.checked && index != -1) {
//        selectedFeatureIds.splice(index, 1);
//      }
//    });
//    //source調査地点.changed(); // レイヤ再描画
//  });
//});
//// 全タブ共通：一覧チェック変更⇒選択状態を変更し画面に反映
//document.querySelectorAll('#bottomArea table>tbody').forEach((tbody) => {
//  tbody.addEventListener('change', (e) => {
//    const cb = (e.target.type == 'checkbox' && e.target.name == 'id') ? e.target : e.target.closest('input[type="checkbox"][name="id"]');
////    if (cb) {
////      layer編集中調査地点.getSource().changed();
////    }
//    if (cb) {
//      const index = selectedFeatureIds.indexOf(cb.value);
//      console.log("Single Change");
//      if (cb.checked && index == -1) {
//        selectedFeatureIds.push(cb.value);
//      } else if (!cb.checked && index != -1) {
//        selectedFeatureIds.splice(index, 1);
//      }
//      //source調査地点.changed(); // レイヤ再描画
//    }
//
//  });
//});


// ====================================================
// 調査依頼タブ
// ====================================================
function init調査依頼タブ() {
  const source調査地点 = new ol.source.Vector();
  set調査地点Source(tab調査依頼, source調査地点, new ol.source.Vector());
  const tbody調査依頼 = document.querySelector('#table調査依頼>tbody');

  // 一時保存チェックボックス→一時保存調査箇所呼び出しの選択肢
  const form防災ヘリ関連情報 = document.getElementById('form防災ヘリ関連情報');
  const array一時保存Chk = Array.from(form防災ヘリ関連情報.querySelectorAll('#left調査依頼一時保存 input[type="checkbox"][value]'));
  document.getElementById('sel一時保存調査依頼').innerHTML = array一時保存Chk.map((cb) => `<option value="${cb.value}">${cb.dataset.name}</option>`).join('');
  document.querySelector('button[data-bs-target="#modal調査依頼呼び出し"]').disabled = array一時保存Chk.length == 0;

  /**
   * 調査依頼共通：調査依頼一覧の行に指定されたfeatureを追加します
   * @param {ol.Feature} feature 調査箇所のFeature
   * @returns {HTMLTableRowElement} 調査依頼行
   */
  const create調査依頼行 = (feature) => {
    let /** 調査箇所id */ featureId = feature.get('id');
    if (!featureId) {
      // featureに付与する連番（関数のプロパティで管理）をマイナス値で採番（正式にDB保存されたfeatureは正値、ここで識別可能とする）
      featureId = create調査依頼行.featureId || 0;
      featureId--;
      create調査依頼行.featureId = featureId;
    }
    feature.setId(`${featureId}`); // 削除時のkeyとしてもつかうので

    const /** 調査地点名 */            name        = feature.get('name') ?? '';
    const /** 依頼者名 */              requester   = feature.get('requester') ?? '';
    const /** 優先度 */                priority    = feature.get('priority') ?? '';
    const /** 調査手法名 */            survey      = feature.get('survey') ?? '';
    const /** 搭乗希望人数(0-8) */     persons     = feature.get('persons') ?? '';
    const /** 登録方法 */              spottype    = feature.get('spottype') ?? '';
    const /** 備考 */                  remarks     = feature.get('remarks') ?? '';
    const /** 更新日時 */              updated     = feature.get('updated') ?? '';
    const spottype_display = getSpotTypeDisplay(spottype);
    let surveys = [];
    if (spottype == '点') {
      surveys.push('通過');
      surveys.push('周回');
    } else {
      surveys.push('通過');
    }

    const geometry = feature.getGeometry();
    const trElement = document.createElement('tr');
    trElement.classList.add('align-middle');
    // 先頭列（チェックボックス）・地点名・依頼者
    let innerHTML = `
      <td class="text-center"><input type="checkbox" name="id" value="${featureId}" class="form-check-input"></td>
      <td><input type="text" name="input.name" class="form-control form-control-sm" maxlength="50" value="${htmlEncode(name)}"></td>
      <td><input type="text" readonly class="py-0 my-0 form-control-plaintext" value="${htmlEncode(requester)}"></td>`;
    // 優先度
    innerHTML += `<td><div class="btn-group" name="input.prioritygroup">`;
    for (let value of ['高', '中', '低']) {
      innerHTML += `<button type="button" name="priority" value="${value}" class="btn btn-sm ${priority == value ? 'btn-primary' : 'btn-secondary'}">${value}</button>`;
    }
    innerHTML += `</div><input type="hidden" name="input.priority" value="${priority}"></td>`;
    // 調査手法名
    innerHTML += `<td><select name="input.survey" class="form-select form-select-sm">`;
    for (let value of surveys) {
      innerHTML += `<option value="${value}" ${value == survey ? 'selected' : ''}>${value}</option>`;
    }
    innerHTML += `</select></td>`;
    // 搭乗人数
    innerHTML += `<td><select name="input.persons" class="form-select form-select-sm">`;
    for (let i = 0; i <= 8; i++) {
      innerHTML += `<option value="${i}" ${i == persons ? 'selected' : ''}>${i == 0 ? 'なし' : i + '名'}</option>`;
    }
    innerHTML += `</select></td>`;
    // 登録方法（およびジオメトリ）・備考・更新日時
    innerHTML += `<td class="text-center">${spottype_display}<input type="hidden" name="input.spottype" value="${spottype}">
      <input type="hidden" name="input.geometry" value="${htmlEncode(geojsonFormatter.writeGeometry(geometry))}"></td>`;
    innerHTML += `<td><input type="text" name="input.remarks" maxlength="100" class="form-control form-control-sm" value="${htmlEncode(remarks)}"></td>`;
    innerHTML += `<td>${updated || ' '}</td>`;
    trElement.innerHTML = innerHTML;

    // チェックボックスをfeatureのプロパティとして設定
    const checkbox = trElement.querySelector('input[type="checkbox"]');
    feature.set('checkbox', checkbox);
    // 優先度変更時に表示更新＆hidden項目へ値反映
    const priorityButtons = trElement.querySelectorAll('button[name="priority"]');
    priorityButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        const newValue = button.value;
        trElement.querySelector('input[type="hidden"][name="input.priority"]').value = newValue;
        priorityButtons.forEach((button) => {
          const checked = (button.value == newValue);
          button.classList.add(checked ? 'btn-primary' : 'btn-secondary');
          button.classList.remove(checked ? 'btn-secondary' : 'btn-primary');
        });
      });
    });
    return trElement;
  };

  /**
   * 調査依頼タブの表示内容を初期化します。引数が指定された場合その内容を読み込みます。
   * @param {Number} [tempid] 一時保存を呼び出す場合は、一時保存された調査依頼id
   */
  const init調査依頼編集 = (tempid) => {
    source調査地点.clear();
    tbody調査依頼.innerHTML = '';
    if (tempid) {
      ajaxExecute(base_url + `?Handler=SurveyRequest&id=${tempid}&status=0`, {},
        { title: '一時保存ルート呼出・削除' }
      ).then((json) => {
        form調査依頼.querySelector('input[name="tempid"]').value = tempid;
        modal調査依頼登録Element.querySelector('input[name="input.title"]').value = json.title;
        const features = geojsonFormatter.readFeatures(json.features);
        features.forEach((f) => {
          const trElement = create調査依頼行(f);
          tbody調査依頼.appendChild(trElement);
        });
        source調査地点.addFeatures(features);
      }, () => { });
    } else {
      form調査依頼.querySelector('input[name="tempid"]').value = '';
      modal調査依頼登録Element.querySelector('input[name="input.title"]').value = '';
    }
  };

  /**
   * 調査依頼一覧：調査地点追加のUIを起動
   * @param {string|null} drawType 追加する調査地点の種類(Point/LineString)、UIを停止する場合はnull等の値
   */
  const start追加地点指定 = (drawType) => {
    const toast調査地点追加Element = document.getElementById('toast調査地点追加');
    displayingToast = bootstrap.Toast.getOrCreateInstance(toast調査地点追加Element);
    displayingToast.hide();
    if (mapDraw) {
      map.removeInteraction(mapDraw);
      mapDraw = null;
    }

    // 距離標ダイアログ　初期化
    kpManager.hideModal();

    mapKPSource.clear();

    if (drawType == 'LineString' || drawType == 'Point') {
      // 描画オブジェクトを初期化して設定
      mapDraw = new ol.interaction.Draw({
        type: drawType,
        condition: (e) => { return e.originalEvent.button !== 2; }// 右クリックは描画進行イベントとはしない
        //style: openlayersデフォルトのものとする
      });
      mapDraw.on('drawend', function (e) {
        // 指定終了時にレイヤ/一覧へ描画内容追加
        e.feature.set('color', '#FF0000');
        e.feature.set('requester', toast調査地点追加Element.dataset.requester);
        e.feature.set('survey', drawType == 'LineString' ? '通過' : '周回');
        e.feature.set('spottype', drawType == 'LineString' ? '線' : '点');
        const trElement = create調査依頼行(e.feature);
        // 追加行のみを選択状態とし、フォーカスする
        tbody調査依頼.appendChild(trElement);
        trElement.scrollIntoView();
        tbody調査依頼.querySelectorAll('input[type="checkbox"][name="id"]').forEach((cb) => cb.checked = (cb.value == e.feature.getId()));
        trElement.querySelector('input[name="input.name"]').focus();
        // 地図上の選択状態も同期をとって変更
        console.log(e.feature);
        source調査地点.addFeature(e.feature); // レイヤ再描画
        start追加地点指定(null);
      });
      // 描画による位置指定開始
      map.addInteraction(mapDraw);
      // Toastも表示(drawTypeに応じた説明文のブロックを表示ありにする)
      document.querySelectorAll('#toast調査地点追加 span[data-type]').forEach((element) => element.classList.add('d-none'));
      document.querySelector(`#toast調査地点追加 span[data-type="${drawType}"]`).classList.remove('d-none');
      displayingToast.show();
    // KPデータ（河川）から登録
    } else if (drawType == 'River') {
      kpManager.showModal(drawType);
    // KPデータ（道路）から登録
    } else if (drawType == 'Road') {
      kpManager.showModal(drawType);
    }
  };
  // 調査依頼一覧：調査地点追加のドロップダウンボタンクリック時、調査地点追加のUIを起動
  document.querySelectorAll('button[name="btn調査地点追加"]').forEach((button) => {
    button.addEventListener('click', (e) => start追加地点指定(button.value));
  });

  // 調査依頼一覧：調査地点削除ボタンクリックで確認の上地点削除
  document.querySelector('button[name="btn調査地点削除"]').addEventListener('click', async (e) => {
    const checkboxes = tbody調査依頼.querySelectorAll('input[type="checkbox"][name="id"]:checked');
    if (!checkboxes.length) {
      showAlert('調査依頼地点の削除', '削除したい地点をチェック選択してください。');
      return;
    }
    if (await showConfirm('調査依頼地点の削除', 'チェックしている地点を削除します。よろしいですか？', { okButtonName: '削除' })) {
      checkboxes.forEach((cb) => {
        const feature = source調査地点.getFeatureById(cb.value);
        source調査地点.removeFeature(feature);
        cb.closest('tr').remove()
      });
    }
  });

  // 調査依頼一覧：調査依頼登録(一時保存ボタンも同一処理、モーダルの文言等の情報はボタンのdata項目等より取得)
  const form調査依頼 = document.getElementById('form調査依頼');
  const modal調査依頼登録Element = document.getElementById('modal調査依頼登録');
  const btn調査依頼登録実行 = modal調査依頼登録Element.querySelector('button[value="register"]');
  document.querySelectorAll('button[name="btn調査依頼登録"]').forEach((button) => {
    button.addEventListener('click', (e) => {
      form調査依頼.querySelector('input[name="mode"]').value = 'check';
      const formData = new FormData(form調査依頼);
      console.log(form調査依頼.action);
      ajaxExecute(form調査依頼.action,
        { method: 'POST', body: formData },
        { title: button.dataset.modaltitle, form: form調査依頼 }
      ).then((response) => {
        // 一覧入力内容チェックOKなら依頼名入力モーダルを表示
        modal調査依頼登録Element.querySelector('.modal-title').innerHTML = button.dataset.modaltitle;
        modal調査依頼登録Element.querySelector('.modal-body>div:first-child').innerHTML = button.dataset.modalcaption;
        btn調査依頼登録実行.innerHTML = button.dataset.modalbutton;
        const modal = bootstrap.Modal.getOrCreateInstance(modal調査依頼登録Element);
        modal.show();
        form調査依頼.querySelector('input[name="mode"]').value = button.value;
      }, () => { });
    });
  });
  btn調査依頼登録実行.addEventListener('click', async (e) => {
    const formData = new FormData(form調査依頼);
    formData.append('input.title', modal調査依頼登録Element.querySelector('input[name="input.title"]').value);
    ajaxExecute(form調査依頼.action,
      { method: 'POST', body: formData },
      { title: e.target.innerHTML, form: modal調査依頼登録Element }
    ).then(async (response) => {
      // 登録成功で画面リロード
      location.href = `?`;
    }, () => { });
  });

  // 一時保存調査依頼に対する操作各種
  const modal調査依頼呼び出しElement = document.getElementById('modal調査依頼呼び出し');
  document.getElementById('btn一時保存調査依頼呼出').addEventListener('click', async (e) => {
    if (source調査地点.getFeatures().length
      && await showConfirm('一時保存調査箇所呼出・削除',
        '現在表示されている調査依頼が保存されていません。'
        + '\n保存前に呼出を実施すると現在表示されているデータが失われますが、呼出を続けてよろしいでしょうか？') != true
    ) {
      return;
    }
    init調査依頼編集(document.getElementById('sel一時保存調査依頼').value);
    bootstrap.Modal.getOrCreateInstance(modal調査依頼呼び出しElement).hide();
  });
  document.getElementById('btn一時保存調査依頼削除').addEventListener('click', async (e) => {
    if (await showConfirm('一時保存調査箇所呼出・削除', '選択した調査依頼を削除します。\n本当によろしいでしょうか？') != true) {
      return;
    }
    const formData = new FormData(modal調査依頼呼び出しElement);
    ajaxExecute(modal調査依頼呼び出しElement.action,
      { method: 'POST', body: formData },
      { title: '一時保存調査箇所呼出・削除' }
    ).then((response) => {
      location.href = `?tab=tab調査依頼`;
    }, () => { });
  });
  // ---------------------------------------------
  // 距離標から調査依頼行を作成
  function create調査依頼行FromKP(kpResult) {
    const feature = kpResult.feature;
    const toast調査地点追加Element = document.getElementById('toast調査地点追加');
    feature.set('name', kpResult.selRoadRiver + ' ' + kpResult.startKp + 'Kp - ' + kpResult..endKp + 'Kp');
    feature.set('color', '#FF0000');
    feature.set('requester', toast調査地点追加Element.dataset.requester);
    feature.set('survey', '通過');
    feature.set('spottype', feature.get('drawType') == 'River' ? '河川KP' : '道路KP');
    feature.set('inputMode', 'KP');
    const trElement = create調査依頼行(feature);
    tbody調査依頼.appendChild(trElement);
    source調査地点.addFeature(feature);
    trElement.scrollIntoView();
    tbody調査依頼.querySelectorAll('input[type="checkbox"][name="id"]').forEach((cb) => cb.checked = (cb.value == feature.getId()));
    trElement.querySelector('input[name="input.name"]').focus();
    // 地図上の選択状態も同期をとって変更
    source調査地点.addFeature(feature);
    start追加地点指定(null);
  }
  return {
    create調査依頼行FromKP
  }
}

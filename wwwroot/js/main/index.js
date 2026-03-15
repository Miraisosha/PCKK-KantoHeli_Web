'use strict';
import { KPManager } from './kp/kpManager.js';
import { initDistanceMeasure } from './distance/Measure.js';
import { Capital } from './tabs/Capital.js';
import { InvestigationRequestStatus } from './tabs/InvestigationRequestStatus.js';
import { CreateRoute } from './tabs/CreateRoute.js';
import { SurveyRequest } from './tabs/SurveyRequest.js';
import { HeliInfo } from './leftMenu/HeliInfo.js';
import { Intensity } from './leftMenu/Intensity.js';
import { HeliPort } from './leftMenu/HeliPort.js';
import { Dropdown } from './leftMenu/Dropdown.js';
import { Intensity as IntensityLayer } from './Layers/Intensity.js';
import { HeliPort as HeliPortLayer } from './Layers/HeliPort.js';
import { EditRoute as EditRouteLayer } from './Layers/EditRoute.js';
import { CapitalRoute as CapitalRouteLayer } from './Layers/CapitalRoute.js';
import { SurveyRoute as SurveyRouteLayer } from './Layers/SurveyRoute.js';

const base_url = location.origin + location.pathname;
const segments = location.pathname.split("/").filter(Boolean);
const threadId = segments[segments.length - 1];
const appName = segments.length > 2 ? `/${segments[0]}` : '';
const root_url = location.origin + appName;


// 地図表示（以下の順にレイヤを作成・追加する
const map = window.app.map;
// 地図に対する描画操作（地点追加等）
let /** @type{ol.interaction.Draw?} */ mapDraw = null;

// 選択中状態で表示すべきfeatureのidの一覧
let selectedFeatureIds = [];

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

// ============================================================================
// LAYER定義
const layer調査地点 = SurveyRouteLayer().getSpotLayer();
//const layerLeft調査地点 = createLeftSpotLayer(map);
const layer調査ルート = SurveyRouteLayer().getLayer();
const layer市区町村震度 = IntensityLayer().getLayer();
const layerヘリポート = HeliPortLayer().getLayer(map);

// ---------------------------------------------
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

const layer初動調査ルート = CapitalRouteLayer().getLayer();
const layer編集中調査地点 = SurveyRouteLayer().getSpotLayer();;
//const layer編集中調査ルート = createRouteLayer(map);
const map調査地点Source = {};
const map調査ルートSource = {};
// 調査ルート作成　（編集中）
const layer編集調査ルート = EditRouteLayer().getLayer();

// ---------------------------------------------
// レイヤーの順序
map.addLayer(layer市区町村震度);
map.addLayer(layer調査ルート);
map.addLayer(layer調査地点);
map.addLayer(layerヘリポート);
map.addLayer(layerKPLine河川     );
map.addLayer(layerKPLine道路     );
map.addLayer(layerKP河川         );
map.addLayer(layerKP道路         );
map.addLayer(layerSelectionKP    );
map.addLayer(layerSelectedKPLine );
map.addLayer(layer初動調査ルート);
//map.addLayer(layerLeft調査地点);
map.addLayer(layer編集中調査地点);
map.addLayer(layer編集調査ルート);

// ============================================================================
// 共通で使用する関数
// ---------------------------------------------
// 調査依頼　距離標入力
const kpManager = KPManager({
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
});

// ---------------------------------------------
// 調査依頼タブ
const surveyRequest = SurveyRequest({
  map,
  mapDraw,
  base_url,
  geojsonFormatter,
  ajaxExecute,
  showAlert,
  showConfirm,
  kpManager,
  set調査地点Source,
  tab調査依頼,
  mapKPSource,
  htmlEncode
});
surveyRequest.initialize();
kpManager.setOnConfirm((kpResult) => {
  surveyRequest.create調査依頼行FromKP(kpResult);
});
surveyRequest.setMapDraw(mapDraw);

// ---------------------------------------------
// 左メニュー
// 距離計測
const distance = initDistanceMeasure({ map });

const heliInfo = HeliInfo({
  base_url,
  geojsonFormatter,
  ajaxGetJson,
  showAlert,
  layer調査地点,
  layer調査ルート
});
heliInfo.initialize();
heliInfo.showFeatures();

const intensity = Intensity({
  root_url,
  layerCity: layer市区町村震度,
});
intensity.initialize();

const heliPort = HeliPort({
  root_url,
  layerHeliPort: layerヘリポート,
});
heliPort.initialize();

const dropdown = Dropdown({
  base_url,
  root_url,
  locationReload,
});
dropdown.initialize();

const requestStatus = InvestigationRequestStatus({
  base_url,
  locationReload,
  tab依頼状況,
  set調査地点Source,
  geojsonFormatter,
  ajaxExecute,
  showAlert,
  showConfirm
});
requestStatus.initialize();
requestStatus.reload();
// ---------------------------------------------
// 首都直下初動
const capital = Capital({
  base_url,
  locationReload,
  tabElement: tab特定初動調査,
  layerRoute : layer初動調査ルート,
  set調査地点Source,
  ajaxExecute,
  geojsonFormatter,
//  createDetailRecord: (tab, feature) => {
//    create明細行(tab, feature);
//  }
})
if (loginUser.isRouteCreate) {
  capital.initialize();
}
// ---------------------------------------------
// 調査ルート作成
const createRoute = CreateRoute({
  base_url,
  locationReload,
  tabElement: tabルート作成,
  map,
  mapDraw,
  layer: layer編集調査ルート,
  set調査地点Source,
  ajaxExecute,
  geojsonFormatter,
  showAlert,
  showConfirm,
  proj3857,
  proj4326,
  getSelectedFeatureIds: () => selectedFeatureIds,
  setSelectedFeatureIds: (v) => {
    selectedFeatureIds = [];
    v.forEach((id) => selectedFeatureIds.push(Number(id)));
  },
  reverseSelectedFeatureIds: () => { selectedFeatureIds.reverse() },
});
if (loginUser.isRouteCreate) {
  createRoute.initialize();
}

// ============================================================================
// 共通イベント
// ---------------------------------------------
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
      return true;
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

// ---------------------------------------------
// 全タブ共通：全選択チェック変更⇒一覧のチェック状態に反映
document.querySelectorAll('#bottomArea table>thead input[name="chk全選択"]').forEach((a) => {
  a.addEventListener('change', (e) => {
    console.log('chk全選択 change>>>>>>>>>>', a.checked);
    const checked = a.checked;
    const checkboxes = a.closest('table').querySelectorAll('tbody>tr:not(.d-none) input[type="checkbox"][name="id"]:not(:disabled)');
    checkboxes.forEach((cb) => {
      cb.checked = checked;
      const id = Number(cb.value);
      const index = selectedFeatureIds.indexOf(id);
      if (cb.checked && index == -1) {
        selectedFeatureIds.push(id);
      } else if (!cb.checked && index != -1) {
        selectedFeatureIds.splice(index, 1);
      }
    });
    //source調査地点.changed(); // レイヤ再描画
    if (tabルート作成 && dispArea.dataset.bottomtab == 'tabルート作成') createRoute.autoCalculateDistance();
  });
});
// ---------------------------------------------
// 全タブ共通：一覧チェック変更⇒選択状態を変更し画面に反映
document.querySelectorAll('#bottomArea table>tbody').forEach((tbody) => {
  tbody.addEventListener('change', (e) => {
    console.log('Table Row change>>>>>>>>>>');
    const cb = (e.target.type == 'checkbox' && e.target.name == 'id') ? e.target : e.target.closest('input[type="checkbox"][name="id"]');
    //    if (cb) {
    //      layer編集中調査地点.getSource().changed();
    //    }
    if (cb) {
      const id = Number(cb.value);
      const index = selectedFeatureIds.indexOf(id);
      if (cb.checked && index == -1) {
        selectedFeatureIds.push(id);
      } else if (!cb.checked && index != -1) {
        selectedFeatureIds.splice(index, 1);
      }
      //source調査地点.changed(); // レイヤ再描画
    if (tabルート作成 && dispArea.dataset.bottomtab == 'tabルート作成') createRoute.autoCalculateDistance();
    }
  });
});

// ---------------------------------------------
// 調査ルート作成　調査ルートツールチップ
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

// ---------------------------------------------
function tabChange(tab) {
  dispArea.dataset.bottomtab = tab;

  // クリア
  kpManager.hideAllKPLayers();

  const source調査地点 = map調査地点Source[tab] ?? new ol.source.Vector();
  layer編集中調査地点.setSource(source調査地点);
  source調査地点.changed(); // レイヤ再描画
  const source調査ルート = map調査ルートSource[tab] ?? new ol.source.Vector();
  source調査ルート.changed(); // レイヤ再描画

  switch (tab) {
    case "tab調査依頼":
      layer初動調査ルート.setVisible(false);
      layer編集調査ルート.setVisible(false);
      surveyRequest.show();
      break;
    case "tab依頼状況" :
      layer初動調査ルート.setVisible(false);
      layer編集調査ルート.setVisible(false);
      break;
    case "tab特定初動調査" :
      capital.show();
      layer初動調査ルート.setVisible(true);
      layer編集調査ルート.setVisible(false);
      break;
    case "tabルート作成" :
      layer初動調査ルート.setVisible(false);
      layer編集調査ルート.setVisible(true);
      break;
    default: return;
  }
}

// ---------------------------------------------
// タブ 選択ボタンクリックイベント
document.querySelectorAll('button[name="btnタブ選択"]').forEach((button) => {
  console.log('addEventListener', button.value);
  button.addEventListener('click', e => {
    console.log('tab click', button.value);

    // 未ログイン
    // ログインモーダル表示、ログイン済なら表示タブ切り替え
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement) {
      const modal = bootstrap.Modal.getOrCreateInstance(loginModalElement);
      modal.show();
      return;
    }

    if (dispArea.dataset.bottomtab != button.value) tabChange(button.value);

    // リロードURL変更
    history.replaceState({}, '', `?tab=${button.value}`);
  });
});
// ---------------------------------------------
// 画面下部タブ共通：当該タブ表示時の地図上表示内容を設定する
function set調査地点Source(tab, source調査地点, source調査ルート) {
  map調査地点Source[tab.id] = source調査地点;
  map調査ルートSource[tab.id] = source調査ルート;
  if (dispArea.dataset.bottomtab == tab.id) {
    layer編集中調査地点.setSource(source調査地点);
    layer編集調査ルート.setSource(source調査ルート); 
    source調査地点.changed(); // レイヤ再描画
    source調査ルート.changed(); // レイヤ再描画
  }
}

// ---------------------------------------------
// 凡例
const legend = document.getElementById("mapLegend");
const btnLegend = document.getElementById("btnLegend");
const closeBtn = legend.querySelector(".legend-close");
const header = legend.querySelector(".legend-header");
legend.classList.add("hidden");

function showLegend() {
  const rect = btnLegend.getBoundingClientRect();
  legend.classList.remove("hidden");

//  console.log(rect);
//  console.log(legend.offsetWidth, legend.offsetHeight);
//  legend.style.left = (rect.left - legend.offsetWidth -300 ) + "px";
//  legend.style.top = (rect.top - legend.offsetHeight - 200) + "px";
//  console.log(legend.style);

  btnLegend.style.display = "none";
}
function hideLegend() {
  legend.classList.add("hidden");
  btnLegend.style.display = "block";
}
// 凡例表示
btnLegend.addEventListener("click", () => { showLegend(); });

// 凡例閉じる
closeBtn.addEventListener("click", () => { hideLegend(); });


//// ---- ドラッグ ----
//let dragging = false;
//let offsetX = 0;
//let offsetY = 0;
//header.addEventListener("mousedown", (e) => {
//  dragging = true;
//  const rect = legend.getBoundingClientRect();
//  offsetX = e.clientX - rect.left;
//  offsetY = e.clientY - rect.top;
//  legend.style.right = "auto";
//  legend.style.bottom = "auto";
//});
//document.addEventListener("mousemove", (e) => {
//  if (!dragging) return;
//  legend.style.left = (e.clientX - offsetX) + "px";
//  legend.style.top = (e.clientY - offsetY) + "px";
//});
//document.addEventListener("mouseup", () => {
//  dragging = false;
//});
function locationReload() {
  location.href = location.origin + location.pathname + '?tab=' + dispArea.dataset.bottomtab;
}

tabChange(dispArea.dataset.bottomtab);

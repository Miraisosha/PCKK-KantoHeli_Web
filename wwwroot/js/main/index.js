'use strict';
{
  // タブ・ないしタブ間での相互連携があるelement定義
  const dispArea = document.getElementById("dispArea");
  const tab特定初動調査 = document.getElementById("tab特定初動調査");
  const tab調査依頼 = document.getElementById("tab調査依頼");
  const tab依頼状況 = document.getElementById("tab依頼状況");
  const tabルート作成 = document.getElementById('tabルート作成');

  // =====================================================================
  // 地図表示（以下の順にレイヤを作成・追加する（レイヤ作成処理は後ろで宣言する関係でfunctionとして定義しホイスティング））
  // =====================================================================
  const map = createMap(document.getElementById('map'), document.getElementById('sel背景地図選択'));

  // 選択中状態で表示すべきfeatureのidの一覧
  let selectedFeatureIds = [];

  // 災害関連情報
  init市区町村震度Layer();
  init事前情報Layers();

  // 防災ヘリ関連情報
  const layer調査地点 = createSpotLayer(map);
  const layer調査ルート = createRouteLayer(map);
  init防災ヘリ関連情報Layers();
  const layerKPLine河川 = createKPLineRiver(map);
  const layerKPLine道路 = createKPLineRoad(map);
  const layerKP河川 = createKPRiver(map);
  const layerKP道路 = createKPRoad(map);
  const layerSelectionKP = createSelectionKPLayer(map);
  const mapKPSource = new ol.source.Vector();
  const mapKPSource河川 = setKPSource('River');
  const mapKPSource道路 = setKPSource('Road');
  layerKP河川.setSource(mapKPSource河川);
  layerKP道路.setSource(mapKPSource道路);
  layerSelectionKP.setSource(mapKPSource);

  // タブ
  const layer編集中調査地点 = createSpotLayer(map);
  const layer編集中調査ルート = createRouteLayer(map);
  const /** @type{Map<string, ol.source.Vector>} */ map調査地点Source = {};
  const /** @type{Map<string, ol.source.Vector>} */ map調査ルートSource = {};

  init調査依頼タブ();
  init依頼状況タブ();
  if (tab特定初動調査) {
    init特定初動調査タブ();
  }
  if (tabルート作成) {
    initルート作成タブ();
  }

  // 地図に対する描画操作（地点追加等）
  let /** @type{ol.interaction.Draw?} */ mapDraw = null;
  // 何らかの表示中のtoast
  let /** @type{bootstrap.Toast?} */ displayingToast = null;

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
      } else if (layer === layerKP河川) {
        onKPLayer_Click(feature);
      } else if (layer === layerKP道路) {
        onKPLayer_Click(feature);
      }
      //TODO それ以外の選択処理
    });
  });

  /**
   * 河川距離標・道路距離標　マウスオーバーイベント
   */
  let overFeature = null;
  map.on('pointermove', function (evt) {
    if (evt.dragging) return;

    const feature = map.forEachFeatureAtPixel(
      evt.pixel,
      (feature, layer) => {
        feature._hoverLayer = layer;
        return feature;
      },
      { layerFilter: l => l === layerKP河川 ||  l === layerKP道路 }
    );

    // マウスアウト
    if (overFeature && overFeature !== feature) {
      onMouseOut(overFeature);
      overFeature = null;
    }

    // マウスオーバー
    if (feature && feature !== overFeature) {
      if (feature._hoverLayer === layerKP河川) {
        onMouseOverKPRiver(feature);
      } else if (feature._hoverLayer === layerKP道路) {
        onMouseOverKPRoad(feature);
      }
      overFeature = feature;
    }
    const hit = map.hasFeatureAtPixel(evt.pixel);
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
  });


  // 共通：右クリックでLineString等描画のundo
  map.getViewport().addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (mapDraw != null) {
      mapDraw.removeLastPoint();
    }
  });

  /**
   * ********************************************************************************************
   * ********************************************************************************************
   * ********************************************************************************************
   * ********************************************************************************************
   * 距離標レイヤ　クリック
   * ********************************************************************************************
   * ********************************************************************************************
   * ********************************************************************************************
   * ********************************************************************************************
   * @param {any} feature
   */
  const onKPLayer_Click = (feature) => {
    const geom = feature.getGeometry();

    const features = mapKPSource.getFeatures();
    const cnt = features.length;
    const existing = features.find(f =>
      f.get('srcFeature') === feature
    );
    if (existing) {
      mapKPSource.removeFeature(existing);
      if (mapKPSource.getFeatures().length == 0) {
        if (feature._hoverLayer === layerKP河川) {
          layerKP河川.setStyle(styleKPRiver);
          layerKPLine河川.setStyle(styleKPLineRiver);
        } else if (feature._hoverLayer === layerKP道路) {
          layerKP道路.setStyle(styleKPRiver);
          layerKPLine道路.setStyle(styleKPLineRiver);
        }
      }
      return;
    }

    if (cnt == 0) {
      const selectedFeature = new ol.Feature({ geometry: new ol.geom.Point(geom.getCoordinates()) });
      selectedFeature.set('srcFeature', feature);
      mapKPSource.addFeature(selectedFeature);
      if (feature._hoverLayer === layerKP河川) {
        let suikei = feature.get('水系名');
        let kasen = feature.get('河川名');
        let sayugan = feature.get('左右岸');
        layerKP河川.setStyle(function (f) {
          if ((suikei != '' && f.get('水系名')) && (kasen != '' && f.get('河川名') == kasen) && (sayugan != '' && f.get('左右岸') == sayugan)) {
            return styleKPRiver(f);
          } else {
            return null;
          }
        });
        layerKPLine河川.setStyle(function (f) {
          if ((suikei != '' && f.get('水系名')) && (kasen != '' && f.get('河川名') == kasen) && (sayugan != '' && f.get('左右岸') == sayugan)) {
            return styleKPLineRiver(f);
          } else {
            return null;
          }
        });
      } else if (feature._hoverLayer === layerKP道路) {
        let syubetsu = feature.get('道路種別');
        let rosen = feature.get('路線');
        let genkyu = feature.get('現旧新区分');
        let jyoge = feature.get('上下区分');
        layerKP道路.setStyle(function (f) {
          if ((syubetsu != '' && f.get('道路種別') == syubetsu) && (rosen != '' && f.get('路線') == rosen) && (genkyu != '' && f.get('現旧新区分') == genkyu) && (jyoge != '' && f.get('上下区分'))) {
            return styleKPRiver(f);
          } else {
            return null;
          }
        });
        layerKPLine道路.setStyle(function (f) {
          if ((syubetsu != '' && f.get('道路種別') == syubetsu) && (rosen != '' && f.get('路線') == rosen) && (genkyu != '' && f.get('現旧新区分') == genkyu) && (jyoge != '' && f.get('上下区分'))) {
            return styleKPLineRiver(f);
          } else {
            return null;
          }
        });
      }
    } else if (cnt == 1) {
      const selectedFeature = new ol.Feature({ geometry: new ol.geom.Point(geom.getCoordinates()) });
      selectedFeature.set('srcFeature', feature);
      mapKPSource.addFeature(selectedFeature);

      let kp_name = ''
      if (feature._hoverLayer === layerKP河川) {
        kp_name = '距離標';
      } else if (feature._hoverLayer === layerKP道路) {
        kp_name = '地点標名称'
      }
      const kp = mapKPSource.getFeatures().map(f => {
        const src = f.get('srcFeature');
        return src?.get(kp_name);
      });
    }
  };

  // ====================================================================
  // リアルタイム情報表示
  // ====================================================================
  function init市区町村震度Layer() {
    const left市区町村震度Element = document.getElementById('left市区町村震度');
    // レイヤ作成
    const layer市区町村震度 = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: (feature, resolution) => {
        const rgb = feature.get('rgb');
        return new ol.style.Style({
          fill: new ol.style.Fill({ color: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.6)` }),
          stroke: new ol.style.Stroke({ color: '#00008888', width: 1 }),
        });
      },
    });
    map.addLayer(layer市区町村震度);
    // EventStreamで更新情報を受け取り
    const realtimeEventSource = new EventSource('?Handler=RealTimeInfoStream');
    realtimeEventSource.onmessage = (e) => {
      const json = JSON.parse(e.data);
      // html表示内容を差し替え
      left市区町村震度Element.innerHTML = !json.earthquaks.length
        ? `<div>　直近の地震情報がありません。</div>`
        : json.earthquaks.map((item) => {
          // （現在選択中なら選択中状態を維持）
          const oldChecked = !!left市区町村震度Element.querySelector(`input[type="checkbox"][name="quake"][value="${item.id}"]:checked`);
          return `<div><label class="form-check">`
            + `<input class="form-check-input" type="checkbox" name="quake" value="${item.id}" ${oldChecked ? ' checked' : ''}>`
            + ` <span class="form-check-label">${item.text}</span>`
            + `</label></div>`;
        }).join('');
      // チェック状態変更時にタイル読み込み
      left市区町村震度Element.querySelectorAll(`input[type="checkbox"][name="quake"]`).forEach((chk) => {
        chk.addEventListener('change', (e) => {
          let sourceUrl = BASE_URL + 'api/mapdata/EarthquakePolygon?'
            + Array.from(left市区町村震度Element.querySelectorAll(`input[type="checkbox"][name="quake"]:checked`)).map((chk) => `quake=${chk.value}`).join('&');
          layer市区町村震度.setSource(new ol.source.Vector({ url: sourceUrl, format: new ol.format.GeoJSON() }));
        });
      });
    };
  }

  // ====================================================================
  // 事前情報表示
  // ====================================================================
  function init事前情報Layers() {
    const left事前情報Element = document.getElementById('left事前情報');
    left事前情報Element.querySelectorAll(`input[type="checkbox"][data-geojsonurl]`).forEach((chk) => {
      // レイヤ作成
      const infoType = chk.value;
      const style = (infoType == 'heliport')
        ? new ol.style.Style({
          text: new ol.style.Text({
            font: 'bold 18px bootstrap-icons',
            text: '\uF7FB',
            fill: new ol.style.Fill({ color: '#00F' }),
            stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
          })
        })
        : new ol.style.Style({
          text: new ol.style.Text({
            font: 'bold 18px bootstrap-icons',
            text: '\uF627',
            fill: new ol.style.Fill({ color: '#800' }),
            stroke: new ol.style.Stroke({ color: '#FFF', width: 2 }),
          })
        });
      const layer事前情報 = new ol.layer.Vector({
        source: new ol.source.Vector({ url: chk.dataset.geojsonurl, format: new ol.format.GeoJSON() }),
        style: style,
        visible: false,
      });
      map.addLayer(layer事前情報);
      // チェック状態変更時に表示ON/Off切り替え
      chk.addEventListener('change', (e) => {
        layer事前情報.setVisible(chk.checked);
      });
    });
  }

  // ====================================================================
  // 防災ヘリ関連情報
  // ====================================================================
  /**
   * 防災ヘリ関連情報（調査依頼一覧・調査ルート一覧）の表示を更新します。
   * @returns {Promise}
   */
  const reload防災ヘリ関連情報 = () => {
    //TODO 以下の処理を実装
    // (1) 防災ヘリ関連情報のチェック状態を把握退避
    // (2) Partial取得、反映、チェック状態復元
    // (3) init防災ヘリ関連情報を実行
    return new Promise((resolve, reject) => {
      return resolve();
    });

  }
  // ※防災ヘリ関連情報部の再読み込み時にも設定を行う
  function init防災ヘリ関連情報Layers() {
    const form防災ヘリ関連情報 = document.getElementById('form防災ヘリ関連情報');

    // 一時保存チェックボックス→一時保存調査箇所呼び出しの選択肢
    const array一時保存Chk = Array.from(form防災ヘリ関連情報.querySelectorAll('#left調査依頼一時保存 input[type="checkbox"][value]'));
    document.getElementById('sel一時保存調査依頼').innerHTML = array一時保存Chk.map((cb) => `<option value="${cb.value}">${cb.dataset.name}</option>`).join('');
    document.querySelector('button[data-bs-target="#modal調査依頼呼び出し"]').disabled = array一時保存Chk.length == 0;

    // 自部署の調査依頼（依頼中）チェックボックス→調査依頼状況タブの選択肢
    const array調査依頼Chk = Array.from(form防災ヘリ関連情報.querySelectorAll('input[type="checkbox"][data-editable]'));
    document.querySelector('select[name="sel調査依頼"]').innerHTML = array調査依頼Chk.map((cb) => `<option value="${cb.value}">${cb.dataset.name}</option>`).join('');
    document.querySelector('select[name="sel調査依頼"]').disabled = array調査依頼Chk.length == 0;
    document.querySelector('button[name="btn調査依頼取消"]').disabled = array調査依頼Chk.length == 0;

    //TODO 一時保存調査ルート→調査ルート作成タブの「一時保存調査ルート呼び出し」ボタンdisabled、一時保存調査ルート呼び出しモーダルのプルダウン


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
    // チェック状態に応じた（調査依頼中／調査予定などの）対象地点一覧を表示
    const show表示対象Features = () => {
      const formData = new FormData(form防災ヘリ関連情報);
      // 調査依頼、および調査予定データをまとめて取得
      ajaxGetJson('?Handler=Features&' + new URLSearchParams(formData).toString())
        .then((json) => {
          const spots = geojsonFormatter.readFeatures(json.spots);
          layer調査地点.getSource().clear();
          layer調査地点.getSource().addFeatures(spots);
          const routes = geojsonFormatter.readFeatures(json.routes);
          layer調査ルート.getSource().clear();
          layer調査ルート.getSource().addFeatures(routes);
        }, showAlert);
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
      layer編集中調査ルート.setSource(source調査ルート);
      source調査ルート.changed(); // レイヤ再描画
    }
  }

  // --------------------------------
  // タブ変更時に呼び出し
  // --------------------------------
  document.querySelectorAll('button[name="btnタブ選択"]').forEach((button) => {
    button.addEventListener('click', e => {
      console.log("TAB Change:" + button.value);
      // URL変更
      history.replaceState({}, '', `?tab=${button.value}`);
      // 未ログインならログインモーダル表示、ログイン済なら表示タブ切り替え
      const loginModalElement = document.getElementById('loginModal');
      if (loginModalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(loginModalElement);
        modal.show();
      } else if (dispArea.dataset.bottomtab != button.value) {
        // ログイン済なら表示タブ切り替え
        dispArea.dataset.bottomtab = button.value;
        const source調査地点 = map調査地点Source[button.value] ?? new ol.source.Vector();
        layer編集中調査地点.setSource(source調査地点);
        source調査地点.changed(); // レイヤ再描画
        const source調査ルート = map調査ルートSource[button.value] ?? new ol.source.Vector();
        layer編集中調査ルート.setSource(source調査ルート);
        source調査ルート.changed(); // レイヤ再描画
        //TODO おそらくはinteraction停止が必要

        // 2026/02/08 Mirai
        layerKP河川.setVisible(false);
        layerKP道路.setVisible(false);
        layerKPLine河川.setVisible(false);
        layerKPLine道路.setVisible(false);
      }
    });
  });

  /**
   * featureをもとに一覧明細行を作成します。featureのcheckboxプロパティには明細行のcheckboxオブジェクトを設定します。
   * @param {HTMLDivElement} tab 画面下部の表示対象タブ
   * @param {ol.Feature} feature 調査箇所のFeature
   * @returns {HTMLTableRowElement} 明細行
   */
  const create明細行 = (tab, feature) => {
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
    innerHTML += `<td class="text-center">${spottype}</td>`;
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
  document.querySelectorAll('#bottomArea table>thead input[name="chk全選択"]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const checked = cb.checked;
      const checkboxes = cb.closest('table').querySelectorAll('tbody>tr:not(.d-none) input[type="checkbox"][name="id"]:not(:disabled)');
      checkboxes.forEach((cb) => {
        if (cb.checked != checked) {
          cb.checked = checked;
          cb.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        }
      });
    });
  });
  // 全タブ共通：一覧チェック変更⇒選択状態を変更し画面に反映
  document.querySelectorAll('#bottomArea table>tbody').forEach((tbody) => {
    tbody.addEventListener('change', (e) => {
      const cb = (e.target.type == 'checkbox' && e.target.name == 'id') ? e.target : e.target.closest('input[type="checkbox"][name="id"]');
      if (cb) {
        layer編集中調査地点.getSource().changed();
      }
    });
  });


  // ====================================================
  // 調査依頼タブ
  // ====================================================
  function init調査依頼タブ() {
    const source調査地点 = new ol.source.Vector();
    set調査地点Source(tab調査依頼, source調査地点, new ol.source.Vector());
    const tbody調査依頼 = document.querySelector('#table調査依頼>tbody');

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

      const /** 調査地点名 */ name = feature.get('name') ?? '';
      const /** 依頼者名 */ requester = feature.get('requester') ?? '';
      const /** 優先度 */ priority = feature.get('priority') ?? '';
      const /** 調査手法名 */ survey = feature.get('survey') ?? '';
      const /** 搭乗希望人数(0-8) */ persons = feature.get('persons') ?? '';
      const /** 登録方法 */ spottype = feature.get('spottype') ?? '';
      const /** 備考 */ remarks = feature.get('remarks') ?? '';
      const /** 更新日時 */ updated = feature.get('updated') ?? '';

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
      for (let value of ['通過', '周回']) {
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
      innerHTML += `<td class="text-center">${spottype}<input type="hidden" name="input.spottype" value="${spottype}">
        <input type="hidden" name="input.geometry" value="${htmlEncode(geojsonFormatter.writeGeometry(geometry))}"></td>`;
      innerHTML += `<td><input type="text" name="input.remarks" maxlength="100" class="form-control form-control-sm" value="${htmlEncode(remarks)}"></td>`;
      innerHTML += `<td>${updated || '(DB未登録)'}</td>`;
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
        ajaxExecute(`?Handler=SurveyRequest&id=${tempid}&status=0`, {},
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
      hideModalKPPoint();
      layerKP河川.setVisible(false);
      layerKP道路.setVisible(false);
      layerKPLine河川.setVisible(false);
      layerKPLine道路.setVisible(false);
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
        layerKP河川.setVisible(true);
        layerKPLine河川.setVisible(true);
        setModalKPPoint(drawType);
      // KPデータ（道路）から登録
      } else if (drawType == 'Road') { 
        layerKP道路.setVisible(true);
        layerKPLine道路.setVisible(true);
        setModalKPPoint(drawType);
      }
    };
    function hideKPLayer() {
      layerKP河川.setVisible(false);
      layerKP道路.setVisible(false);
      layerKPLine河川.setVisible(false);
      layerKPLine道路.setVisible(false);
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

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // ================================
    // 距離標　調査地点登録 ダイアログ
    // ================================
    const modalKPPoint = document.getElementById("modalKPPoint");
    const selRoadRiver = document.getElementById('selRoadRiver');
    const mapKP河川 = new Map();
    const mapKP道路 = new Map();
    // ================================
    // 距離標入力ダイアログ　表示
    // ================================
    function setModalKPPoint(drawType) {
      modalKPPoint.style.display = "block";
      // ウインドウ位置
      const rect = tab調査依頼.getBoundingClientRect();
      const panel = document.getElementById('modalKPPoint');
      panel.style.left = "3px";
      panel.style.top = (rect.top + 5) + "px";
    };
    // ================================
    // 河川データ読み込み
    // ================================
    mapKPSource河川.on('change', () => {
      if (mapKPSource河川.getState() != 'ready') return;
      if (mapKP河川.length > 0) return;

      const features = mapKPSource河川.getFeatures();
      features.forEach(f => {
        const 水系名 = f.get('水系名');
        const 河川名 = f.get('河川名');
        const 左右岸 = f.get('左右岸');

        if (!水系名 || !河川名 || !左右岸) return;

        const key = `${水系名}_${河川名}_${左右岸}`;
        const text = `${水系名} ${河川名} （${左右岸}）`;

        if (!mapKP河川.has(key)) {
          mapKP河川.set(key, text);
        }
      });
      createRiverSelect(mapKP河川);
    });
    // ================================
    // 道路データ読み込み
    // ================================
    mapKPSource道路.on('change', () => {
      if (mapKPSource道路.getState() != 'ready') return;
      if (mapKP道路.length > 0) return;

      const features = mapKPSource道路.getFeatures();
      features.forEach(f => {
        const 地方整備局   = f.get('地方整備局');
        const 事務所       = f.get('事務所');
        const 道路種別     = f.get('道路種別');
        const 路線         = f.get('路線');
        const 現旧新区分   = f.get('現旧新区分');
        const 上下区分     = f.get('上下区分');

        const key = `${地方整備局}_${事務所}_${道路種別}_${路線}_${現旧新区分}_${上下区分}`;
        const text = `${道路種別} ${路線}号線 ${現旧新区分} ${上下区分}`;

        if (!mapKP道路.has(key)) {
          mapKP道路.set(key, text);
        }
      });
      createRiverSelect(mapKP道路);
    });
    // ================================
    // セレクトボックス作成
    // ================================
    function createRiverSelect(uniqueMap) {
      selRoadRiver.innerHTML = '';
      selRoadRiver.appendChild(new Option('選択してください', ''));

      const sortedEntries = [...uniqueMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'ja'));

      sortedEntries.forEach(([key, text]) => {
        selRoadRiver.appendChild(new Option(text, key));
      });
    };
    // ================================
    // 河川・道路プルダウン　イベント
    // ================================
    selRoadRiver.addEventListener('change', e => {
      mapKPSource.clear();
      document.getElementById('startKp').value = '';
      document.getElementById('endKp').value = '';
      const values = e.target.value.split('_');
      if (values.length == 3) {
        const suikei  = values[0];
        const kasen   = values[1];
        const sayugan = values[2];
        layerKP河川.setStyle(function (f) {
          if ((suikei != '' && f.get('水系名')) && (kasen != '' && f.get('河川名') == kasen) && (sayugan != '' && f.get('左右岸') == sayugan)) {
            return styleKPRiver(f);
          } else {
            return null;
          }
        });
        layerKPLine河川.setStyle(function (f) {
          if ((suikei != '' && f.get('水系名')) && (kasen != '' && f.get('河川名') == kasen) && (sayugan != '' && f.get('左右岸') == sayugan)) {
            return styleKPLineRiver(f);
          } else {
            return null;
          }
        });
        zoomKPLine(layerKP河川);
      } else if (values.length == 6) {
        const jimusyo   = values[1]
        const syubetsu  = values[2]
        const rosen     = values[3]
        const genkyu    = values[4]
        const jyoge     = values[5]
        layerKP道路.setStyle(function (f) {
          if ((syubetsu != '' && f.get('道路種別') == syubetsu) && (rosen != '' && f.get('路線') == rosen) && (genkyu != '' && f.get('現旧新区分') == genkyu) && (jyoge != '' && f.get('上下区分'))) {
            return styleKPRiver(f);
          } else {
            return null;
          }
        });
        layerKPLine道路.setStyle(function (f) {
          if ((syubetsu != '' && f.get('道路種別') == syubetsu) && (rosen != '' && f.get('路線') == rosen) && (genkyu != '' && f.get('現旧新区分') == genkyu) && (jyoge != '' && f.get('上下区分'))) {
            return styleKPRiver(f);
          } else {
            return null;
          }
        });
        zoomKPLine(layerKP道路);
      }
    });
    // ================================
    // 数値入力制限（km）
    // ================================
    document.querySelectorAll('.kp-input').forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9.]/g, '');
      });
      input.addEventListener('change', e => {
        selectNearestKP();
      });
    });
    // ================================
    // 一番近い距離標を選択状態にする
    // ================================
    function selectNearestKP() {
      const key = selRoadRiver.value;
      if (!key) return;
      const parts = key.split('_');

      let source = null;
      let layerKP = null;
      let layerKPLine = null;

      if (parts.length === 3) {
        // 河川
        source = mapKPSource河川;
        layerKP = layerKP河川;
        layerKPLine = layerKPLine河川;
      } else if (parts.length === 6) {
        // 道路
        source = mapKPSource道路;
        layerKP = layerKP道路;
        layerKPLine = layerKPLine道路;
      } else {
        return;
      }

      const kp_s_raw = document.getElementById('startKp').value;
      const kp_e_raw = document.getElementById('endKp').value;
      const kp_s = kp_s_raw !== '' ? Number(kp_s_raw) : null;
      const kp_e = kp_e_raw !== '' ? Number(kp_e_raw) : null;
      if (kp_s === null && kp_e === null) return;

      const kpProp = (parts.length === 3) ? '距離標':'地点標名称'; 

      mapKPSource.clear();
      if ((kp_s !== null && kp_e === null) || (kp_s === null && kp_e !== null)) {
        // 距離標が片方入力されている場合
        const targetKp = kp_s !== null ? kp_s : kp_e;
        let nearestFeature = null;
        let minDiff = Infinity;
        source.getFeatures().forEach(f => {
          if (!isSameGroup(f, parts)) return;
          let kp = f.get(kpProp);
          if (kp == null) return;
          kp = Number(String(kp).replace(/[^\d.]/g, ''));
          if (isNaN(kp)) return;
          const diff = Math.abs(kp - targetKp);
          if (diff < minDiff) {
            minDiff = diff;
            nearestFeature = f;
          }
        });
        if (nearestFeature) {
          const geom = nearestFeature.getGeometry();
          const selectedFeature = new ol.Feature({ geometry: new ol.geom.Point(geom.getCoordinates()) });
          selectedFeature.set('srcFeature', nearestFeature);
          mapKPSource.addFeature(selectedFeature);
        }
        return;
      } else {
        // 距離標が両方入力されている場合
        const kpMin = Math.min(kp_s, kp_e);
        const kpMax = Math.max(kp_s, kp_e);

        const rangeFeatures = [];

        source.getFeatures().forEach(f => {
          if (!isSameGroup(f, parts)) return;

          let kp = f.get(kpProp);
          if (kp == null) return;

          kp = Number(String(kp).replace(/[^\d.]/g, ''));
          if (isNaN(kp)) return;

          if (kp >= kpMin && kp <= kpMax) {
            rangeFeatures.push(f);
          }
        });
        // 同じポイントの場合はENDを削除
        if (rangeFeatures.length == 1) {
          endFeature = null;
          document.getElementById('endKp').value = '';
        } else {
          rangeFeatures.forEach(f => {
            const geom = f.getGeometry();
            const selectedFeature = new ol.Feature({ geometry: new ol.geom.Point(geom.getCoordinates()) });
            selectedFeature.set('srcFeature', f);
            mapKPSource.addFeature(selectedFeature);
          });
        }
        console.log(rangeFeatures);
      }
    }

    function isSameGroup(feature, parts) {
      if (parts.length === 3) {
        const [水系名, 河川名, 左右岸] = parts;
        return (
          feature.get('水系名') === 水系名 &&
          feature.get('河川名') === 河川名 &&
          feature.get('左右岸') === 左右岸
        );
      }

      if (parts.length === 6) {
        const [地方整備局, 事務所, 道路種別, 路線, 現旧新区分, 上下区分] = parts;
        return (
          feature.get('地方整備局') === 地方整備局 &&
          feature.get('事務所') === 事務所 &&
          feature.get('道路種別') === 道路種別 &&
          feature.get('路線') === 路線 &&
          feature.get('現旧新区分') === 現旧新区分 &&
          feature.get('上下区分') === 上下区分
        );
      }
      return false;
    }


    // ================================
    // 選択された道路・河川にズーム
    // ================================
    const zoomKPLine = (layer) => {
      const source = layer.getSource();
      if (!source) return;
      const styleFn = layer.getStyle();
      if (!styleFn) return;
      const resolution = map.getView().getResolution();
      const visibleFeatures = source.getFeatures().filter(f => {
        return styleFn(f, resolution) !== null;
      });
      if (!visibleFeatures.length) return;
      let extent = ol.extent.createEmpty();
      visibleFeatures.forEach(f => {
        ol.extent.extend(extent, f.getGeometry().getExtent());
      });
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 300,
        maxZoom: 18
      });
    };

    // ================================
    // ドラッグ移動（ヘッダーのみ）
    // ================================
    (function enableDragModalKPPoint() {
      const panel = document.getElementById('modalKPPoint');
      const header = panel.querySelector('.panel-header');
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let panelX = 0;
      let panelY = 0;
      header.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        panelX = rect.left;
        panelY = rect.top;
        dragging = true;
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panel.style.left = panelX + dx + 'px';
        panel.style.top = panelY + dy + 'px';
      });
      document.addEventListener('mouseup', () => {
        dragging = false;
      });
    })();
    // ================================
    // ボタン処理
    // ================================
    document.getElementById('btnKPCancel').onclick = () => {
      console.log("Cancel !!!");
      document.getElementById('modalKPPoint').style.display = 'none';
      hideModalKPPoint();
      hideKPLayer();
      mapKPSource.clear();
    };
    document.getElementById('btnKPOk').onclick = () => {
      const data = {
        selRoadRiver: document.getElementById('selRoadRiver').value,
        startKp: Number(document.getElementById('startKp').value),
        endKp: Number(document.getElementById('endKp').value)
      };
      hideModalKPPoint();
      hideKPLayer();
      mapKPSource.clear();
      console.log('確定:', data);
    };
    function hideModalKPPoint() {
      modalKPPoint.style.display = "none";
    }
  }

  // ====================================================
  // 依頼状況タブ
  // ====================================================
  function init依頼状況タブ() {
    const source調査地点 = new ol.source.Vector();
    set調査地点Source(tab依頼状況, source調査地点, new ol.source.Vector());
    const sel調査依頼 = tab依頼状況.querySelector('select[name="sel調査依頼"]');
    const tbody依頼状況 = tab依頼状況.querySelector('#table依頼状況>tbody');
    const chk依頼状況_依頼中のみ表示 = document.getElementById('chk依頼状況_依頼中のみ表示');

    /**
     * 現在プルダウンで選択されている調査依頼の地点一覧を表示します。
     */
    const load依頼状況 = () => {
      source調査地点.clear();
      tbody依頼状況.innerHTML = '';
      if (!sel調査依頼.value) { return; }
      // プルダウンで指定された調査依頼の調査箇所を取得（ステータス＝チェック指定があれば依頼中のみ）
      const statusQuery = chk依頼状況_依頼中のみ表示.checked ? '&status=10' : '';
      ajaxExecute('?Handler=SurveyRequest&id=' + sel調査依頼.value + statusQuery, {},
        { title: '調査依頼状況' },
      ).then((json) => {
        const features = geojsonFormatter.readFeatures(json.features);
        features.forEach((f) => {
          const trElement = create明細行(tab依頼状況, f);
          tbody依頼状況.appendChild(trElement);
        });
        source調査地点.addFeatures(features);
      }, showAlert);
    };
    sel調査依頼.addEventListener('change', load依頼状況);
    chk依頼状況_依頼中のみ表示.addEventListener('change', load依頼状況);
    load依頼状況();


    //TODO 依頼取消処理実装

    //TODO 調査依頼取消後、reload防災ヘリ関連情報()をawaitなどでよびだし、thenのタイミングでload依頼状況を再呼出

  }

  // ====================================================================
  // 首都直下初動タブ（特定初動調査）
  // ====================================================================
  function init特定初動調査タブ() {
    // -------------------------------------
    // 調査ルートの地図表示/一覧表示
    // -------------------------------------
    const sel初動調査ルート = tab特定初動調査.querySelector('select[name="routeid"]');
    const tbody特定初動調査 = tab特定初動調査.querySelector('#table特定初動調査 tbody');
    const load初動調査ルート = () => {
      const source調査ルート = new ol.source.Vector();
      set調査地点Source(tab特定初動調査, new ol.source.Vector(), source調査ルート);
      tbody特定初動調査.innerHTML = '';
      ajaxExecute('?Handler=InitialRoute&route=' + sel初動調査ルート.value, {},
        { title: '初動調査ルート読み込み' },
      ).then((json) => {
        const features = geojsonFormatter.readFeatures(json.routes);
        source調査ルート.addFeatures(features);
        features.forEach((f) => {
          const text = f.get('text');
          if (text == '始') {
            tab特定初動調査.querySelector('input[name="txt始点"]').value = f.get('name');
          } else if (text == '終') {
            tab特定初動調査.querySelector('input[name="txt終点"]').value = f.get('name');
          } else if (f.get('text')) {
            tbody特定初動調査.appendChild(create明細行(tab特定初動調査, f));
          }
        });
      }, () => { });
    }
    // プルダウン変更/書記表示時に読み込み
    sel初動調査ルート.addEventListener('change', load初動調査ルート);
    load初動調査ルート();
    // -------------------------------------
    // 調査予定ルートとして公開
    // -------------------------------------
    tab特定初動調査.querySelector('button[name="btn初動調査登録"]').addEventListener('click', (e) => {
      showAlert('工事中', '調査ルートとして公開する処理は工事中です。');
    })
  }

  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ====================================================================
  // ルート作成タブ
  // ====================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  // ==========================================================================================================================
  function initルート作成タブ() {
    const modal調査予定登録Element = document.getElementById('modal調査予定登録');
    const tbodyルート作成 = document.querySelector('#tableルート作成>tbody');
    const source調査地点 = new ol.source.Vector();
    set調査地点Source(tabルート作成, source調査地点, new ol.source.Vector());

    const initルート作成 = (tempid) => {
      console.log("initルート作成!!!!!");
      // 画面初期状態を読み込み（一時保存id指定時はその保存内容を読み出し）
      ajaxExecute(`?Handler=Plan&tempid=${tempid || ''}`, {},
        { title: tempid ? '一時保存ルート呼出・削除' : '調査ルート作成' }
      ).then((json) => {
        console.log("Handler!!!!!");
        // まずは画面表示内容を初期化
        tbodyルート作成.innerHTML = '';
        selectedFeatureIds = json.id;
        const features = geojsonFormatter.readFeatures(json.features);
        features.forEach((f) => {
          const id = f.get('id');
          f.setId(`${id}`);
          const trElement = create明細行(tbodyルート作成, f);
          if (selectedFeatureIds.indexOf(id) != -1) {
            trElement.querySelector('input[type="checkbox"][name="id"]').checked = true;
          }
        });
        source調査地点.clear();
        source調査地点.addFeatures(features);
        // 画面左側の制御内容も復元
        selルート作成起点.value = add起点終点OptionIfNotExists(json.startx, json.starty);
        selルート作成終点.value = add起点終点OptionIfNotExists(json.endx, json.endy);
        document.getElementById('radioルート手動作成').checked = !json.auto;
        document.getElementById('radioルート自動作成').checked = json.auto;
        // 登録時情報も設定
        modal調査予定登録Element.querySelector('input[name="tempid"]').value = tempid || '';
        modal調査予定登録Element.querySelector('input[name="input.title"]').value = json.title;
        modal調査予定登録Element.querySelector('input[name="drawroute"]').value = json.drawroute ? geojsonFormatter.writeGeometry(geojsonFormatter.readGeometry(json.drawroute)) : '';
        toast調査ルート手動描画Element.querySelector('button[name="btn調査ルート手動描画削除"]').disabled = !json.drawroute;

        // ルート表示実施（距離算出処理実行、自動ルート作成は解除しない）
        exec距離等算出(false);
      }, (error) => {
        if (tempid) {
          location.reload(); // エラー（その一時保存データが編集できない）なら画面再読み込み
        }
      });

      // フィルタ指定状態を初期化
      $(tabルート作成.querySelector('select[name="irai"]')).multiselect('selectAll');
      $(tabルート作成.querySelector('select[name="priority"]')).multiselect('deselectAll');
      tabルート作成.querySelector('select[name="persons"]').value = '';
    };


    // 一時保存調査依頼に対する操作各種
    const modal調査予定呼び出しElement = document.getElementById('modal調査予定呼び出し');
    document.getElementById('btn一時保存調査予定呼出').addEventListener('click', async (e) => {
      if (layer調査ルート.getSource().getFeatures().length
        && await showConfirm('一時保存ルート呼出・削除',
          '現在表示されている調査ルートが保存されていません。'
          + '\n保存前に呼出を実施すると現在表示されている調査ルートが失われますが、呼出を続けてよろしいでしょうか？') != true
      ) {
        return;
      }
      initルート作成(document.getElementById('sel一時保存調査予定').value);
      bootstrap.Modal.getOrCreateInstance(modal調査予定呼び出しElement).hide();
    });
    document.getElementById('btn一時保存調査予定削除').addEventListener('click', async (e) => {
      if (await showConfirm('一時保存ルート呼出・削除', '選択した調査ルートを削除します。\n本当によろしいでしょうか？') != true) {
        return;
      }
      const formData = new FormData(modal調査予定呼び出しElement);
      ajaxExecute(modal調査予定呼び出しElement.action,
        { method: 'POST', body: formData },
        { title: '一時保存ルート呼出・削除' }
      ).then((response) => {
        location.href = `?tab=tabルート作成`;
      }, () => { });
    });


    // 「調査依頼絞込」フィルタ処理
    const /** @type{HTMLSelectElement} */ sel調査依頼Filter = tabルート作成.querySelector('select[name="irai"]');
    const /** @type{HTMLSelectElement} */ sel優先度Filter = tabルート作成.querySelector('select[name="priority"]');
    const /** @type{HTMLSelectElement} */ sel搭乗人数Filter = tabルート作成.querySelector('select[name="persons"]');
    const filterルート作成対象 = () => {
      const irai = Array.from(sel調査依頼Filter.selectedOptions).map((o) => o.value);
      const priority = Array.from(sel優先度Filter.selectedOptions).map((o) => o.value);
      const persons = sel搭乗人数Filter.value;
      tbodyルート作成.querySelectorAll('tr').forEach((trElement) => {
        const visible = (irai.indexOf(trElement.dataset.irai) != -1)
          && (priority.length == 0 || priority.indexOf(trElement.querySelector('.btn-primary[name="priority"]')?.value) != -1)
          && (persons == '' || trElement.dataset.persons <= persons);
        if (visible) {
          trElement.classList.remove('d-none');
        } else {
          trElement.classList.add('d-none');
        }
        //TODO 地図表示も不可視にする？
      });
    };
    initMultiSelect(sel調査依頼Filter, filterルート作成対象, '調査依頼選択', '全依頼');
    initMultiSelect(sel優先度Filter, filterルート作成対象, '優先度');
    sel搭乗人数Filter.addEventListener('change', filterルート作成対象);

    // 起点終点関係操作
    const toast起点終点設定Element = document.getElementById('toast起点終点設定');
    toast起点終点設定Element.addEventListener('hidden.bs.toast', (e) => {
      // Toastを閉じた時点でdrawが未解除なら解除する
      if (mapDraw) {
        map.removeInteraction(mapDraw);
        mapDraw = null;
      }
    });
    const /** @type{HTMLSelectElement} */ selルート作成起点 = tabルート作成.querySelector('select[name="selルート作成起点"]');
    const /** @type{HTMLSelectElement} */ selルート作成終点 = tabルート作成.querySelector('select[name="selルート作成終点"]');

    /**
     * 起点終点のプルダウンに対し、指定された緯度経度の選択肢がなければこれを追加します
     * @param {*} lon 経度
     * @param {*} lat 緯度
     * @returns 追加されたoption多雨のvalue
     */
    const add起点終点OptionIfNotExists = (lon, lat) => {
      if (!lon && !lat) {
        return '';
      }
      const x = lon.toFixed(6);
      const y = lat.toFixed(6);
      const optionValue = `${x} / ${y}`;
      // プルダウン選択肢になければ追加（起点終点の両方に追加）
      if (!selルート作成起点.querySelector(`option[value="${optionValue}"]`)) {
        const addOption = (sel) => {
          const optionlElement = document.createElement('option');
          optionlElement.value = optionValue;
          optionlElement.innerHTML = optionValue;
          optionlElement.dataset.x = x;
          optionlElement.dataset.y = y;
          sel.appendChild(optionlElement);
        }
        addOption(selルート作成起点);
        addOption(selルート作成終点);
      }
      return optionValue;
    };

    const initルート作成起点終点 = (sel, name) => {
      let prevVal = sel.value;
      sel.addEventListener('change', (e) => {
        if (sel.value == '*') {
          // 描画オブジェクトを初期化して設定
          mapDraw = new ol.interaction.Draw({
            type: 'Point',
            //style: openlayersデフォルトのものとする
          });
          mapDraw.on('drawend', function (e) {
            // この座標のoptionが未追加なら追加する
            const point = ol.proj.transform(e.feature.getGeometry().getFirstCoordinate(), proj3857, proj4326);
            const optionValue = add起点終点OptionIfNotExists(point[0], point[1]);
            // この座標を選択値とする
            sel.value = optionValue;
            prevVal = optionValue;
            // 編集完了
            displayingToast.hide();
            // 距離算出処理実行
            exec距離等算出();
          });
          // 描画による位置指定開始
          map.addInteraction(mapDraw);
          displayingToast = bootstrap.Toast.getOrCreateInstance(toast起点終点設定Element);
          toast起点終点設定Element.querySelector('div.toast-header').innerHTML = `${name}指定`;
          displayingToast.show();
          sel.value = prevVal; // 起点終点指定キャンセルを見越して元に戻しておく
        } else {
          prevVal = sel.value;
          // 距離算出処理実行
          exec距離等算出();
        }
      });
    };
    initルート作成起点終点(selルート作成起点, '起点');
    initルート作成起点終点(selルート作成終点, '終点');
    tabルート作成.querySelector('button[name="btnルート起点終点反転"]').addEventListener('click', (e) => {
      // 始点と終点を反転（選択経路も反転）
      const old起点Value = selルート作成起点.value;
      const old終点Value = selルート作成終点.value;
      selectedFeatureIds = selectedFeatureIds.reverse();
      selルート作成起点.value = old終点Value
      selルート作成終点.value = old起点Value;
      // 距離算出処理実行（自動ルート作成は解除しない）
      exec距離等算出(false);
    });

    // 距離算出関連
    const create調査予定FormData = (mode) => {
      modal調査予定登録Element.querySelector('input[name="mode"]').value = mode;
      const opt起点 = selルート作成起点.options[selルート作成起点.selectedIndex];
      const opt終点 = selルート作成終点.options[selルート作成終点.selectedIndex];
      const formData = new FormData(modal調査予定登録Element);
      formData.append('input.startid', opt起点.dataset.id || '');
      formData.append('input.endid', opt終点.dataset.id || '');
      formData.append('auto', tabルート作成.querySelector('input[name="radioルート作成モード"]').value);
      formData.append('startx', opt起点.dataset.x || '');
      formData.append('starty', opt起点.dataset.y || '');
      formData.append('endx', opt終点.dataset.x || '');
      formData.append('endy', opt終点.dataset.y || '');
      for (let id of selectedFeatureIds) { formData.append('id', id); }
      return formData;
    };

    /**
     * サーバ側の距離算出処理を呼び出し、得られた計算結果や調査ルートを表示します
     * @param {*} calc 自動ルート作成(最短経路算出)を行う場合true、経路ラジオボタンを手動に戻さない(自動であれば自動のままにしておく)場合false
     */
    const exec距離等算出 = (calc = null) => {
      if (calc === null) {
        // 引数が指定されていない場合、ルート作成モードを手動に戻す
        document.getElementById('radioルート手動作成').checked = true;
      }
      const title = calc ? 'ルート自動作成' : 'ルート作成';
      const formData = create調査予定FormData(calc ? 'calc' : '');
      ajaxExecute('?Handler=Plan',
        { method: 'POST', body: formData },
        { title: title, form: tabルート作成, progress: calc ? '最短ルート自動作成中' : null },
      ).then((json) => {
        // 得られた調査ルートを表示反映
        layer調査ルート.getSource().clear();
        if (json.経路) {
          const features = geojsonFormatter.readFeatures(json.経路);
          layer調査ルート.getSource().addFeatures(features);
        }
        // 飛行距離等の情報を表示
        document.getElementById('divルート作成_総飛行距離').innerHTML = json.総飛行距離 || '-';
        document.getElementById('divルート作成_調査箇所').innerHTML = json.調査箇所 || '-';
        document.getElementById('divルート作成_飛行時間').innerHTML = json.飛行時間 || '-';
        document.getElementById('divルート作成_同乗可能人数').innerHTML = json.同乗可能人数 || '-';
        // 入力エラーがあればエラーを表示
        if (json.error) {
          showAlert(title + 'エラー', json.error);
          setInvalidStyle(tabルート作成, json.erroritems);
        }
        // サーバ側で有効とみなされた地点を画面に反映、有効とみなされなかったがチェックされている行があればチェックを外し選択不可とする
        selectedFeatureIds = json.id;
        source調査地点.changed();
        tbodyルート作成.querySelectorAll(`input[type="checkbox"][name="id"]:checked`).forEach((cb) => {
          const index = selectedFeatureIds.indexOf(cb.value);
          if (index == -1) {
            cb.checked = false;
            cb.disabled = true;
            cb.closest('tr').classList.add('text-secondary');
          }
        });
      }, () => { });
    }
    // 地点選択状態変更時(全選択変更時含む)に距離等算出をやり直し
    document.querySelector('#tableルート作成 input[name="chk全選択"]').addEventListener('change', () => {
      exec距離等算出();
    });
    tbodyルート作成.addEventListener('change', (e) => {
      const cb = (e.target.type == 'checkbox' && e.target.name == 'id') ? e.target : e.target.closest('input[type="checkbox"][name="id"]');
      if (cb) {
        exec距離等算出();
      }
    });
    // 自動作成実行
    document.getElementById('radioルート自動作成').addEventListener('click', async (e) => {
      exec距離等算出(true);
    });
    // アンドゥボタンクリックで直前に追加した地点を削除
    document.getElementById('btnルート作成Undo').addEventListener('click', (e) => {
      //TODO アンドゥ機能の不足を指摘されたら（削除したのを元に戻せない、全選択に対応していないetc）アンドゥバッファを用意して正式な対応を行うこと。
      if (selectedFeatureIds.length) {
        const featureId = selectedFeatureIds.pop(); // 末尾の要素を除去
        tbodyルート作成.querySelectorAll(`input[type="checkbox"][name="id"][value="${featureId}"]`).forEach((cb) => {
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); // いちおうchangeイベントも発火させる
        });
      }
    });

    // 調査ルート手動描画関連
    const toast調査ルート手動描画Element = document.getElementById('toast調査ルート手動描画');
    toast調査ルート手動描画Element.addEventListener('hidden.bs.toast', (e) => {
      // Toastを閉じた時点でdrawが未解除なら解除する
      if (mapDraw) {
        map.removeInteraction(mapDraw);
        mapDraw = null;
      }
    });
    const btn調査ルート手動描画削除 = toast調査ルート手動描画Element.querySelector('button[name="btn調査ルート手動描画削除"]');
    btn調査ルート手動描画削除.addEventListener('click', (e) => {
      // 手動描画ルートを削除
      modal調査予定登録Element.querySelector('input[name="drawroute"]').value = '';
      btn調査ルート手動描画削除.disabled = true; // 削除ボタンを押下不可にする
      displayingToast.hide();
      exec距離等算出();
    });
    document.getElementById('btn調査ルート手動描画').addEventListener('click', async (e) => {
      // 描画オブジェクトを初期化して設定
      mapDraw = new ol.interaction.Draw({
        type: 'LineString',
        condition: (e) => { return e.originalEvent.button !== 2; }// 右クリックは描画進行イベントとはしない
        //style: openlayersデフォルトのものとする
      });
      mapDraw.on('drawend', function (e) {
        modal調査予定登録Element.querySelector('input[name="drawroute"]').value = geojsonFormatter.writeGeometry(e.feature.getGeometry());
        btn調査ルート手動描画削除.disabled = false; // 削除ボタンを押下可にする
        displayingToast.hide();
        exec距離等算出();
      });
      // 描画による位置指定開始
      map.addInteraction(mapDraw);
      // Toastも表示
      displayingToast = bootstrap.Toast.getOrCreateInstance(toast調査ルート手動描画Element);
      displayingToast.show();
    });

    // 調査予定登録(一時保存ボタンも同一処理、モーダルの文言等の情報はボタンのdata項目等より取得)
    const btn調査予定登録実行 = modal調査予定登録Element.querySelector('button[value="register"]');
    document.querySelectorAll('button[name="btn調査予定登録"]').forEach((button) => {
      button.addEventListener('click', (e) => {
        const formData = create調査予定FormData('check');
        ajaxExecute(modal調査予定登録Element.action,
          { method: 'POST', body: formData },
          { title: button.dataset.modaltitle, form: tabルート作成 }
        ).then((response) => {
          // 一覧入力内容チェックOKなら依頼名入力モーダルを表示
          modal調査予定登録Element.querySelector('.modal-title').innerHTML = button.dataset.modaltitle;
          modal調査予定登録Element.querySelector('.modal-body>div:first-child').innerHTML = button.dataset.modalcaption;
          btn調査予定登録実行.innerHTML = button.dataset.modalbutton;
          const modal = bootstrap.Modal.getOrCreateInstance(modal調査予定登録Element);
          modal.show();
          btn調査予定登録実行.value = button.value;
        }, () => { });
      });
    });
    btn調査予定登録実行.addEventListener('click', async (e) => {
      const formData = create調査予定FormData(btn調査予定登録実行.value);
      ajaxExecute('?Handler=Plan',
        { method: 'POST', body: formData },
        { title: modal調査予定登録Element.querySelector('.modal-title').innerHTML, form: modal調査予定登録Element }
      ).then(async (response) => {
        // 登録成功で画面リロード
        location.href = `?`;
      }, () => { });
    });
  }
}

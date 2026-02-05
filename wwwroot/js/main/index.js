'use strict';
{
  // タブ・ないしタブ間での相互連携があるelement定義
<<<<<<< HEAD
  const dispArea        = document.getElementById("dispArea");
  const tab特定初動調査 = document.getElementById("tab特定初動調査");
  const tab調査依頼     = document.getElementById("tab調査依頼");
  const tab依頼状況     = document.getElementById("tab依頼状況");
  const tabルート作成   = document.getElementById("tabルート作成");
=======
  const dispArea              = document.getElementById("dispArea");
  const tabTokuteiSyodou      = document.getElementById("tabTokuteiSyodou");
  const tabTyosaIrai          = document.getElementById("tabTyosaIrai");
  const tabIraiJyokyo         = document.getElementById("tabIraiJyokyo");
  const tabRouteCreate        = document.getElementById('tabRouteCreate');
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f

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

  // タブ
  const layer編集中調査地点 = createSpotLayer(map);
  const layer編集中調査ルート = createRouteLayer(map);
  const /** @type{Map<string, ol.source.Vector>} */ map調査地点Source = {};
  const /** @type{Map<string, ol.source.Vector>} */ map調査ルートSource = {};

  // タブ　初期設定
  initTabTyosaIrai();
  initTabIraiJyokyo();
  if (tabTokuteiSyodou) {
    initTabTokuteiSyodou();
  }
  if (tabRouteCreate) {
    initTabRouteCreate();
  }
  if (tabルート作成) {
    initルート作成タブ();
  }

  // 地図に対する描画操作（地点追加等）
  let /** @type{ol.interaction.Draw?} */ mapDraw = null;
  // 何らかの表示中のtoast
  let /** @type{bootstrap.Toast?} */ displayingToast = null;
  // 選択中状態で表示すべきfeatureのidの一覧
  let selectedFeatureIds = [];

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
      //TODO それ以外の選択処理
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
    tabIraiJyokyo.querySelector('select[name="sel調査依頼"]').innerHTML = array調査依頼Chk.map((cb) => `<option value="${cb.value}">${cb.dataset.name}</option>`).join('');
    tabIraiJyokyo.querySelector('select[name="sel調査依頼"]').disabled = array調査依頼Chk.length == 0;
    tabIraiJyokyo.querySelector('button[name="btn調査依頼取消"]').disabled = array調査依頼Chk.length == 0;

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
  document.querySelectorAll('button[name="btnTabSelect"]').forEach((button) => {
    button.addEventListener('click', e => {
      // URL変更
      history.replaceState({}, '', `?tab=${button.value}`);
      // 未ログインならログインモーダル表示、ログイン済なら表示タブ切り替え
      const loginModalElement = document.getElementById('loginModal');
      if (loginModalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(loginModalElement);
        modal.show();
      } else if (dispArea.dataset.bottomtab != button.value) {
        // ログイン済なら表示タブ切り替え
        dispArea.dataset.bottomtab  = button.value;
        const source調査地点        = map調査地点Source[button.value] ?? new ol.source.Vector();
        layer編集中調査地点.setSource(source調査地点);
        source調査地点.changed();   // レイヤ再描画
        const source調査ルート      = map調査ルートSource[button.value] ?? new ol.source.Vector();
        layer編集中調査ルート.setSource(source調査ルート);
        source調査ルート.changed(); // レイヤ再描画
        //TODO おそらくはinteraction停止が必要
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
    const /** 調査箇所id */         id         = feature.get('id') ?? ''; //
    const /** 調査地点名 */         name       = feature.get('name') ?? '';
    const /** 依頼者名 */           requester  = feature.get('requester') ?? '';
    const /** 優先度 */             priority   = feature.get('priority') ?? '';
    const /** 調査手法名 */         survey     = feature.get('survey') ?? '';
    const /** 搭乗希望人数(0-8) */  persons    = feature.get('persons') ?? '';
    const /** 登録方法 */           spottype   = feature.get('spottype') ?? '';
    const /** 備考 */               remarks    = feature.get('remarks') ?? ''; // ※特定初動調査でid指定有(調査地点相当)なら入力可にするかも？？？
    const /** 調査状況 */           status     = feature.get('status') ?? ''; // 調査依頼状況タブのみ
    const /** 更新日時 */           updated    = feature.get('updated') ?? '';

    const trElement = document.createElement('tr');
    trElement.classList.add('align-middle');
    trElement.dataset.irai = feature.get('irai'); // 調査依頼による絞り込みで参照
    trElement.dataset.priority = priority; // 優先度による絞り込みで参照
    trElement.dataset.persons = persons; // 搭乗人数による絞り込みで参照
    let innerHTML = '';

    // 先頭列（チェックボックス、ただし特定初動調査は巡回順テキスト表示）
    if (tab == tabTokuteiSyodou) {
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
    if (tab == tabIraiJyokyo) {
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


<<<<<<< HEAD
=======
  // ====================================================================
  // 特定初動調査タブ
  // ====================================================================
  function initTabTokuteiSyodou() {
    // -------------------------------------
    // 調査ルートの地図表示/一覧表示
    // -------------------------------------
    const sel初動調査ルート = tabTokuteiSyodou.querySelector('select[name="routeid"]');
    const tbody特定初動調査 = tabTokuteiSyodou.querySelector('#table特定初動調査 tbody');
    const load初動調査ルート = () => {
      const source調査ルート = new ol.source.Vector();
      set調査地点Source(tabTokuteiSyodou, new ol.source.Vector(), source調査ルート);
      tbody特定初動調査.innerHTML = '';
      ajaxExecute('?Handler=InitialRoute&route=' + sel初動調査ルート.value, {},
        { title: '初動調査ルート読み込み' },
      ).then((json) => {
        const features = geojsonFormatter.readFeatures(json.routes);
        source調査ルート.addFeatures(features);
        features.forEach((f) => {
          const text = f.get('text');
          if (text == '始') {
            tabTokuteiSyodou.querySelector('input[name="txt始点"]').value = f.get('name');
          } else if (text == '終') {
            tabTokuteiSyodou.querySelector('input[name="txt終点"]').value = f.get('name');
          } else if (f.get('text')) {
            tbody特定初動調査.appendChild(create明細行(tabTokuteiSyodou, f));
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
    tabTokuteiSyodou.querySelector('button[name="btn初動調査登録"]').addEventListener('click', (e) => {
      showAlert('工事中', '調査ルートとして公開する処理は工事中です。');
    })
  }

>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
  // ====================================================
  // 調査依頼タブ
  // ====================================================
  function initTabTyosaIrai() {
    const source調査地点 = new ol.source.Vector();
    set調査地点Source(tabTyosaIrai, source調査地点, new ol.source.Vector());
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
        location.href = `?tab=tabTyosaIrai`;
      }, () => { });
    });
  }

  // ====================================================
  // 依頼状況タブ
  // ====================================================
  function initTabIraiJyokyo() {
    const source調査地点 = new ol.source.Vector();
    set調査地点Source(tabIraiJyokyo, source調査地点, new ol.source.Vector());
    const sel調査依頼 = tabIraiJyokyo.querySelector('select[name="sel調査依頼"]');
    const tbody依頼状況 = tabIraiJyokyo.querySelector('#table依頼状況>tbody');
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
          const trElement = create明細行(tabIraiJyokyo, f);
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
<<<<<<< HEAD
=======

  // ====================================================
  // ルート作成タブ
  // ====================================================
  function initTabRouteCreate(tempid) {
    // 画面初期状態を読み込み（一時保存id指定時はその保存内容を読み出し）
    ajaxExecute(`/?Handler=Plan&tempid=${tempid || ''}`, {},
      { title: tempid ? '一時保存ルート呼出・削除' : '調査ルート作成' }
    ).then((json) => {
      // まずは画面表示内容を初期化
      tbodyルート作成.innerHTML = '';
      selectedFeatureIds = json.id;
      const features = geojsonFormatter.readFeatures(json.features);
      features.forEach((f) => {
        const id = f.get('id');
        f.setId(`${id}`);
        const trElement = add明細行(tbodyルート作成, f);
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
    $(tabRouteCreate.querySelector('select[name="irai"]')).multiselect('selectAll');
    $(tabRouteCreate.querySelector('select[name="priority"]')).multiselect('deselectAll');
    tabRouteCreate.querySelector('select[name="persons"]').value = '';
  };


  // *************************************************************************************************************************
  // *************************************************************************************************************************
  // *************************************************************************************************************************
  // *************************************************************************************************************************
  // *************************************************************************************************************************
  const tbodyルート作成 = document.querySelector('#tableルート作成>tbody');
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f

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
<<<<<<< HEAD
      $(tabルート作成.querySelector('select[name="irai"]')).multiselect('selectAll');
      $(tabルート作成.querySelector('select[name="priority"]')).multiselect('deselectAll');
      tabルート作成.querySelector('select[name="persons"]').value = '';
=======
      $(tabRouteCreate.querySelector('select[name="irai"]')).multiselect('selectAll');
      $(tabRouteCreate.querySelector('select[name="priority"]')).multiselect('deselectAll');
      tabRouteCreate.querySelector('select[name="persons"]').value = '';
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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
<<<<<<< HEAD
    const /** @type{HTMLSelectElement} */ sel調査依頼Filter = tabルート作成.querySelector('select[name="irai"]');
    const /** @type{HTMLSelectElement} */ sel優先度Filter = tabルート作成.querySelector('select[name="priority"]');
    const /** @type{HTMLSelectElement} */ sel搭乗人数Filter = tabルート作成.querySelector('select[name="persons"]');
=======
    const /** @type{HTMLSelectElement} */ sel調査依頼Filter = tabRouteCreate.querySelector('select[name="irai"]');
    const /** @type{HTMLSelectElement} */ sel優先度Filter = tabRouteCreate.querySelector('select[name="priority"]');
    const /** @type{HTMLSelectElement} */ sel搭乗人数Filter = tabRouteCreate.querySelector('select[name="persons"]');
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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
<<<<<<< HEAD
    const /** @type{HTMLSelectElement} */ selルート作成起点 = tabルート作成.querySelector('select[name="selルート作成起点"]');
    const /** @type{HTMLSelectElement} */ selルート作成終点 = tabルート作成.querySelector('select[name="selルート作成終点"]');
=======
    const /** @type{HTMLSelectElement} */ selルート作成起点 = tabRouteCreate.querySelector('select[name="selルート作成起点"]');
    const /** @type{HTMLSelectElement} */ selルート作成終点 = tabRouteCreate.querySelector('select[name="selルート作成終点"]');
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f

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
<<<<<<< HEAD
    tabルート作成.querySelector('button[name="btnルート起点終点反転"]').addEventListener('click', (e) => {
=======
    tabRouteCreate.querySelector('button[name="btnルート起点終点反転"]').addEventListener('click', (e) => {
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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
<<<<<<< HEAD
      formData.append('auto', tabルート作成.querySelector('input[name="radioルート作成モード"]').value);
=======
      formData.append('auto', tabRouteCreate.querySelector('input[name="radioルート作成モード"]').value);
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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
<<<<<<< HEAD
        { title: title, form: tabルート作成, progress: calc ? '最短ルート自動作成中' : null },
=======
        { title: title, form: tabRouteCreate, progress: calc ? '最短ルート自動作成中' : null },
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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
<<<<<<< HEAD
          setInvalidStyle(tabルート作成, json.erroritems);
=======
          setInvalidStyle(tabRouteCreate, json.erroritems);
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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
<<<<<<< HEAD
          { title: button.dataset.modaltitle, form: tabルート作成 }
=======
          { title: button.dataset.modaltitle, form: tabRouteCreate }
>>>>>>> f28a51702256b74a3f85866d5ee9c736fef8342f
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

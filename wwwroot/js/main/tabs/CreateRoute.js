'use strict';

export function CreateRoute({
  base_url,
  tabElement,
  map,
  mapDraw,
  layer,
  set調査地点Source,
  ajaxExecute,
  geojsonFormatter,
  showAlert,
  showConfirm,
  proj3857,
  proj4326,
  getSelectedFeatureIds,
  setSelectedFeatureIds,
  reverseSelectedFeatureIds
}) {

  // DOM 参照
  const modal調査予定登録Element = document.getElementById('modal調査予定登録');
  const source調査地点 = new ol.source.Vector();
  const selルート作成起点 = (tabElement) ? tabElement.querySelector('select[name="selルート作成起点"]') : null;
  const selルート作成終点 = (tabElement) ? tabElement.querySelector('select[name="selルート作成終点"]') : null;
  const sel搭乗人数 = (tabElement) ? tabElement.querySelector('select[name="sel搭乗人数"]') : null;
  // フィルタ用 select 要素取得（initialize の外でも使う）
  const selIrai = tabElement.querySelector('select[name="irai"]');
  const selPriority = tabElement.querySelector('select[name="priority"]');
  const selPersons = tabElement.querySelector('select[name="persons"]');
  const toastEl = document.getElementById('toast起点終点設定');
  let displayingToast = toastEl ? bootstrap.Toast.getOrCreateInstance(toastEl) : null;

  // ---------------------------------------------------------------------------------
  // 初期化関数（公開）
  const initialize = (tempid) => {
    const tbody = tabElement.querySelector('#tableルート作成>tbody');
    set調査地点Source(tabElement, source調査地点, new ol.source.Vector());

    // 画面初期状態を読み込み（一時保存id指定時はその保存内容を読み出し）
    ajaxExecute(base_url + `?Handler=InitialPlan&tempid=${tempid || ''}`, {},
      { title: tempid ? '一時保存ルート呼出・削除' : '調査ルート作成' }
    ).then((json) => {
      // -----------------------
      // 地点名一覧
      tbody.innerHTML = '';
      setSelectedFeatureIds(json.id ?? []);
      const features = geojsonFormatter.readFeatures(json.features);
      features.forEach((f) => {
        const id = f.get('id');
        f.setId(`${id}`);
        const trElement = createDetailRecord(tabElement, f);
        if ((getSelectedFeatureIds() || []).indexOf(id) != -1) {
          const cb = trElement.querySelector('input[type="checkbox"][name="id"]');
          if (cb) cb.checked = true;
        }
        tbody.appendChild(trElement);
      });
      source調査地点.clear();
      source調査地点.addFeatures(features);

      // -----------------------
      // ルート作成
      if (json.startx && json.starty) {
        selルート作成起点.value = add起点終点OptionIfNotExists(json.startx, json.starty);
      }
      if (json.endx && json.endy) {
        selルート作成終点.value = add起点終点OptionIfNotExists(json.endx, json.endy);
      }
      if (json.startid) {
        for (const option of selルート作成起点.options) {
          if (json.startid == option.dataset.id) option.selected = true;
        }
      }
      if (json.endid) {
        for (const option of selルート作成終点.options) {
          if (json.endid == option.dataset.id) option.selected = true;
        }
      }

      // -----------------------
      // 搭乗人数
      if (json.num_people) {
        sel搭乗人数.value = json.num_people;
      }
      const radio手動 = document.getElementById('radioルート手動作成');
      const radio自動 = document.getElementById('radioルート自動作成');
      if (radio手動 && radio自動) {
        radio手動.checked = !json.auto;
        radio自動.checked = json.auto;
      }
      // -----------------------
      // 登録時情報も設定
      modal調査予定登録Element.querySelector('input[name="tempid"]').value = tempid || '';
      modal調査予定登録Element.querySelector('input[name="input.title"]').value = json.title;
      modal調査予定登録Element.querySelector('input[name="drawroute"]').value = json.drawroute ? geojsonFormatter.writeGeometry(geojsonFormatter.readGeometry(json.drawroute)) : '';
      const toast調査ルート手動描画Element = document.getElementById('toast調査ルート手動描画');
      toast調査ルート手動描画Element.querySelector('button[name="btn調査ルート手動描画削除"]').disabled = !json.drawroute;

      // -----------------------
      // 調査依頼絞り込み フィルタ初期化 
      // もしグローバル関数 initMultiSelect があるならそれを使う（既存の index.js と整合）
      if (typeof initMultiSelect === 'function') {
        if (selIrai) initMultiSelect(selIrai, filterルート作成対象, '調査依頼選択', '全依頼');
        if (selPriority) initMultiSelect(selPriority, filterルート作成対象, '優先度');
      } else {
        try {
          if (selIrai && window.jQuery && $(selIrai).multiselect) $(selIrai).multiselect('selectAll');
          if (selPriority && window.jQuery && $(selPriority).multiselect) $(selPriority).multiselect('deselectAll');
        } catch (e) {
          console.warn('multiselect 初期化失敗:', e);
        }
        // 常に filter を実行して一覧表示状態を整える
        filterルート作成対象();
      }
      if (selPersons) selPersons.value = '';

      // ルート表示実施（距離算出処理実行、自動ルート作成は解除しない）
      //autoCalculateDistance(false);
    }, (error) => {
      if (tempid) {
        location.reload(); // エラー（その一時保存データが編集できない）なら画面再読み込み
      }
    });
  };
  function show() {

  }

  // ---------------------------------------------------------------------------------
  // フィルタ関数（選択肢変更時に一覧の表示/非表示を切り替える）
  const filterルート作成対象 = () => {
    const tbody = tabElement.querySelector('#tableルート作成>tbody');
    const irai = selIrai ? Array.from(selIrai.selectedOptions).map(o => o.value) : [];
    const priority = selPriority ? Array.from(selPriority.selectedOptions).map(o => o.value) : [];
    const persons = selPersons ? selPersons.value : '';
    tbody.querySelectorAll('tr').forEach((tr) => {
      const visible =
        (irai.length === 0 || irai.indexOf(tr.dataset.irai) !== -1) &&
        (priority.length === 0 || priority.indexOf(tr.dataset.priority) !== -1) &&
        (persons === '' || Number(tr.dataset.persons) <= Number(persons));
      tr.classList.toggle('d-none', !visible);
    });
  };

  // 各種イベント登録（select の change でフィルタ再実行）
  if (selIrai) selIrai.addEventListener('change', filterルート作成対象);
  if (selPriority) selPriority.addEventListener('change', filterルート作成対象);
  if (selPersons) selPersons.addEventListener('change', filterルート作成対象);


  // ---------------------------------------------------------------------------------
  // 起点終点プルダウンに　手入力緯度系をオプション追加
  const add起点終点OptionIfNotExists = (lon, lat) => {
    if (!lon && !lat) {
      return '';
    }
    const x = Number(lon).toFixed(6);
    const y = Number(lat).toFixed(6);
    const optionValue = `${x} / ${y}`;
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

  // ---------------------------------------------------------------------------------
  const initルート作成起点終点 = (sel, name) => {
    let prevVal = sel.value;
    sel.addEventListener('change', (e) => {
      if (sel.value == '*') {
        // 起点終点 描画オブジェクトを初期化して設定
        const mapDraw起点終点 = new ol.interaction.Draw({
          type: 'Point',
        });
        mapDraw起点終点.on('drawend', function (e) {
          const point = ol.proj.transform(e.feature.getGeometry().getFirstCoordinate(), proj3857, proj4326);
          const optionValue = add起点終点OptionIfNotExists(point[0], point[1]);
          sel.value = optionValue;
          prevVal = optionValue;
          displayingToast.hide();
          map.removeInteraction(mapDraw起点終点);
          autoCalculateDistance();
        });
        map.addInteraction(mapDraw起点終点);
         // 表示用トーストを取得・作成（要素があれば）
        displayingToast.hide();
        // ヘッダ表示を安全にセットしてトースト表示
        if (toastEl) {
          toastEl.querySelector('div.toast-header').innerHTML = `${name}指定`;
        }
        displayingToast?.show();
        sel.value = prevVal;
      } else {
        prevVal = sel.value;
        autoCalculateDistance();
      }
    });
  };
  if (selルート作成起点 && selルート作成終点) {
    initルート作成起点終点(selルート作成起点, '起点');
    initルート作成起点終点(selルート作成終点, '終点');
  }
  // ---------------------------------------------------------------------------------
  // 起点終点　反転ボタン　イベント
  tabElement.querySelector('button[name="btnルート起点終点反転"]').addEventListener('click', (e) => {
    // 始点と終点を反転（選択経路も反転）
    const old起点Value = selルート作成起点.value;
    const old終点Value = selルート作成終点.value;
    reverseSelectedFeatureIds();
    selルート作成起点.value = old終点Value
    selルート作成終点.value = old起点Value;
    // 距離算出処理実行（自動ルート作成は解除しない）
    autoCalculateDistance(false);
  });

  // ---------------------------------------------------------------------------------
  // create調査予定FormData
  const create調査予定FormData = (mode) => {
    modal調査予定登録Element.querySelector('input[name="mode"]').value = mode;
    const opt起点 = selルート作成起点.options[selルート作成起点.selectedIndex];
    const opt終点 = selルート作成終点.options[selルート作成終点.selectedIndex];
    const opt人数 = sel搭乗人数.options[sel搭乗人数.selectedIndex];
    const auto = tabElement.querySelector( 'input[name="radioルート作成モード"]:checked' ).value === "true";

    const formData = new FormData(modal調査予定登録Element);
    formData.append('input.startid', opt起点.dataset.id || '');
    formData.append('input.endid', opt終点.dataset.id || '');
    formData.append('input.auto', auto ? 1 : 0);
    formData.append('auto', auto ? 1 : 0);
    formData.append('startx', opt起点.dataset.x || '');
    formData.append('starty', opt起点.dataset.y || '');
    formData.append('endx', opt終点.dataset.x || '');
    formData.append('endy', opt終点.dataset.y || '');
    formData.append('input.num_people', opt人数.value || '');
    for (let id of (getSelectedFeatureIds() || [])) { formData.append('id', id); }
    return formData;
  };

  // ---------------------------------------------------------------------------------
  // 距離算出処理
  const autoCalculateDistance = (calc = null) => {
    console.log("autoCalculateDistance:!!");
    const tbody = tabElement.querySelector('#tableルート作成>tbody');
    if (calc === null) {
      document.getElementById('radioルート手動作成').checked = true;
    }
    const title = calc ? 'ルート自動作成' : 'ルート作成';
    const formData = create調査予定FormData(calc ? 'calc' : '');
    console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    ajaxExecute(base_url + '?Handler=Plan',
      { method: 'POST', body: formData },
      { title: title, form: tabElement, progress: calc ? '最短ルート自動作成中' : null },
    ).then((json) => {
      // 得られた調査ルートを表示反映
      layer.getSource().clear();
      if (json.経路) {
        const features = geojsonFormatter.readFeatures(json.経路);
        const features2 = geojsonFormatter.readFeatures(json.経路);
        layer.getSource().addFeatures(features);
      }
      // 飛行距離等の情報を表示
      document.getElementById('divルート作成_飛行距離').innerHTML = json.飛行距離 || '-';
      document.getElementById('divルート作成_調査箇所').innerHTML = json.調査箇所 || '-';
      document.getElementById('divルート作成_調査時間').innerHTML = json.調査時間 || '-';
      document.getElementById('divルート作成_飛行可能時間').innerHTML = json.飛行可能時間 || '-';
      // 入力エラーがあればエラーを表示
      if (json.error) {
        showAlert(title + 'エラー', json.error);
        setInvalidStyle(tabElement, json.erroritems);
      }
      // サーバ側で有効とみなされた地点を画面に反映
      setSelectedFeatureIds(json.id || []);
      source調査地点.changed();
      tbody.querySelectorAll(`input[type="checkbox"][name="id"]:checked`).forEach((cb) => {
        const index = (getSelectedFeatureIds() || []).indexOf(cb.value);
        if (index == -1) {
          cb.checked = false;
          cb.disabled = true;
          cb.closest('tr').classList.add('text-secondary');
        }
      });
    }, () => { });
  };

  // ---------------------------------------------------------------------------------
  // 経路　手動／自動　ラジオボタンイベント
  const radio自動 = document.getElementById('radioルート自動作成');
  if (radio自動) radio自動.addEventListener('click', async (e) => {
//    autoCalculateDistance(true);
  });

  // ---------------------------------------------------------------------------------
  // Undo
  const btnUndo = document.getElementById('btnルート作成Undo');
  if (btnUndo) {
    const tbody = tabElement.querySelector('#tableルート作成>tbody');
    btnUndo.addEventListener('click', (e) => {
      const arr = getSelectedFeatureIds() || [];
      if (arr.length) {
        const featureId = arr.pop();
        setSelectedFeatureIds(arr);
        tbody.querySelectorAll(`input[type="checkbox"][name="id"][value="${featureId}"]`).forEach((cb) => {
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        });
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // ルート作成ボタン（ルート計算）　イベント
  document.getElementById('btnルート作成').addEventListener('click', async (e) => {
    autoCalculateDistance(true);
  });

  // ---------------------------------------------------------------------------------
  // 手動描画関連（削除・開始）
//  const toast調査ルート手動描画Element = document.getElementById('toast調査ルート手動描画');
//  toast調査ルート手動描画Element.addEventListener('hidden.bs.toast', (e) => {
//    if (mapDraw) {
//      map.removeInteraction(mapDraw);
//      mapDraw = null;
//    }
//  });
//  const btn調査ルート手動描画削除 = toast調査ルート手動描画Element.querySelector('button[name="btn調査ルート手動描画削除"]');
//  if (btn調査ルート手動描画削除) {
//    btn調査ルート手動描画削除.addEventListener('click', (e) => {
//      modal調査予定登録Element.querySelector('input[name="drawroute"]').value = '';
//      btn調査ルート手動描画削除.disabled = true;
//      displayingToast.hide();
//
//      autoCalculateDistance();
//    });
//  }
//  const btn調査ルート手動描画 = document.getElementById('btn調査ルート手動描画');
//  if (btn調査ルート手動描画) {
//    btn調査ルート手動描画.addEventListener('click', async (e) => {
//      mapDraw = new ol.interaction.Draw({
//        type: 'LineString',
//        condition: (ev) => { return ev.originalEvent.button !== 2; }
//      });
//      mapDraw.on('drawend', function (ev) {
//        modal調査予定登録Element.querySelector('input[name="drawroute"]').value = geojsonFormatter.writeGeometry(ev.feature.getGeometry());
//        btn調査ルート手動描画削除.disabled = false;
//        displayingToast.hide();
//        autoCalculateDistance();
//      });
//      map.addInteraction(mapDraw);
//      displayingToast = bootstrap.Toast.getOrCreateInstance(toast調査ルート手動描画Element);
//      displayingToast.show();
//    });
//  }
  // ---------------------------------------------------------------------------------
  // 一時保存調査依頼に対する操作各種
  const modal調査予定呼び出しElement = document.getElementById('modal調査予定呼び出し');
  document.getElementById('btn一時保存調査予定呼出').addEventListener('click', async (e) => {
    if (layer.getSource().getFeatures().length
      && await showConfirm('一時保存ルート呼出・削除',
        '現在表示されている調査ルートが保存されていません。'
        + '\n保存前に呼出を実施すると現在表示されている調査ルートが失われますが、呼出を続けてよろしいでしょうか？') != true
    ) {
      return;
    }
    initialize(document.getElementById('sel一時保存調査予定').value);
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

  // ---------------------------------------------------------------------------------
  // 調査予定登録関連イベント
  const btn調査予定登録実行 = modal調査予定登録Element.querySelector('button[value="register"]');
  const elem飛行時間超過 = document.getElementById('modalRouteCreateOverflow');
  const modal飛行時間超過 = new bootstrap.Modal(elem飛行時間超過);
  let btnValue = {};
  document.querySelectorAll('button[name="btn調査予定登録"]').forEach((button) => {
    button.addEventListener('click', (e) => {
      const formData = create調査予定FormData('check');
      ajaxExecute(modal調査予定登録Element.action,
        { method: 'POST', body: formData },
        { title: button.dataset.modaltitle, form: tabElement }
      ).then((response) => {
        const 飛行可能時間 = Number(response.飛行可能時間分);
        const 調査時間 = Number(response.飛行時間分);
        if (調査時間 > 飛行可能時間) {
          btnValue = {
            title: button.dataset.modaltitle,
            caption: button.dataset.modalcaption,
            button: button.dataset.modalbutton,
            name: button.vlaue,
          };
          modal飛行時間超過.show();
          return;
        }
        // 公開名入力ダイアログ
        modal調査予定登録Element.querySelector('.modal-title').innerHTML = button.dataset.modaltitle;
        modal調査予定登録Element.querySelector('.modal-body>div:first-child').innerHTML = button.dataset.modalcaption;
        btn調査予定登録実行.innerHTML = button.dataset.modalbutton;
        const modal = bootstrap.Modal.getOrCreateInstance(modal調査予定登録Element);
        modal.show();
        btn調査予定登録実行.value = button.value;
      }, () => { });
    });
  });
  if (elem飛行時間超過) {
    elem飛行時間超過.addEventListener('hide.bs.modal', (ev) => {
      try {
        const active = document.activeElement;
        if (active && elem飛行時間超過.contains(active)) {
          active.blur?.();
          (document.documentElement).focus?.();
        }
      } catch (ex) {
        console.warn('modal hide focus cleanup failed', ex);
      }
    });
  }

  document.getElementById('btnContinue').addEventListener('click', async (e) => {
    modal調査予定登録Element.querySelector('.modal-title').innerHTML = btnValue.title;
    modal調査予定登録Element.querySelector('.modal-body>div:first-child').innerHTML = btnValue.caption;
    btn調査予定登録実行.innerHTML = btnValue.button;
    const modal = bootstrap.Modal.getOrCreateInstance(modal調査予定登録Element);
    modal.show();
    btn調査予定登録実行.value = 'register';
  });

  if (btn調査予定登録実行) {
    btn調査予定登録実行.addEventListener('click', async (e) => {
      const formData = create調査予定FormData(btn調査予定登録実行.value);
      const isKml = tabElement.querySelector( 'input[name="input.kml"]:checked' ).value === "true";
      ajaxExecute(base_url + '?Handler=Plan',
        { method: 'POST', body: formData },
        { title: modal調査予定登録Element.querySelector('.modal-title').innerHTML, form: modal調査予定登録Element }
      ).then(async (response) => {
        console.log(response);
        console.log(isKml);
        if (isKml) {
        } else {
          location.href = `?`;
        }
      }, () => { });
    });
  }
  const getSpotTypeDisplay = (spottype) => {
    let text = spottype;
    text = text.replace('河川KP', 'KPデータ（河川）');
    text = text.replace('道路KP', 'KPデータ（道路）');
    return text;
  };
  /**
   * featureをもとに一覧明細行を作成します。featureのcheckboxプロパティには明細行のcheckboxオブジェクトを設定します。
   * @param {HTMLDivElement} tab 画面下部の表示対象タブ
   * @param {ol.Feature} feature 調査箇所のFeature
   * @returns {HTMLTableRowElement} 明細行
   */
  function createDetailRecord(tab, feature) {
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
    innerHTML += `<td class="text-center"><input type="checkbox" name="id" value="${id}" class="form-check-input chkCreateRoute"></td>`;
    // 地点名
    innerHTML += `<td><input type="text" readonly class="py-0 my-0 form-control-plaintext" value="${htmlEncode(name)}"></td>`;
    // 依頼者
    innerHTML += `<td class="text-center">${requester}</td>`;
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
    innerHTML += `<td class="text-center">${updated}</td>`;
    trElement.innerHTML = innerHTML;
    const checkbox = trElement.querySelector('input[type="checkbox"]');
    if (checkbox) { feature.set('checkbox', checkbox); }
    return trElement;
  }

  function hide() {

  }

  return {
    initialize,
    show,
    hide,
    autoCalculateDistance
  };
}

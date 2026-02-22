'use strict';

export function CreateRoute({
  base_url,
  tabElement,
  map,
  layer調査ルート,
  set調査地点Source,
  create明細行,
  ajaxExecute,
  geojsonFormatter,
  showAlert,
  showConfirm,
  proj3857,
  proj4326,
  getSelectedFeatureIds,
  setSelectedFeatureIds
}) {

  // DOM 参照
  const modal調査予定登録Element = document.getElementById('modal調査予定登録');
  const tbodyルート作成 = tabElement.querySelector('#tableルート作成>tbody');
  const tbody = tbodyルート作成;
  const source調査地点 = new ol.source.Vector();
  set調査地点Source(tabElement, source調査地点, new ol.source.Vector());
  const selルート作成起点 = tabElement.querySelector('select[name="selルート作成起点"]');
  const selルート作成終点 = tabElement.querySelector('select[name="selルート作成終点"]');
  // フィルタ用 select 要素取得（initialize の外でも使う）
  const selIrai = tabElement.querySelector('select[name="irai"]');
  const selPriority = tabElement.querySelector('select[name="priority"]');
  const selPersons = tabElement.querySelector('select[name="persons"]');

  // ---------------------------------------------------------------------------------
  // 初期化関数（公開）
  const initialize = (tempid) => {
    console.log("initルート作成 (CreateRoute)!!!!!");
    // 画面初期状態を読み込み（一時保存id指定時はその保存内容を読み出し）
    ajaxExecute(base_url + `?Handler=InitialPlan&tempid=${tempid || ''}`, {},
      { title: tempid ? '一時保存ルート呼出・削除' : '調査ルート作成' }
    ).then((json) => {

      // -----------------------
      // 初期化
      tbodyルート作成.innerHTML = '';
      setSelectedFeatureIds(json.id ?? []);
      const features = geojsonFormatter.readFeatures(json.features);
      features.forEach((f) => {
        const id = f.get('id');
        f.setId(`${id}`);
        const trElement = create明細行(tabElement, f);
        if ((getSelectedFeatureIds() || []).indexOf(id) != -1) {
          const cb = trElement.querySelector('input[type="checkbox"][name="id"]');
          if (cb) cb.checked = true;
        }
        tbodyルート作成.appendChild(trElement);
      });
      source調査地点.clear();
      source調査地点.addFeatures(features);

      // -----------------------
      // ルート作成
      if (selルート作成起点 && selルート作成終点) {
        selルート作成起点.value = add起点終点OptionIfNotExists(json.startx, json.starty);
        selルート作成終点.value = add起点終点OptionIfNotExists(json.endx, json.endy);
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
      // 調査依頼絞り込み フィルタ初期化 ---
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
      exec距離等算出(false);
    }, (error) => {
      if (tempid) {
        location.reload(); // エラー（その一時保存データが編集できない）なら画面再読み込み
      }
    });
  };

  // ---------------------------------------------------------------------------------
  // フィルタ関数（選択肢変更時に一覧の表示/非表示を切り替える）
  const filterルート作成対象 = () => {
    const irai = selIrai ? Array.from(selIrai.selectedOptions).map(o => o.value) : [];
    const priority = selPriority ? Array.from(selPriority.selectedOptions).map(o => o.value) : [];
    const persons = selPersons ? selPersons.value : '';
    tbodyルート作成.querySelectorAll('tr').forEach((tr) => {
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
        // 描画オブジェクトを初期化して設定
        mapDraw = new ol.interaction.Draw({
          type: 'Point',
        });
        mapDraw.on('drawend', function (e) {
          const point = ol.proj.transform(e.feature.getGeometry().getFirstCoordinate(), proj3857, proj4326);
          const optionValue = add起点終点OptionIfNotExists(point[0], point[1]);
          sel.value = optionValue;
          prevVal = optionValue;
          displayingToast.hide();
          exec距離等算出();
        });
        map.addInteraction(mapDraw);
        displayingToast = bootstrap.Toast.getOrCreateInstance(document.getElementById('toast起点終点設定'));
        document.getElementById('toast起点終点設定').querySelector('div.toast-header').innerHTML = `${name}指定`;
        displayingToast.show();
        sel.value = prevVal;
      } else {
        prevVal = sel.value;
        exec距離等算出();
      }
    });
  };
  if (selルート作成起点 && selルート作成終点) {
    initルート作成起点終点(selルート作成起点, '起点');
    initルート作成起点終点(selルート作成終点, '終点');
  }

  // ---------------------------------------------------------------------------------
  // create調査予定FormData
  const create調査予定FormData = (mode) => {
    modal調査予定登録Element.querySelector('input[name="mode"]').value = mode;
    const opt起点 = selルート作成起点.options[selルート作成起点.selectedIndex];
    const opt終点 = selルート作成終点.options[selルート作成終点.selectedIndex];
    const formData = new FormData(modal調査予定登録Element);
    formData.append('input.startid', opt起点.dataset.id || '');
    formData.append('input.endid', opt終点.dataset.id || '');
    formData.append('auto', tabElement.querySelector('input[name="radioルート作成モード"]').value);
    formData.append('startx', opt起点.dataset.x || '');
    formData.append('starty', opt起点.dataset.y || '');
    formData.append('endx', opt終点.dataset.x || '');
    formData.append('endy', opt終点.dataset.y || '');
    for (let id of (getSelectedFeatureIds() || [])) { formData.append('id', id); }
    return formData;
  };

  // ---------------------------------------------------------------------------------
  // 距離算出処理
  const exec距離等算出 = (calc = null) => {
    if (calc === null) {
      document.getElementById('radioルート手動作成').checked = true;
    }
    const title = calc ? 'ルート自動作成' : 'ルート作成';
    const formData = create調査予定FormData(calc ? 'calc' : '');
    ajaxExecute(base_url + '?Handler=Plan',
      { method: 'POST', body: formData },
      { title: title, form: tabElement, progress: calc ? '最短ルート自動作成中' : null },
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
        setInvalidStyle(tabElement, json.erroritems);
      }
      // サーバ側で有効とみなされた地点を画面に反映
      setSelectedFeatureIds(json.id || []);
      source調査地点.changed();
      tbody.querySelectorAll(`input[type="checkbox"][name="id"]:checked`).forEach((cb) => {
        const index = (getSelectedFeatureIds() || []).indexOf(cb.value);
        console.log("index:" + index);
        console.log("cb:" + cb.value);
        if (index == -1) {
          cb.checked = false;
          cb.disabled = true;
          cb.closest('tr').classList.add('text-secondary');
        }
      });
    }, () => { });
  };

  // ---------------------------------------------------------------------------------
  // 各種イベント登録
  tabElement.querySelector('input[name="chk全選択"]').addEventListener('change', () => {
    exec距離等算出();
  });
  tbody.addEventListener('change', (e) => {
    const cb = (e.target.type == 'checkbox' && e.target.name == 'id') ? e.target : e.target.closest('input[type="checkbox"][name="id"]');
    console.log("Change CB:" + cb);
    if (cb) {
      // selectedFeatureIds を更新
      const arr = new Set(getSelectedFeatureIds() || []);
      if (cb.checked) {
        arr.add(cb.value);
      } else {
        arr.delete(cb.value);
      }
      setSelectedFeatureIds(Array.from(arr));
      exec距離等算出();
    }
  });
  const radio自動 = document.getElementById('radioルート自動作成');
  if (radio自動) radio自動.addEventListener('click', async (e) => {
    exec距離等算出(true);
  });

  // ---------------------------------------------------------------------------------
  // Undo
  const btnUndo = document.getElementById('btnルート作成Undo');
  if (btnUndo) {
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
  // 手動描画関連（削除・開始）
  const toast調査ルート手動描画Element = document.getElementById('toast調査ルート手動描画');
  toast調査ルート手動描画Element.addEventListener('hidden.bs.toast', (e) => {
    if (mapDraw) {
      map.removeInteraction(mapDraw);
      mapDraw = null;
    }
  });
  const btn調査ルート手動描画削除 = toast調査ルート手動描画Element.querySelector('button[name="btn調査ルート手動描画削除"]');
  if (btn調査ルート手動描画削除) {
    btn調査ルート手動描画削除.addEventListener('click', (e) => {
      modal調査予定登録Element.querySelector('input[name="drawroute"]').value = '';
      btn調査ルート手動描画削除.disabled = true;
      displayingToast.hide();
      exec距離等算出();
    });
  }
  const btn調査ルート手動描画 = document.getElementById('btn調査ルート手動描画');
  if (btn調査ルート手動描画) {
    btn調査ルート手動描画.addEventListener('click', async (e) => {
      mapDraw = new ol.interaction.Draw({
        type: 'LineString',
        condition: (ev) => { return ev.originalEvent.button !== 2; }
      });
      mapDraw.on('drawend', function (ev) {
        modal調査予定登録Element.querySelector('input[name="drawroute"]').value = geojsonFormatter.writeGeometry(ev.feature.getGeometry());
        btn調査ルート手動描画削除.disabled = false;
        displayingToast.hide();
        exec距離等算出();
      });
      map.addInteraction(mapDraw);
      displayingToast = bootstrap.Toast.getOrCreateInstance(toast調査ルート手動描画Element);
      displayingToast.show();
    });
  }

  // ---------------------------------------------------------------------------------
  // 調査予定登録関連イベント
  const btn調査予定登録実行 = modal調査予定登録Element.querySelector('button[value="register"]');
  document.querySelectorAll('button[name="btn調査予定登録"]').forEach((button) => {
    button.addEventListener('click', (e) => {
      const formData = create調査予定FormData('check');
      ajaxExecute(modal調査予定登録Element.action,
        { method: 'POST', body: formData },
        { title: button.dataset.modaltitle, form: tabElement }
      ).then((response) => {
        modal調査予定登録Element.querySelector('.modal-title').innerHTML = button.dataset.modaltitle;
        modal調査予定登録Element.querySelector('.modal-body>div:first-child').innerHTML = button.dataset.modalcaption;
        btn調査予定登録実行.innerHTML = button.dataset.modalbutton;
        const modal = bootstrap.Modal.getOrCreateInstance(modal調査予定登録Element);
        modal.show();
        btn調査予定登録実行.value = button.value;
      }, () => { });
    });
  });
  if (btn調査予定登録実行) {
    btn調査予定登録実行.addEventListener('click', async (e) => {
      const formData = create調査予定FormData(btn調査予定登録実行.value);
      ajaxExecute(base_url + '?Handler=Plan',
        { method: 'POST', body: formData },
        { title: modal調査予定登録Element.querySelector('.modal-title').innerHTML, form: modal調査予定登録Element }
      ).then(async (response) => {
        location.href = `?`;
      }, () => { });
    });
  }

  return {
    initialize
  };
}

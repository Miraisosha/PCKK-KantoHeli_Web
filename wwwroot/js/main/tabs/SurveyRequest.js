'use strict';

export function SurveyRequest(
  {
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
  }) {
  let displayingToast = null;
  function setMapDraw(draw) {
    mapDraw = draw;
  }

  const source調査地点 = new ol.source.Vector();
  const tbody調査依頼 = document.querySelector('#table調査依頼>tbody');

  function initialize() {
  }
  function show() {
    set調査地点Source(tab調査依頼, source調査地点, new ol.source.Vector());
  }

  // --- ここから一括操作関連の追加 ---
  // 一括操作メニュー（「一括操作」ラベルを持つドロップダウンだけを対象）
  const bulkDropdown = Array.from(document.querySelectorAll('#tab調査依頼 .dropdown'))
    .find(dd => {
      const btn = dd.querySelector('.dropdown-toggle');
      return btn && btn.textContent && btn.textContent.trim().includes('一括操作');
    });
  const bulkItems = bulkDropdown ? Array.from(bulkDropdown.querySelectorAll('.dropdown-item')) : [];

  // 更新：一括操作ボタンの有効/無効を制御
  const updateBulkButtonsState = () => {
    const anyChecked = tbody調査依頼.querySelectorAll('input[type="checkbox"][name="id"]:checked').length > 0;
    bulkItems.forEach((it) => { it.disabled = !anyChecked; });
  };

  // 一括設定ダイアログ表示共通（type: 'priority'|'persons'|'remarks'）
  const showBulkModal = (type) => {
    // モーダルDOMを作る
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${type === 'priority' ? '優先度一括設定' : type === 'persons' ? '搭乗希望一括設定' : '備考一括設定'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            ${type === 'priority' ? `
              <div class="d-flex gap-2 justify-content-center">
                <button type="button" class="btn btn-outline-primary btn-priority" data-value="高">高</button>
                <button type="button" class="btn btn-outline-primary btn-priority" data-value="中">中</button>
                <button type="button" class="btn btn-outline-primary btn-priority" data-value="低">低</button>
              </div>
            ` : type === 'persons' ? `
              <div>
                <label class="form-label">搭乗人数</label>
                <select class="form-select" id="bulkPersonsSelect">
                  ${Array.from({ length: 9 }).map((_, i) => `<option value="${i}">${i === 0 ? 'なし' : i + '名'}</option>`).join('')}
                </select>
              </div>
            ` : `
              <div>
                <label class="form-label">備考</label>
                <input type="text" class="form-control" id="bulkRemarksInput" />
              </div>
            `}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="bulkOk">OK</button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    // 優先度選択のUI挙動
    let selectedPriority = null;
    modal.querySelectorAll('.btn-priority').forEach(b => {
      b.addEventListener('click', (e) => {
        modal.querySelectorAll('.btn-priority').forEach(x => x.classList.remove('btn-primary'));
        modal.querySelectorAll('.btn-priority').forEach(x => x.classList.add('btn-outline-primary'));
        b.classList.remove('btn-outline-primary');
        b.classList.add('btn-primary');
        selectedPriority = b.dataset.value;
      });
    });

    modal.querySelector('#bulkOk').addEventListener('click', async () => {
      const checked = Array.from(tbody調査依頼.querySelectorAll('input[type="checkbox"][name="id"]:checked'));
      if (!checked.length) {
        bsModal.hide();
        return;
      }
      if (type === 'priority') {
        if (!selectedPriority) { return; }
        checked.forEach(cb => {
          const tr = cb.closest('tr');
          // hidden input ない場合はスキップ
          const hidden = tr.querySelector('input[type="hidden"][name="input.priority"]');
          if (hidden) hidden.value = selectedPriority;
          // ボタンの見た目更新
          const buttons = tr.querySelectorAll('button[name="priority"]');
          buttons.forEach(btn => {
            const checkedBtn = (btn.value === selectedPriority);
            btn.classList.toggle('btn-primary', checkedBtn);
            btn.classList.toggle('btn-secondary', !checkedBtn);
            if (checkedBtn) btn.classList.remove('disabled'); else btn.classList.add('disabled');
          });
          // feature 更新
          const fid = cb.value;
          const feature = source調査地点.getFeatureById(fid);
          if (feature) feature.set('priority', selectedPriority);
        });
      } else if (type === 'persons') {
        const sel = modal.querySelector('#bulkPersonsSelect');
        const val = Number(sel.value);
        checked.forEach(cb => {
          const tr = cb.closest('tr');
          const personsSel = tr.querySelector('select[name="input.persons"]');
          if (personsSel) personsSel.value = val;
          const feature = source調査地点.getFeatureById(cb.value);
          if (feature) feature.set('persons', val);
        });
      } else if (type === 'remarks') {
        const txt = modal.querySelector('#bulkRemarksInput').value;
        checked.forEach(cb => {
          const tr = cb.closest('tr');
          const remarksInput = tr.querySelector('input[name="input.remarks"]');
          if (remarksInput) remarksInput.value = txt;
          const feature = source調査地点.getFeatureById(cb.value);
          if (feature) feature.set('remarks', txt);
        });
      }
      // レイヤ再描画（必要なら）
      source調査地点.changed();
      bsModal.hide();
    });

    modal.addEventListener('hidden.bs.modal', () => {
      // クリーンアップ
      modal.remove();
      updateBulkButtonsState();
    });
    bsModal.show();
  };

  // ドロップダウンメニューの各アイテムにハンドラを割当
  if (bulkItems.length >= 3) {
    // 初期は無効化
    bulkItems.forEach(it => it.disabled = true);
    // 優先度
    bulkItems[0].addEventListener('click', (e) => { e.preventDefault(); showBulkModal('priority'); });
    // 搭乗希望
    bulkItems[1].addEventListener('click', (e) => { e.preventDefault(); showBulkModal('persons'); });
    // 備考
    bulkItems[2].addEventListener('click', (e) => { e.preventDefault(); showBulkModal('remarks'); });
  }

  // tbody のチェックボックス状態変化で一括ボタン更新
  tbody調査依頼.addEventListener('change', (e) => {
    // 元々 global handler が selectedFeatureIds を管理しているのでここは UI 側の有効/無効だけ更新する
    console.log("Checkbox:OK!");
    updateBulkButtonsState();
  });
  // 初回状態
  updateBulkButtonsState();
  // --- ここまで一括操作関連の追加 ---


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
        e.feature.set('color', '#F618FD');
        e.feature.set('requester', toast調査地点追加Element.dataset.requester);
        e.feature.set('survey', drawType == 'LineString' ? '通過' : '周回');
        e.feature.set('spottype', drawType == 'LineString' ? '線' : '点');
        const trElement = create調査依頼行(e.feature);
        // 追加行のみを選択状態とし、フォーカスする
        tbody調査依頼.appendChild(trElement);
        trElement.scrollIntoView();
        tbody調査依頼.querySelectorAll('input[type="checkbox"][name="id"]').forEach(
          (cb) => {
            cb.checked = (cb.value == e.feature.getId());
            console.log("Checkbox:OK!" + cb.value + "/" + e.feature.getId());
          }
        );
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
    feature.set('name', kpResult.selRoadRiver + ' ' + kpResult.startKp + 'kp ～ ' + kpResult.endKp + 'kp');
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
    start追加地点指定(null);
  }
  function getSpotTypeDisplay(spottype) {
    let text = spottype;
    text = text.replace('河川KP', 'KPデータ（河川）');
    text = text.replace('道路KP', 'KPデータ（道路）');
    return text;
  }
  function hide() {

  }
  return {
    initialize,
    show,
    hide,
    create調査依頼行FromKP,
    setMapDraw
  };
}

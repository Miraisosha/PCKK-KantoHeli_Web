// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
// 調査依頼状況　タブ
// 
export function InvestigationRequestStatus(ctx) {
  const {
    base_url,
    tab依頼状況,
    set調査地点Source,
    geojsonFormatter,
    ajaxExecute,
    showAlert,
    showConfirm
  } = ctx;

  const source調査地点 = new ol.source.Vector();
  set調査地点Source(tab依頼状況, source調査地点, new ol.source.Vector());

  const sel調査依頼 = tab依頼状況.querySelector('select[name="sel調査依頼"]');
  const tbody依頼状況 = tab依頼状況.querySelector('#table依頼状況>tbody');
  const chk依頼状況_依頼中のみ表示 = document.getElementById('chk依頼状況_依頼中のみ表示');
  const btn依頼取消 = tab依頼状況.querySelector('button[name="btn調査依頼取消"]');


  function initialize() {
    document.querySelector('select[name="sel調査依頼"]').disabled = document.querySelector('select[name="sel調査依頼"]').length < 1;
    document.querySelector('button[name="btn調査依頼取消"]').disabled = document.querySelector('select[name="sel調査依頼"]').length < 1;
  }

  // -------------------------
  // 一覧読込
  // -------------------------
  const load依頼状況 = () => {
    source調査地点.clear();
    tbody依頼状況.innerHTML = '';

    if (!sel調査依頼.value) return;

    const statusQuery = chk依頼状況_依頼中のみ表示.checked ? '&status=10' : '';

    ajaxExecute(
      base_url + '?Handler=SurveyRequest&id=' + sel調査依頼.value + statusQuery,
      {},
      { title: '調査依頼状況' }
    ).then((json) => {
      const features = geojsonFormatter.readFeatures(json.features);

      console.log("SurveyRequest:!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      features.forEach((f) => {
        console.log("createDetailRecord:OK");
        const tr = createDetailRecord(f);
        tbody依頼状況.appendChild(tr);
      });

      source調査地点.addFeatures(features);
    }, showAlert);
  };

  sel調査依頼.addEventListener('change', load依頼状況);
  chk依頼状況_依頼中のみ表示.addEventListener('change', load依頼状況);

  // -------------------------
  // 依頼取消処理
  // -------------------------
  if (btn依頼取消) {
    btn依頼取消.addEventListener('click', async () => {

      const checkboxes = tbody依頼状況.querySelectorAll( 'input[type="checkbox"][name="id"]:checked' );
      if (!checkboxes.length) {
        showAlert('依頼取消', '取消したい地点をチェック選択してください。');
        return;
      }

      const ok = await showConfirm(
        '依頼取消',
        'チェックしている地点の依頼を取消します。よろしいですか？',
        { okButtonName: '取消' }
      );
      if (!ok) return;

      const form依頼状況 = document.getElementById('form依頼状況');
      const formData = new FormData(form依頼状況);
      ajaxExecute(form依頼状況.action,
        { method: 'POST', body: formData },
        { title: '調査依頼の取消' }
      ).then(async (response) => {
        reload防災ヘリ関連情報()
          .then(() => {
            load依頼状況();
            return;
          })
          .catch(() => {
            load依頼状況();
            return;
          });
      }, () => { });
    });
  }

  // 登録方法　表示用
  const getSpotTypeDisplay = (spottype) => {
    let text = spottype;
    text = text.replace('河川KP', 'KPデータ（河川）');
    text = text.replace('道路KP', 'KPデータ（道路）');
    return text;
  };

  // 調査地点一覧　作成
  function createDetailRecord(feature) {
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
    innerHTML += `<td class="text-center"><input type="checkbox" name="id" value="${id}" class="form-check-input"></td>`;
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
    innerHTML += `<td>${status}</td>`;
    innerHTML += `<td class="text-center">${updated}</td>`;
    trElement.innerHTML = innerHTML;
    const checkbox = trElement.querySelector('input[type="checkbox"]');
    if (checkbox) { feature.set('checkbox', checkbox); }
    return trElement;
  }

  const reload防災ヘリ関連情報 = () => {
    return new Promise((resolve, reject) => {
      return resolve();
    });
  }

  return {
    initialize,
    reload: load依頼状況
  };
}


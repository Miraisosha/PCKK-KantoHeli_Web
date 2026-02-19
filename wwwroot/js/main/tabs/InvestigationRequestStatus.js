export function InvestigationRequestStatus(ctx) {
  const {
    base_url,
    tab依頼状況,
    set調査地点Source,
    geojsonFormatter,
    create明細行,
    ajaxExecute,
    reload防災ヘリ関連情報,
    showAlert,
    showConfirm
  } = ctx;

  const source調査地点 = new ol.source.Vector();
  set調査地点Source(tab依頼状況, source調査地点, new ol.source.Vector());

  const sel調査依頼 = tab依頼状況.querySelector('select[name="sel調査依頼"]');
  const tbody依頼状況 = tab依頼状況.querySelector('#table依頼状況>tbody');
  const chk依頼状況_依頼中のみ表示 =
    document.getElementById('chk依頼状況_依頼中のみ表示');

  // -------------------------
  // 一覧読込
  // -------------------------
  const load依頼状況 = () => {
    source調査地点.clear();
    tbody依頼状況.innerHTML = '';

    if (!sel調査依頼.value) return;

    const statusQuery =
      chk依頼状況_依頼中のみ表示.checked ? '&status=10' : '';

    ajaxExecute(
      base_url + '?Handler=SurveyRequest&id=' +
      sel調査依頼.value + statusQuery,
      {},
      { title: '調査依頼状況' }
    ).then((json) => {
      const features = geojsonFormatter.readFeatures(json.features);

      features.forEach((f) => {
        const tr = create明細行(tab依頼状況, f);
        tbody依頼状況.appendChild(tr);
      });

      source調査地点.addFeatures(features);
    }, showAlert);
  };

  sel調査依頼.addEventListener('change', load依頼状況);
  chk依頼状況_依頼中のみ表示.addEventListener('change', load依頼状況);

  load依頼状況();

  // -------------------------
  // 依頼取消処理
  // -------------------------
  const btn依頼取消 =
    tab依頼状況.querySelector('button[name="btn調査依頼取消"]');

  if (btn依頼取消) {
    btn依頼取消.addEventListener('click', async () => {

      const checkboxes =
        tbody依頼状況.querySelectorAll(
          'input[type="checkbox"][name="id"]:checked'
        );

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
            showAlert('依頼取消', json.success || '依頼を取消しました。');
          })
          .catch(() => {
            load依頼状況();
            showAlert('依頼取消', json.success || '依頼を取消しました。');
          });
      }, () => { });

//      const formData = new FormData();
//      checkboxes.forEach((cb) => formData.append('id', cb.value));
//
//      ajaxExecute(
//        base_url + '?Handler=DeleteSpot',
//        { method: 'POST', body: formData },
//        { title: '依頼取消', progress: '取消処理中...' }
//      ).then((json) => {
//
//        reload防災ヘリ関連情報()
//          .then(() => {
//            load依頼状況();
//            showAlert('依頼取消', json.success || '依頼を取消しました。');
//          })
//          .catch(() => {
//            load依頼状況();
//            showAlert('依頼取消', json.success || '依頼を取消しました。');
//          });
//
//      }, showAlert);
    });
  }

  return {
    reload: load依頼状況
  };
}


export function initCapital(ctx) {
  const {
    tabElement,
    set調査地点Source,
    create明細行,
    ajaxExecute,
    geojsonFormatter
  } = ctx;
  if (!tabElement) return null;

  // 初動調査ルート　プルダウン
  const sel初動調査ルート = tabElement.querySelector('select[name="routeid"]');

  // ---------------------------------------------------------------------------------
  // 初動調査ルート　読み込み
  function load初動調査ルート() {
    if (!sel初動調査ルート) {
      console.warn('initCapital: select[name="routeid"] が見つかりません。load初動調査ルート を中止します。');
      return;
    }

    const tbody = tabElement.querySelector('#table特定初動調査 tbody');
    const source = new ol.source.Vector();
    // 調査地点はこのタブでは使わないので空のsourceを渡す
    try {
      set調査地点Source(tabElement, new ol.source.Vector(), source);
    } catch (err) {
      console.warn('set調査地点Source 呼び出しでエラー', err);
    }
    if (tbody) tbody.innerHTML = '';

    ajaxExecute('?Handler=InitialRoute&route=' + encodeURIComponent(sel初動調査ルート.value), {}, { title: '初動調査ルート読み込み' })
      .then((json) => {
        // 地図へ描画
        const features = geojsonFormatter.readFeatures(json.routes);
        source.addFeatures(features);

        // 調査地点一覧
        features.forEach((f) => {
          const text = f.get('text');
          if (text === '始') {
            const el = tabElement.querySelector('input[name="txt始点"]');
            if (el) el.value = f.get('name');
          } else if (text === '終') {
            const el = tabElement.querySelector('input[name="txt終点"]');
            if (el) el.value = f.get('name');
          } else if (f.get('text')) {
            if (typeof create明細行 === 'function' && tbody) {
              try {
                tbody.appendChild(create明細行(tabElement, f));
              } catch (err) {
                console.warn('create明細行 でエラー:', err);
              }
            } else {
              console.warn('create明細行 が未定義または tbody がありません。');
            }
          }
        });
      })
      .catch((err) => {
        console.warn('初動調査ルート読み込み失敗', err);
      });
  }

  // ---------------------------------------------------------------------------------
  // イベント登録（明示的に存在チェック）
  if (sel初動調査ルート) {
    sel初動調査ルート.addEventListener('change', load初動調査ルート);
  }

  // ---------------------------------------------------------------------------------
  // 調査予定ルート　公開登録
  const btn公開 = tabElement.querySelector('button[name="btn初動調査登録"]');
  if (btn公開) {
    btn公開.addEventListener('click', () => {
      showAlert('工事中', '調査ルートとして公開する処理は工事中です。');
    });
  }

  return {
    load初動調査ルート
  };
}

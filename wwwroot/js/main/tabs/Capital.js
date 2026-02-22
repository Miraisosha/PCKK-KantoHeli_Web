
export function Capital(ctx) {
  const {
    base_url,
    tabElement,
    set調査地点Source,
    create明細行,
    ajaxExecute,
    geojsonFormatter
  } = ctx;
  if (!tabElement) return null;

  // 初動調査ルート　プルダウン
  const sel初動調査ルート = tabElement.querySelector('select[name="routeid"]');

  // 選択状態　ルート情報
  const selectedRoute = {
    startid:      11,
    endid:        11,
    auto:         false,
    startx:       null,
    starty:       null,
    endx:         null,
    endy:         null,
    firstRouteId: null,
    ids:          [],
  };

  // ---------------------------------------------------------------------------------
  // 初期設定
  function initialize() {
    // 初動調査ルート　プルダウン作成
    if (sel初動調査ルート) sel初動調査ルート.innerHTML = '';
    ajaxExecute(
      base_url + '?Handler=SurveyRouteList',
      {},
      { title: '初動調査ルート読み込み' }
    ).then((res) => {
      const routes = res.routes;
      const recommendRouteId    = res.recommendRouteId
      const isRequested         = res.isRequested;    // t_調査依頼に該当あり（t_スレッド の 初動調査ルートid を基準）
      const isPlanned = res.isPlanned;      // t_調査予定に該当あり（t_スレッド の 初動調査ルートid を基準）
      const isScheduled = res.isScheduled;     // 両方存在する場合は調査予定済みとして扱う

      // 調査予定ルートとして公開
      const btn公開 = tabElement.querySelector('button[name="btn初動調査登録"]');
      if (isScheduled) {
        sel初動調査ルート.disabled = true;
        btn公開.disabled = true;
        btn公開.setAttribute('aria-disabled', 'true');
        btn公開.textContent = 'ルート公開済';
        routes.forEach(function (r) {
          if (r.value == recommendRouteId) {
            sel初動調査ルート.innerHTML = `<option value="${r.value}" ${(r.isLowest) ? "selected" : ""}>${r.name}：評価スコア${r.score}</option>`
          }
        });
      } else {
        sel初動調査ルート.disabled = false;
        btn公開.disabled = false;
        btn公開.removeAttribute('aria-disabled');
        btn公開.textContent = '調査予定ルートとして公開';
        sel初動調査ルート.innerHTML = routes.map((r) =>
          `<option value="${r.value}" ${(r.isLowest) ? "selected" : "" }>${r.name}：評価スコア${r.score}${(r.isLowest) ? "（推奨）" : "" }</option>`
        ).join('');
      }

      // 初動調査地点一覧
      loadInitialSurveyRoute();
    }).catch((err) => {
      console.warn('初動調査ルート読み込み失敗', err);
    });
  }

  // ---------------------------------------------------------------------------------
  // 初動調査ルート　読み込み
  function loadInitialSurveyRoute() {
    var 初動調査ルートid = sel初動調査ルート.value
    console.log("loadInitialSurveyRoute:" + 初動調査ルートid);
    if (!sel初動調査ルート) {
      console.warn('initCapital: select[name="routeid"] が見つかりません。load初動調査ルート を中止します。');
      return;
    }
    if (!初動調査ルートid) return;

    const tbody = tabElement.querySelector('#table特定初動調査 tbody');
    const source = new ol.source.Vector();
    // 調査地点はこのタブでは使わないので空のsourceを渡す
    try {
      set調査地点Source(tabElement, new ol.source.Vector(), source);
    } catch (err) {
      console.warn('set調査地点Source 呼び出しでエラー', err);
    }
    if (tbody) tbody.innerHTML = '';

    ajaxExecute(
      base_url + '?Handler=InitialRoute&route=' + 初動調査ルートid,
      {},
      { title: '初動調査地点読み込み' }
    ).then((json) => {
      // 地図へ描画
      const features = geojsonFormatter.readFeatures(json.routes);
      source.addFeatures(features);

      // 調査地点一覧
      features.forEach((f) => {
        const text = f.get('text');
        if (text === '始') {
          const el = tabElement.querySelector('input[name="txt始点"]');
          if (el) el.value = f.get('name');
          selectedRoute.endid = f.get('start_end_point_id');
          selectedRoute.endx = f.get('lng');
          selectedRoute.endy = f.get('lat');
        } else if (text === '終') {
          const el = tabElement.querySelector('input[name="txt終点"]');
          if (el) el.value = f.get('name');
          selectedRoute.startid = f.get('start_end_point_id');
          selectedRoute.startx = f.get('lng');
          selectedRoute.starty = f.get('lat');
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
      selectedRoute.firstRouteId = 初動調査ルートid;
      selectedRoute.ids = [];
    }).catch((err) => {
      console.warn('初動調査地点読み込み失敗', err);
    });
  }

  // ---------------------------------------------------------------------------------
  // イベント登録（明示的に存在チェック）
  if (sel初動調査ルート) {
    sel初動調査ルート.addEventListener('change', loadInitialSurveyRoute);
  }

  // ---------------------------------------------------------------------------------
  // 調査予定ルート　公開登録
  const btn公開 = tabElement.querySelector('button[name="btn初動調査登録"]');
  if (btn公開) {
    btn公開.addEventListener('click', async(e) => {
      const msg = "調査予定ルートとして公開します。\nよろしいですか？";
      if(await showConfirm('首都直下初動ルート公開',msg)) {
        const formData = create調査予定FormData('capital_register');
        ajaxExecute(base_url + '?Handler=Plan',
          { method: 'POST', body: formData }, { }
        ).then((res) => {
          location.href = base_url & "&tab=tab特定初動調査";
        }, () => { });
      }
    });
  }

  // ---------------------------------------------------------------
  // 距離算出関連
  const create調査予定FormData = (mode) => {
    const modal調査予定登録Element = document.getElementById('modal調査予定登録');
    modal調査予定登録Element.querySelector('input[name="mode"]').value = mode;
    const formData = new FormData(modal調査予定登録Element);
    formData.append('mode',  mode);
    formData.append('input.startid',  selectedRoute.startid);
    formData.append('input.endid',    selectedRoute.endid);
    formData.append('auto', false);
    formData.append('startx', selectedRoute.startx);
    formData.append('starty', selectedRoute.starty); 
    formData.append('endx',   selectedRoute.endx); 
    formData.append('endy',   selectedRoute.endy);
    formData.append('firstRouteId',  selectedRoute.firstRouteId);
    selectedRoute.ids.map(m => formData.append('id', m) );
    return formData;
  };

  return {
    initialize
  };
}

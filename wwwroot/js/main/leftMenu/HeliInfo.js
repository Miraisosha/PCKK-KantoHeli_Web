'use strict';

export function HeliInfo({
  base_url,
  geojsonFormatter,
  ajaxGetJson,
  showAlert,
  layer調査地点,
  layer調査ルート
}) {

  const form防災ヘリ関連情報 = document.getElementById('form防災ヘリ関連情報');

  // ------------------------------------------------
  function initialize() {
  }

  // ------------------------------------------------
  // checkbox変更
  form防災ヘリ関連情報
    .querySelectorAll('input[type="checkbox"]')
    .forEach((check) => {
      if (check.value) {
        check.addEventListener('change', () => {
          showFeatures();
        });
      }
    });

  // ------------------------------------------------
  // 全選択
  form防災ヘリ関連情報
    .querySelectorAll(
      'input[type="checkbox"][name="chkすべて選択"][data-target]'
    )
    .forEach((cb) => {
      const exec全選択 = () => {
        const checked = cb.checked;
        const checkboxes =
          document
            .querySelector(cb.dataset.target)
            .querySelectorAll('input[type="checkbox"][value]');
        checkboxes.forEach((check) => {
          if (check.value) check.checked = checked;
        });
        showFeatures();
      };
      cb.addEventListener('change', exec全選択);
      if (cb.checked) exec全選択();
    });

  // ------------------------------------------------
  // ルートカラー
  const routeColors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'
  ];
  const yoteiColor = new Map();
  let i = 0;
  form防災ヘリ関連情報
    .querySelectorAll('input[name="yotei"]')
    .forEach((r) => {
      yoteiColor[r.value] = routeColors[i];
      i++;
    });

  // ------------------------------------------------
  // 表示更新
  const showFeatures = () => {
    const formData = new FormData(form防災ヘリ関連情報);
    ajaxGetJson(
      base_url + '?Handler=Features&' +
      new URLSearchParams(formData).toString()
    )
      .then((json) => {
        const spots =
          geojsonFormatter.readFeatures(json.spots);
        layer調査地点.getSource().clear();
        layer調査地点.getSource().addFeatures(spots);
        const routes =
          geojsonFormatter.readFeatures(json.routes);
        routes.forEach(r => {
          if (r.get('name') && r.get('id')) {
            const id = r.get('id');
            r.set("color", yoteiColor[id]);
          }
        });
        layer調査ルート.getSource().clear();
        layer調査ルート.getSource().addFeatures(routes);
      }, showAlert);
  };

  return {
      initialize,
      showFeatures
  }
}

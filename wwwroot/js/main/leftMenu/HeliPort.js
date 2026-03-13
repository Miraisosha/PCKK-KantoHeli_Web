'use strict';

export function HeliPort(ctx) {
  const {
    root_url,
    layerHeliPort,
  } = ctx;

  function initialize() {
    const left事前情報Element = document.getElementById('left事前情報');
    const legendHeliPortElement = document.getElementById('legendHeliPort');
    legendHeliPortElement.style.display = 'none';
    left事前情報Element.querySelectorAll(`input[type="checkbox"][data-geojsonurl]`).forEach((chk) => {
      // チェック状態変更時に表示ON/Off切り替え
      chk.addEventListener('change', (e) => {
        layerHeliPort.setVisible(e.target.checked);
        legendHeliPortElement.style.display = e.target.checked ? 'block' : 'none';
      });
    });
  }
  return {
    initialize
  }
}

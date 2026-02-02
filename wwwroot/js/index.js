'use strict';
{
  // 検索条件変更時に一覧再表示
  document.querySelectorAll('#condForm input, #condForm select').forEach((inputElement) => {
    inputElement.addEventListener('change', (e) => {
      document.querySelector('#condForm').submit();
    })
  });
  // 初期表示/一覧表示更新時に編集ボタンイベント設定
  const setListTableEvent = () => {
    document.querySelectorAll('#listTable>tbody button[name="btn編集"]').forEach((button) => {
      button.addEventListener('click', (e) => { showEditModal(button.value); });
    });
  };
  setListTableEvent();

  // スレッド行　クリックイベント
  const setTabClickEvent = () => {
    document.querySelectorAll('#listTable>tbody .tabCellClick').forEach((elem) => {
      elem.addEventListener('click', (e) => {
        if (elem.id.match(/^td(\d+)-(\d+)$/)) {
          window.open('Main/' + RegExp.$2, "_blank");
        }
      });
    });
  };
  setTabClickEvent();

  // ----------------------------------------
  // 編集モーダル操作
  // ----------------------------------------
  const editModalElement = document.getElementById('editModal');
  const showEditModal = (id) => {
    // 編集ダイアログ起動
    ajaxGet(editModalElement.action + '?id=' + id)
      .then(async (response) => {
        editModalElement.querySelector('.modal-dialog').innerHTML = await response.text();
        initInputAssist(editModalElement);
        // 災害区分/特定初動調査区分の変更イベントを設定
        const sel災害区分 = editModalElement.querySelector('select[name="Input.災害区分id"]');
        const elements特定初動調査区分 = editModalElement.querySelectorAll('select[data-disasterid]');
        const change初動調査表示内容 = () => {
          // 現在選択されている災害区分に特定初動調査が定義されている場合、特定初動調査行表示＆当該災害区分のプルダウンのみ有効化
          let selected初動調査区分id = false; // 特定初動調査プルダウン未定義の災害区分の場合、falseのままとなる（行自体非表示）
          elements特定初動調査区分.forEach((/** @type{HTMLElement}*/ element) => {
            const selected = (element.dataset.disasterid == sel災害区分.value);
            element.style.display = (selected ? '' : 'none');
            element.disabled = !selected;
            if (selected) {
              selected初動調査区分id = element.value;
            }
          });
          editModalElement.querySelector('#row特定初動調査').style.display = (selected初動調査区分id !== false ? '' : 'none');
          editModalElement.querySelector('#row初動調査ルート').style.display = (selected初動調査区分id ? '' : 'none');
          // 特定初動調査区分が選択されている場合、初動調査ルート行表示＆選択されている特定初動調査区分についての初動調査ルートのみ有効化
          editModalElement.querySelectorAll('select[data-initialid]').forEach((/** @type{HTMLSelectElement}*/ element) => {
            const selected = (element.dataset.initialid == selected初動調査区分id);
            element.style.display = (selected ? '' : 'none');
            element.disabled = !selected;
          });
        };
        sel災害区分.addEventListener('change', () => change初動調査表示内容());
        elements特定初動調査区分.forEach((element) => {
          element.addEventListener('change', () => change初動調査表示内容());
        });
        change初動調査表示内容(); // 初期表示時にも実施
        // モーダル開始
        const editModal = bootstrap.Modal.getOrCreateInstance(editModalElement);
        editModal.show();
      });
  };
  document.querySelector('button[name="btn新規"]').addEventListener('click', (e) => { showEditModal(''); });

  // 登録ボタン
  editModalElement.addEventListener('submit', async (e) => {
    e.preventDefault(); // formとしてのsubmitは抑制
    const mode = editModalElement.querySelector('button[type="submit"]').innerText; // 送信ボタンから動作モード名を把握
    const confirm = await showConfirm('確認', '' + mode + 'します。よろしいですか？', { okButtonName: 'はい' });
    if (confirm) {
      const formData = new FormData(editModalElement);
      ajaxExecute(editModalElement.action,
        { method: 'POST', body: formData },
        { title: mode, form: editModalElement }
      ).then(() => {
        location.reload();
      }, () => { });
    }
  });
  // 削除ボタン
  editModalElement.addEventListener('reset', async (e) => {
    e.preventDefault(); // formとしてのresetは抑制
    const confirm = await showConfirm('確認', 'スレッドを削除します。よろしいですか？', { okButtonName: 'はい' });
    if (confirm) {
      const formData = new FormData(editModalElement);
      ajaxExecute(editModalElement.action + '?Handler=Delete',
        { method: 'POST', body: formData },
        { title: '削除', form: editModalElement }
      ).then(() => {
        location.reload();
      }, () => { });
    }
  });
}

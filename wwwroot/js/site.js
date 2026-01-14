'use strict';

/** Webルートパス（末尾「/」つき） @type {string} */
const BASE_URL = document.currentScript.src.substring(0, document.currentScript.src.indexOf('/js/site.js') + 1);

/** 一回のsubmitでアップロード可能なファイルサイズの上限 @type {number} */
let MAX_UPLOAD_SIZE_MB = 20;

// ----------------------------------------------------------------------------
// flatpickr関連
// ----------------------------------------------------------------------------
/** 祝日定義 @type {Array<string>} */
const JP_HOLIDAYS = [
  // from https://github.com/holidays-jp/api/tree/master/docs/v1
  "2019-01-01", "2019-01-14", "2019-02-11", "2019-03-21", "2019-04-29", "2019-04-30", "2019-05-01", "2019-05-02", "2019-05-03", "2019-05-04", "2019-05-05", "2019-05-06", "2019-07-15", "2019-08-11", "2019-08-12", "2019-09-16", "2019-09-23", "2019-10-14", "2019-10-22", "2019-11-03", "2019-11-04", "2019-11-23",
  "2020-01-01", "2020-01-13", "2020-02-11", "2020-02-23", "2020-02-24", "2020-03-20", "2020-04-29", "2020-05-03", "2020-05-04", "2020-05-05", "2020-05-06", "2020-07-23", "2020-07-24", "2020-08-10", "2020-09-21", "2020-09-22", "2020-11-03", "2020-11-23",
  "2021-01-01", "2021-01-11", "2021-02-11", "2021-02-23", "2021-03-20", "2021-04-29", "2021-05-03", "2021-05-04", "2021-05-05", "2021-07-22", "2021-07-23", "2021-08-08", "2021-08-09", "2021-09-20", "2021-09-23", "2021-11-03", "2021-11-23",
  "2022-01-01", "2022-01-10", "2022-02-11", "2022-02-23", "2022-03-21", "2022-04-29", "2022-05-03", "2022-05-04", "2022-05-05", "2022-07-18", "2022-08-11", "2022-09-19", "2022-09-23", "2022-10-10", "2022-11-03", "2022-11-23",
  "2023-01-01", "2023-01-02", "2023-01-09", "2023-02-11", "2023-02-23", "2023-03-21", "2023-04-29", "2023-05-03", "2023-05-04", "2023-05-05", "2023-07-17", "2023-08-11", "2023-09-18", "2023-09-23", "2023-10-09", "2023-11-03", "2023-11-23",
  "2024-01-01", "2024-01-08", "2024-02-11", "2024-02-12", "2024-02-23", "2024-03-20", "2024-04-29", "2024-05-03", "2024-05-04", "2024-05-05", "2024-05-06", "2024-07-15", "2024-08-11", "2024-08-12", "2024-09-16", "2024-09-22", "2024-09-23", "2024-10-14", "2024-11-03", "2024-11-04", "2024-11-23",
  "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24", "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05", "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23", "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21", "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05", "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11", "2027-11-03", "2027-11-23",
  "2028-01-01", "2028-01-10", "2028-02-11", "2028-02-23", "2028-03-20", "2028-04-29", "2028-05-03", "2028-05-04", "2028-05-05", "2028-07-17", "2028-08-11", "2028-09-18", "2028-09-22", "2028-10-09", "2028-11-03", "2028-11-23",
  "2029-01-01", "2029-01-08", "2029-02-11", "2029-02-12", "2029-02-23", "2029-03-20", "2029-04-29", "2029-04-30", "2029-05-03", "2029-05-04", "2029-05-05", "2029-07-16", "2029-08-11", "2029-09-17", "2029-09-23", "2029-09-24", "2029-10-08", "2029-11-03", "2029-11-23",
];
if (typeof flatpickr === 'function') {
  // 書式設定
  flatpickr.localize({
    weekdays: {
      shorthand: ["日", "月", "火", "水", "木", "金", "土"],
      longhand: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
    },
    months: {
      shorthand: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      longhand: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    },
    time_24hr: true,
    rangeSeparator: " から ",
    monthAriaLabel: "月",
    amPM: ["午前", "午後"],
    yearAriaLabel: "年",
    hourAriaLabel: "時間",
    minuteAriaLabel: "分",
  });
  // デフォルト設定
  flatpickr.setDefaults({
    allowInput: true,
    dateFormat: 'Y/m/d',
    onDayCreate: (dObj, dStr, fp, dayElem) => {
      // 祝日ならスタイルを追加
      if (JP_HOLIDAYS.includes(flatpickr.formatDate(dayElem.dateObj, 'Y-m-d'))) { dayElem.classList.add('jp-holiday'); }
    },
    onOpen: (selectedDates, dateStr, instance) => {
      // 日付入力欄が読み取り専用ならカレンダーを開かずcancel
      if (instance.input.readOnly) { instance.close(); }
    },
  });
}

// ----------------------------------------------------------------------------
// 画面全体制御関連
// ----------------------------------------------------------------------------
/**
 * dispArea(画面固定表示エリア)のリサイズ処理
 * （画面表示後にdispAreaより上の領域の表示をリサイズした場合にはこのメソッドを再度呼び出すこと）
 */
const resizeDispArea = () => {
  const dispAreaElement = document.getElementById('dispArea');
  if (dispAreaElement) {
    dispAreaElement.style.top = `${dispAreaElement.previousElementSibling.getBoundingClientRect().bottom + window.scrollY}px`;
  }
};
// ページ読み込み時にdispAreaリサイズ処理用の空divを登録し、ready/load/resize時にリサイズを実行
if (document.getElementById('dispArea')) {
  document.getElementById('dispArea').before(document.createElement('div')); // スクロール固定位置を確実に把握するため空の<div>をdispAreaの直前に登録
  resizeDispArea();
  window.addEventListener('load', resizeDispArea, { once: true });
  window.addEventListener('resize', resizeDispArea);
  window.addEventListener('orientationchange', resizeDispArea);
}

/**
 * 入力補完設定
 * （動的に画面表示要素を追加した場合には、追加した親要素を指定してこのメソッドを呼び出すこと）
 * @param {HTMLElement} rootElement 設定対象element
 */
const initInputAssist = (rootElement) => {
  // ※本システムでは<input type="text">のaccept属性にて入力可能文字等を指定する。現時点では、
  //   「Z(全角)」「d(日付:flatPickr自動適用)」「dt(日時:flatPickr自動適用)」「dts(日付・時分秒:flatPickr自動適用)」
  //   「@(メールアドレス)」「0(数字)」「08(数字桁数固定自動0パディング)」あるいは混在で「0Aa(英数大小)」などいった指定、
  //   もしくは数値桁数を(小数桁数/マイナス許容あればそれもつけて)「5」「3.4」「-9.2」「2.06(小数桁数固定)」などといった指定に対応している
  rootElement.querySelectorAll('input[type="text"][accept]').forEach((/** @type {HTMLInputElement} */ element) => {
    const accept = `${element.accept}`;
    // 日付入力はflatpickrを設定し終了。cssにより入力欄の幅も自動的に設定される
    if (accept.includes('d') && flatpickr && !element.disabled) {
      const options = {};
      if (accept.startsWith("dt")) {
        // 時刻指定有の場合の既定option値を設定
        options['dateFormat'] = (accept == 'dts') ? "Y/m/d H:i:S" : "Y/m/d H:i";
        options['enableTime'] = true;
        options['enableSeconds'] = (accept == 'dts');
        options['minuteIncrement'] = 1;
      }
      for (const key in element.dataset) {
        // そのほかdata-flatpickr-属性指定の値があればそれも設定
        if (key.startsWith('flatpickr')) {
          const optionKey = key.replace(/^flatpickr/, '');
          const camelKey = optionKey.charAt(0).toLowerCase() + optionKey.slice(1);
          options[camelKey] = element.dataset[key];
        }
      }
      element.style.inputMode = 'numeric';
      flatpickr(element, options);
      return;
    }
    // 全角入力（入力完了時に変換）
    if (accept.includes('Z')) {
      element.addEventListener('change', (e) => {
        const kanaMap = {
          ' ': '　',
          'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
          'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
          'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
          'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
          'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
          'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
          'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
          'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
          'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
          'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
          'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
          'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
          'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
          'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
          'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
          'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
          'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
          'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
          '｡': '。', '､': '、', 'ｰ': 'ー', '｢': '「', '｣': '」', '･': '・'
        };
        e.target.value = e.target.value
          .replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)) // ASCIIを全角へ
          .replace(new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g'), (c) => kanaMap[c]); // スペース及びカナを全角へ
      });
      return;
    }
    // 入力文字種制限（キー入力時に除去）
    const integerDigits = Math.abs(parseInt(accept)); // 整数入力の桁数
    let decimalPlaces = null; // 小数入力許容時の最大許容桁数
    let acceptPattern = ''; // 入力許容文字の正規表現
    if (accept.includes('-')) { acceptPattern += '\\-'; }
    if (accept.includes('0') || integerDigits) { acceptPattern += '0-9'; }
    if (accept.includes('.')) {
      acceptPattern += '\\.';
      decimalPlaces = parseInt(accept.substring(accept.indexOf('.') + 1)); // 小数入力桁数を決定
    }
    if (accept.includes('a')) { acceptPattern += 'a-z'; }
    if (accept.includes('A')) { acceptPattern += 'A-Z'; }
    if (accept.includes(' ')) { acceptPattern += ' '; } // 半角スペース
    if (accept.includes('h')) { acceptPattern += '!-~'; } // 半角文字すべて(ただし半角スペースは除く)
    //if (accept.includes('@')) { acceptPattern += "0-9A-Za-z@\\.+\\-/=?_~"; } // メールアドレス入力で許容できる文字(狭い解釈でとる場合)
    if (accept.includes('@')) { acceptPattern += "0-9A-Za-z@\\.!#$%&'*+\\-/=?^_{|}~`"; } // メールアドレス入力で許容できる文字(広い解釈でとる場合。ただしダブルクォートは不可とする)
    if (acceptPattern != '') {
      // ime制御はスマホと思われる端末で採用する
      if (window.matchMedia('(max-width: 768px)').matches) {
        element.inputMode = (decimalPlaces) ? 'decimal' : (integerDigits) ? 'numeric' : accept.includes('@') ? 'email' : 'text';
      }
      const inputEventHandler = (/** @type {InputEvent}*/ e) => {
        if (e.isComposing) { return; } // IMEが有効ならバイパス
        const removalRegex = new RegExp('[^' + acceptPattern + ']', 'g');
        let /** @type {string} */ newText = e.target.value
          .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // 全角ASCIIを半角ASCIIへ
          .replace(removalRegex, ''); // 許容外の文字を除去
        if (accept.startsWith('-')) {
          newText = (newText.startsWith('-') ? '-' : '') + newText.replaceAll('-', ''); // 先頭以外のハイフンを除去
        }
        if (integerDigits > 0) {
          // 数値入力項目：整数入力部の桁数制限を適用（先頭のハイフンやピリオドを考慮する）
          let periodPos = newText.indexOf('.');
          newText = (periodPos == -1)
            ? newText.substring(0, integerDigits + (newText.startsWith('-') ? 1 : 0))
            : newText.substring(0, Math.min(integerDigits + (newText.startsWith('-') ? 1 : 0), periodPos)) + newText.substring(periodPos);
        }
        if (decimalPlaces > 0) {
          // 小数入力項目：小数点が入力されているなら、小数桁数制限を適用＆最終のピリオド以外を除去
          const lastPeriodPos = newText.lastIndexOf('.');
          if (lastPeriodPos >= 0) {
            newText = newText.substring(0, lastPeriodPos + 1 + decimalPlaces); // 小数桁数
            newText = newText.replaceAll('.', (match, offset) => (offset == lastPeriodPos ? '.' : '')); // 最終のピリオド以外を除去
          }
        }
        if (e.target.value != newText) {
          e.target.value = newText;
        }
      };
      element.addEventListener('input', inputEventHandler); // ime無効時は１文字入力の都度制御
      element.addEventListener('compositionend', inputEventHandler); // ime有効時は確定時に制御
      if (integerDigits && accept.startsWith('0')) {
        // 数値入力桁数固定なら入力完了時にゼロパディングも実施
        element.addEventListener('change', (e) => {
          if (e.target.value.length && e.target.value.length < integerDigits) {
            e.target.value = e.target.value.padStart(integerDigits, '0');
          }
        });
      } else if (decimalPlaces && accept.includes('.0')) {
        // 小数桁数固定なら入力完了時に小数桁整形も実施
        element.addEventListener('change', (e) => {
          const value = Number.parseFloat(e.target.value);
          if (Number.isFinite(value)) {
            e.target.value = value.toFixed(decimalPlaces);
          }
        });
      }
    }
  });
};
initInputAssist(document);

/**
 * 入力支援：指定されたform配下の入力コントロール等につき、指定されたname属性を持つ要素に検証エラーのスタイルを付加します。
 * @param {HTMLFormElement} form
 * @param {string[]} badItemNames 付与対象のnameの一覧（添字指定する場合は「Input.数量[0]」などと指定すること）、エラーをリセットする場合はnull等
 */
const setInvalidStyle = (form, badItemNames = null) => {
  if (!badItemNames) {
    form.querySelectorAll('.is-invalid').forEach((element) => element.classList.remove('is-invalid'));
    return;
  }
  for (let name of badItemNames) {
    let elements = form.querySelectorAll('*[name="' + name + '"]');
    if (!elements.length) {
      const splited = name.split(/\[|\]/);
      if (splited.length > 1) {
        elements = Array.from(form.querySelectorAll('*[name="' + splited[0] + '"]')).filter((value, index) => index == parseInt(splited[1]));
      }
    }
    for (let i = 0; i < elements.length; i++) {
      elements[i].classList.add('is-invalid');
    }
  }
}

// ----------------------------------------------------------------------------
// モーダル関連
// ----------------------------------------------------------------------------
// modalを多重表示するための調整（modalおよびmodal-backdropにそれぞれ適切なz-indexをもたせる）
document.addEventListener('shown.bs.modal', (e) => {
  if (!e.target.classList.contains('modal')) { return; }
  e.target.style.zIndex = 1045 + document.querySelectorAll('.modal.show').length * 10; // modal重ね合わせ数に応じ、1055,1065,1075,...を設定
  const adjustBackDropZIndex = () => {
    document.querySelectorAll('.modal-backdrop').forEach((element, index) => {
      element.style.zIndex = 1050 + index * 10; // backdropも同様に設定
    });
    // 最前面のmodalを探索しフォーカスをあてる
    const modalElement = Array.from(document.querySelectorAll('.modal.show')).sort((a, b) => b.style.zIndex - a.style.zIndex).at(0);
    if (modalElement) {
      const buttons = modalElement.querySelectorAll('button:not([disabled])');
      if (buttons.length) {
        buttons[buttons.length - 1].focus({ preventScroll: true });
        modalElement.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'instant' }); // focus操作によりモーダル下端までスクロールされてしまうことがあるので、スクロールを戻す
      }
    }
  };
  adjustBackDropZIndex();
  e.target.addEventListener('hidden.bs.modal', adjustBackDropZIndex, { once: true });
});

/**
 * Bootstrapのモーダルを用いて汎用のモーダルを表示します。
 * @param {HTMLElement} modalElement class="modal"のelement
 * @returns {Promise<boolean|string|undefined>} モーダルを閉じた際に発動するPromise(value設定ありのボタンが押されたことによりモーダルを閉じた場合は、valueに設定されていた値)
 */
const showModal = (modalElement) => {
  // DOM未追加なら追加（モーダルを閉じた際に削除）
  const isConnected = modalElement.isConnected;
  if (!isConnected) { document.body.prepend(modalElement); }
  // モーダルを表示
  modalElement.tabIndex = -1;
  const modal = new bootstrap.Modal(modalElement);
  modal.show();
  // モーダルを閉じたときの処理をPromiseで返す
  return new Promise((resolve) => {
    let returnValue;
    const clickEvent = (e) => {
      const buttonValue = e.target?.value;
      if (e.target.tagName == 'BUTTON' && buttonValue) {
        // ボタンのvalueが設定されている場合、設定値を戻り値としモーダルを閉じる
        returnValue = buttonValue === 'true' ? true : buttonValue === 'false' ? false : buttonValue;
        modal.hide();
      }
    };
    modalElement.addEventListener('click', clickEvent);
    modalElement.addEventListener('hidden.bs.modal', (e) => {
      // 閉じたときにモーダルを破棄
      modalElement.removeEventListener('click', clickEvent);
      modal.dispose();
      if (!isConnected) { document.body.removeChild(modalElement); }
      //
      resolve(returnValue);
    }, { once: true });
  });
};


/**
 * Bootstrapのモーダルを用いて汎用のalertモーダルを表示します。
 * @param {string} title 表題
 * @param {string} message 表示メッセージ
 * @param {{buttonName: string}} options モーダルオプション各種（今後拡張の可能性あり）
 * @returns {Promise<boolean|undefined>} モーダルを閉じた際に発動するPromise(OKボタンを押した場合はtrue)
 */
const showAlert = (title, message, options = {}) => {
  if (!message) {
    message = title;
    title = '';
  } else if (Array.isArray(message)) {
    message = message.join('<br>');
  } else if (typeof message === 'string' && message.indexOf('\n') >= 0) {
    message = message.replace(/\n/g, '<br>');
  }
  // モーダルを生成・表示
  const modalElement = document.createElement('div');
  modalElement.classList.add('modal');
  modalElement.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">'
    + '<div class="modal-content">'
    + '<div class="modal-header">'
    + ' <h5 class= "modal-title">' + (title ?? '') + '</h5>'
    + ' <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'
    + '</div>'
    + '<div class="modal-body"><span>' + (message ?? '') + '</span></div>'
    + '<div class="modal-footer">'
    + ' <button type="button" value="true" class="btn btn-primary">' + (options['buttonName'] || 'OK') + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  return showModal(modalElement);
};

/**
 * Bootstrapのモーダルを用いて汎用のconfirmモーダルを表示します。
 * @param {string} title 表題
 * @param {string} message 表示メッセージ
 * @param {{okButtonName: string}} options モーダルオプション各種（今後拡張の可能性あり）
 * @returns {Promise<boolean|undefined>} モーダルを閉じた際に発動するPromise(OKボタンを押した場合はtrue,キャンセルボタンを押した場合はfalse)
 */
const showConfirm = (title, message, options = {}) => {
  if (!message) {
    message = title;
    title = '';
  } else if (Array.isArray(message)) {
    message = message.join('<br>');
  } else if (message.indexOf('\n') >= 0) {
    message = message.replaceAll('\n', '<br>');
  }
  const buttonName = options['okButtonName'] || 'OK';
  // モーダルを生成・表示
  const modalElement = document.createElement('div');
  modalElement.classList.add('modal');
  modalElement.innerHTML = '<div class="modal-dialog modal-dialog-centered">'
    + '<div class="modal-content">'
    + '<div class="modal-header">'
    + ' <h5 class= "modal-title">' + (title ?? '') + '</h5>'
    + ' <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'
    + '</div>'
    + '<div class="modal-body"><span>' + (message ?? '') + '</span></div>'
    + '<div class="modal-footer">'
    + ' <button type="button" value="true" class="btn btn-primary">' + (buttonName) + '</button>'
    + ' <button type="button" value="false" class="btn btn-secondary">' + (buttonName === 'はい' ? 'いいえ' : 'キャンセル') + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  return showModal(modalElement);
};

/**
 * Bootstrapのモーダルを用いて汎用の処理中モーダルを表示します。
 * @param {string} message 表示メッセージ
 * @returns {bootstrap.Modal} 表示されたモーダルオブジェクト
 */
const showProgress = (message) => {
  // モーダルを生成・表示
  const modalElement = document.createElement('div');
  modalElement.classList.add('modal');
  modalElement.setAttribute('data-bs-backdrop', 'static');
  modalElement.setAttribute('data-bs-keyboard', 'false');
  modalElement.tabIndex = -1;
  modalElement.innerHTML = '<div class="modal-dialog modal-sm modal-dialog-centered">'
    + '<div class="modal-content">'
    + '<div class="modal-body text-center p-4">'
    + '<div class="spinner-border text-primary" role="status"></div>'
    + '<div>' + (message ?? '処理中....') + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
  document.body.prepend(modalElement);
  const modal = new bootstrap.Modal(modalElement);
  modal.show();
  modalElement.addEventListener('hidden.bs.modal', (e) => {
    // 閉じたときにモーダルを破棄
    modal.dispose();
    document.body.removeChild(modalElement);
  }, { once: true });
  // モーダル自体を返す（呼び出し元にて不要になったタイミングでモーダルを閉じる）
  return modal;
};

/**
 * ダミーのelementを画面前面に表示して画面入力操作を抑止(または抑止解除)します。
 * @param {boolean} inert 抑止する場合はtrueまたは未指定、抑止解除する場合はfalse
 */
const setInert = (inert = true) => {
  // if (document.body.inert !== undefined) { document.body.inert = inert; }
  // ※↑のinertは2022～23年前後に新設されたプロパティで古いブラウザだと効かないため不採用、当面の間は下記の自前実装にて制御する。
  let modalElement = document.getElementById('__screenLock');
  if (inert) {
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.setAttribute('id', '__screenLock');
      modalElement.setAttribute('style', 'position:fixed; top:0; bottom:0; left:0; right:0; z-index:99999999;');
      if (location.hostname == 'localhost') {
        modalElement.style.backgroundColor = '#0000FF44'; // localhostでの開発中は画面ロックを色付きで表示
      }
      document.body.prepend(modalElement); // 操作抑止開始
      // キーボード操作もすべて不可にする
      const bodyKeydownEvent = (e) => { e.preventDefault(); };
      document.body.addEventListener('keydown', bodyKeydownEvent, { capture: true });
      modalElement.bodyKeydownEvent = bodyKeydownEvent; // removeするときに参照できるようelementに独自のプロパティを生成
    }
  } else if (modalElement) {
    document.body.removeChild(modalElement); // 操作抑止解除
    // キーボードイベントを除去
    document.body.removeEventListener('keydown', modalElement.bodyKeydownEvent, { capture: true });
  }
}

// ----------------------------------------------------------------------------
// Draggable関連(jQueryUI不使用)
// ----------------------------------------------------------------------------
/**
 * 引数１で指定されたdiv要素をマウスドラッグで移動可能にします。
 * @param {HTMLElement} divElement 移動対象とするposition:absoluteなdiv要素のelement
 * @param {?HTMLElement} dragStartElement マウスドラッグで移動可能にする際のドラッグ開始位置となるelement
 */
const makeDraggable = (divElement, dragStartElement) => {
  let dragstartY = null;
  let dragstartX = null;
  (dragStartElement ?? divElement).style.userSelect = 'none'; // ドラッグ開始部はテキストとして選択不可(Dragしやすいように)
  (dragStartElement ?? divElement).addEventListener('mousedown', (e) => {
    // ドラッグ開始位置を退避
    const rect = e.currentTarget.getBoundingClientRect();
    dragstartY = e.clientY - rect.top;
    dragstartX = e.clientX - rect.left;
  });
  document.addEventListener('mouseup', () => {
    dragstartY = null;
    dragstartX = null;
  });
  document.addEventListener('mousemove', (e) => {
    if (dragstartY !== null && dragstartX !== null) {
      // ドラッグ開始位置からの差分位置へ移動。rightやbottomの指定があれば解除
      if (divElement.style.getPropertyValue('right')) { divElement.style.removeProperty('right'); }
      if (divElement.style.getPropertyValue('bottom')) { divElement.style.removeProperty('bottom'); }
      divElement.style.left = `${e.clientX - dragstartX}px`;
      divElement.style.top = `${e.clientY - dragstartY}px`;
    }
  });
};

// ----------------------------------------------------------------------------
// Ajax WebAPI
// ----------------------------------------------------------------------------
/**
 * FetchAPIラッパー：リクエストを実行します。
 * @param {string|Request} request リクエストURLまたはリクエストオブジェクト
 * @param {RequestInit} options FetchAPIで指定するリクエストオプション
 * @returns {Promise<Response, string>} 正常終了時は取得できたレスポンス、エラー時はエラーメッセージ
 */
const ajaxGet = (request, options) => {
  return new Promise((resolve, reject) => {
    fetch(request, options)
      .then(async (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(await response.text() || 'エラーが発生しました。');
        }
      }, (error) => {
        ajaxJsLogEreror(`Ajax Error「 ${error}」 ${request.url || request}`);
        reject('通信エラーが発生しました。');
      })
      .catch((error) => {
        ajaxJsLogEreror(`Ajax Error!  ${request.url || request}  ${error}`);
        reject('システムエラーが発生しました。');
      });
  });
};

/**
 * FetchAPIラッパー：Jsonレスポンスを取得します。
 * @param {string|Request} request リクエストURLまたはリクエストオブジェクト
 * @param {RequestInit} options FetchAPIで指定するリクエストオプション
 * @returns {Promise<object, string>} 正常終了時は取得できたJsonレスポンス、エラー時はエラーメッセージ
 */
const ajaxGetJson = (request, options) => {
  return new Promise((resolve, reject) => {
    ajaxGet(request, options)
      .then(async (response) => resolve(await response.json()))
      .catch((error) => reject(error));
  });
};

/**
 * @typedef {Object} RegisterOptions 登録処理オプション
 * @prop {string} title レスポンスのsuccess/errorが文字列の場合に登録完了／登録エラーダイアログを表示する際の、ダイアログのタイトル
 * @prop {HTMLFormElement} form 入力チェックエラー時に検証エラースタイルを設定する場合は、送信しているForm
 * @prop {string} progress 送信中にプログレスモーダルを表示する場合は、モーダルの表示文字列
 */
/**
 * FetchAPIによるAjax実行処理：リクエスト送信を行ってJsonレスポンスを取得し、正常終了/エラーに応じたpromiseを呼び出します。
 * @param {string|Request} request リクエストURLまたはリクエストオブジェクト
 * @param {RequestInit} options FetchAPIで指定するリクエストオプション
 * @param {RegisterOptions} dialogOptions オプション各種（今後拡張の可能性あり）
 * @returns {Promise<string|object, string|false|object>} 正常終了時はsuccessに設定されている値、失敗時(エラー/確認取りやめ含む)はerrorに設定されている値(ただしconfirm確認取りやめ時はfalse)
 */
const ajaxExecute = (request, options, dialogOptions) => {
  const showResultDialogIfNeeded = async (title, message) => {
    if (Array.isArray(message) || typeof message === 'string') {
      await showAlert(title || dialogOptions.title || '', message);
    }
  };
  // 送信実行
  return new Promise(async (resolve, reject) => {
    // ファイルアップロードの上限チェック
    const /** @type {FormData} */ formData = request.body ?? options.body;
    if (formData?.entries) {
      const uploadSize = Array.from(formData.entries()).map(([key, value]) => value.size ?? 0).reduce((sum, size) => sum + size);
      if (uploadSize > MAX_UPLOAD_SIZE_MB * 1000 * 1000) {
        const errorMessage = `アップロードファイルのサイズが上限 ${MAX_UPLOAD_SIZE_MB} MB を超過しました。アップロードできません。`;
        await showResultDialogIfNeeded('', errorMessage);
        reject(errorMessage);
        return;
      }
    }
    if (dialogOptions.form) { setInvalidStyle(dialogOptions.form, false); }
    const progress = (dialogOptions.progress) ? showProgress(dialogOptions.progress) : null;
    setInert(true);
    const ajaxSend = (requestUrl) => fetch(requestUrl, options)
      .then(async (response) => {
        setInert(false);
        progress?.hide();
        if (response.ok) {
          const resultText = await response.text();
          try {
            const result = JSON.parse(resultText);
            if (result.success) {
              // 処理成功
              await showResultDialogIfNeeded(result.title, result.success);
              resolve(result.success);
            } else if (result.confirm) {
              // 処理にて確認事項あり。
              const confirm = await showConfirm(result.title, result.confirm, { okButtonName: result.confirmButton || 'はい' });
              if (confirm === true) {
                // 処理やり直し
                ajaxSend(request + (request.indexOf('?') < 0 ? '?' : '&') + 'confirmed=true');
              } else {
                // 処理取りやめ
                reject(false);
              }
            } else if (result.error) {
              // 処理エラー
              const dialog = showResultDialogIfNeeded(result.title, result.error || '処理エラーが発生しました。');
              if (result.erroritems && dialogOptions.form) { setInvalidStyle(dialogOptions.form, result.erroritems); }
              await dialog;
              reject(result.error || '処理エラーが発生しました。');
            } else {
              // success/confirm/errorいずれも設定されていない場合は正常終了とし、得られたjsonオブジェクトそのものを返す
              resolve(result);
            }
          } catch {
            // JSONでないならテキスト内容をそのまま返す
            resolve(resultText);
          }
        } else {
          // httpステータスエラー
          const errorText = await response.text() || 'エラーが発生しました。';
          await showResultDialogIfNeeded('エラー', errorText);
          reject(errorText);
        }
      }, async (error) => {
        setInert(false);
        progress?.hide();

        // アップロードファイルの改変によりエラーが出ている場合はその旨を表示
        // （Chrome系は以下の処理でファイル改変を検出できるがFirefoxはファイル更新がどうやっても検知できないっぽい・・・）
        const isUploadFileModified = async () => {
          if (!options?.body?.values) { return false; }
          for (const f of options.body.values()) {
            const modified = (f.type && f.lastModified && await f.slice(0, 1).text().then(() => false).catch(() => true));
            const deleted = f.size === 0 && Math.abs((new Date()).getTime() - f.lastModified) < 1000;
            if (modified || deleted) return true;
          }
          return false;
        }
        if (await isUploadFileModified()) {
          const message = 'アップロードファイルが改変または削除されました。ファイルを再指定してください。';
          await showResultDialogIfNeeded('ファイル指定エラー', message);
          reject(message);
          return;
        }

        await showResultDialogIfNeeded('エラー', '通信エラーが発生しました。');
        reject('通信エラーが発生しました。');
      })
      .catch(async (error) => {
        setInert(false);
        await showResultDialogIfNeeded('エラー', 'システムエラーが発生しました。');
        reject('システムエラーが発生しました。');
      });
    // 登録処理呼び出し
    ajaxSend(request);
  });
};

/**
 * FetchAPIラッパー：リクエスト送信によりファイルダウンロードを行い、正常終了/エラーに応じたpromiseを呼び出します。
 * @param {string|Request} request リクエストURLまたはリクエストオブジェクト
 * @param {object} options FetchAPIで指定するリクエストオプション
 * @returns {Promise<string, string>} 正常終了時はダウンロードできたファイル名、エラー時はエラーメッセージ
 */
const ajaxDownload = (request, options) => {
  return new Promise((resolve, reject) => {
    fetch(request, options)
      .then(async (response) => {
        if (response.ok) {
          // ダウンロードファイル名をレスポンスヘッダから把握
          let filename = '';
          for (const value of (response.headers.get('content-disposition') ?? '').split(/; */)) {
            if (value.startsWith("filename*=UTF-8''")) {
              filename = decodeURIComponent(value.substring(17));
              break;
            } else if (value.startsWith('filename=')) {
              filename = value.substring(9).replaceAll(/["']/g, '');
            }
          }
          // アンカーを一時的に作成し呼び出すことでダウンロード
          const anchor = document.createElement('a');
          anchor.setAttribute('href', URL.createObjectURL(new Blob([await response.blob()], { type: response.headers.get('Content-Type') })));
          anchor.setAttribute('download', filename);
          document.body.prepend(anchor);
          anchor.click();
          setTimeout(() => document.body.removeChild(anchor), 10000);
          resolve(filename);
        } else {
          reject(await response.text() || 'ファイルをダウンロードできません。');
        }
      })
      .catch((error) => {
        reject('通信エラーが発生しました。');
      });
  });
};

// ----------------------------------------------------------------------------
// JavaScriptに関するログをサーバでログ出力
// ----------------------------------------------------------------------------
/**
 * JavaScript処理のログをサーバで出力します。
 * @param {*} message
 */
const ajaxJsLog = (message) => {
  const formData = new FormData();
  formData.append('message', `${message}  (${location.pathname}${location.search})`);
  fetch(BASE_URL + 'api/LogJsInfo', {
    method: 'POST',
    body: formData,
  });
};

/**
 * JavaScript処理のエラーログをサーバで出力します。ただし既に送信済のエラーメッセージは送出抑止します。
 * @param {*} errorMessage
 */
const ajaxJsLogEreror = (errorMessage) => {
  let sentErrorArray = ajaxJsLogEreror.sentErrorArray;  // 既に送信済のエラーメッセージ(同一エラーは１回のみ送出するよう抑制)
  if (!sentErrorArray) {
    sentErrorArray = [];
    ajaxJsLogEreror.sentErrorArray = sentErrorArray;
  }
  if (sentErrorArray.includes(errorMessage) === false) {
    sentErrorArray.push(errorMessage);
    const formData = new FormData();
    formData.append('message', errorMessage);
    fetch(BASE_URL + 'api/LogJsError', {
      method: 'POST',
      body: formData,
    }).then((response) => {
      if (!response.ok) { sentErrorArray = null; }
    }).catch(() => { sentErrorArray = null; });
  }
};
window.onerror = (message, source, lineno, colno, error) => {
  ajaxJsLogEreror(`${message}  (${location.pathname}${location.search} file=${source} line=${lineno} col=${colno} )`);
};
window.onunhandledrejection = (e) => { // Promise内で発生したエラーも同様に把握、ログ送出
  ajaxJsLogEreror(`${e.reason}  (${location.pathname}${location.search} in Promise)`);
};

// ============================================================================
// 業務共通
// ============================================================================

// 全画面共通：ログインボタンのログインダイアログからログイン実行
document.getElementById('loginModal')?.addEventListener('submit', (e) => {
  e.preventDefault(); // formとしてのsubmitは抑制
  const formData = new FormData(e.target);
  ajaxGet(BASE_URL + 'api/Login', {
    method: 'POST', body: formData
  }).then(() => location.reload(), (message) => showAlert(message));
});

/**
 * 引数で指定された<select>タグをMultiSelectとして初期化します。(要jQuery)
 * @param {HTMLSelectElement} selectElement プルダウン
 * @param {EventListener} onChange 選択が変更されたときに呼び出されるべきコールバック
 * @param {string} placeHolder 未選択の時に表示するplaceholder「体制種別選択」など
 * @param {string} allSelectedText 全選択チェックを出す場合その文字列
 */
const initMultiSelect = (selectElement, onChange, placeHolder, allSelectedText) => {
  const width = selectElement.parentElement.style.width || selectElement.parentElement.clientWidth + 'px'; // 親要素のwidthを自動反映
  $(selectElement).multiselect({
    buttonClass: 'form-select form-select-sm text-start',
    templates: {
      button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>', // dropdownが開かない不具合の是正
      option: '<button type="button" class="multiselect-option dropdown-item me-4"></button>', //　選択肢右側の余白確保
    },
    buttonTextAlignment: 'left',
    // ↑ここまでライブラリの仕様(Bootstrap5不完全対応)のため指定必須。
    maxHeight: 450,
    buttonWidth: width,
    nonSelectedText: placeHolder,
    nSelectedText: '件選択',
    allSelectedText: allSelectedText || 'すべて選択', // 全選択チェックボックスの選択肢名、ならび全選択時の表示
    includeSelectAllOption: !!allSelectedText,
    selectAllText: allSelectedText,
    onChange: onChange,
    onSelectAll: onChange,
    onDeselectAll: onChange,
  });
}

/**
 * 汎用：htmlエンコードを行います（innerHTML組み立て等支援）
 * @param {?string} str
 * @returns
 */
function htmlEncode(str) {
  return str?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

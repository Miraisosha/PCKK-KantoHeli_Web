export function initKPManager(ctx) {
  const { map, layers, sources, ui } = ctx;

  const {
    layerKP河川,
    layerKP道路,
    layerKPLine河川,
    layerKPLine道路,
    layerSelectedKPLine
  } = layers;

  const {
    mapKPSource,
    mapKPSource河川,
    mapKPSource道路,
    mapSelectedKPLineSource
  } = sources;
  const {
    modalKPPoint,
    selRoadRiver,
    startKp,
    endKp
  } = ui

  let isRiver = true;
  let kpProp = null

  // ================================================================
  // modal 表示
  function showModal(drawType) {
    resetInputs();
    positionModal();
    modalKPPoint.style.display = 'block';
    enterKPMode(drawType);
    isRiver = (drawType == 'River');
    kpProp = (isRiver) ? '距離標' : '地点標名称';
  }

  // ================================================================
  // modal 非表示
  function hideModal() {
    modalKPPoint.style.display = 'none';
    hideAllKPLayers();
    sources.mapKPSource.clear();
  }

  function resetInputs() {
    mapKPSource.clear();
  }

  function positionModal() {
    const tab = document.getElementById('tab調査依頼');
    const rect = tab.getBoundingClientRect();

    modalKPPoint.style.left = '3px';
    modalKPPoint.style.top = `${rect.top + 5}px`;
  }

  function enterKPMode(drawType) {
    hideAllKPLayers();

    if (drawType === 'River') {
      layers.layerKP河川.setVisible(true);
      layers.layerKPLine河川.setVisible(true);
    }
    if (drawType === 'Road') {
      layers.layerKP道路.setVisible(true);
      layers.layerKPLine道路.setVisible(true);
    }
  }

  // ================================================================
  // ボタン処理
  document.getElementById('btnKPCancel').onclick = () => {
    document.getElementById('modalKPPoint').style.display = 'none';
    hideModal();
    mapKPSource.clear();
  };
  document.getElementById('btnKPOk').onclick = () => {
    const kpResult = {
      selRoadRiver: ui.selRoadRiver.value,
      startKp: Number(ui.startKp.value),
      endKp: Number(ui.endKp.value),
    };

    if (typeof onConfirm === 'function') {
      onConfirm(kpResult);
    }
    hideModal();
    mapKPSource.clear();
  };

  // ================================================================
  // 河川データ読み込み
  const mapKP河川 = new Map();
  mapKPSource河川.on('change', () => {
    if (mapKPSource河川.getState() != 'ready') return;
    if (mapKP河川.size > 0) return;

    const features = mapKPSource河川.getFeatures();
    features.forEach(f => {
      const 水系名 = f.get('水系名');
      const 河川名 = f.get('河川名');
      const 左右岸 = f.get('左右岸');

      if (!水系名 || !河川名 || !左右岸) return;

      const key = `${水系名}_${河川名}_${左右岸}`;
      const text = `${水系名} ${河川名} （${左右岸}）`;

      if (!mapKP河川.has(key)) {
        mapKP河川.set(key, text);
      }
    });
    createRoadRiverSelect(mapKP河川);
  });

  // ================================================================
  // 道路データ読み込み
  const mapKP道路 = new Map();
  mapKPSource道路.on('change', () => {
    if (mapKPSource道路.getState() != 'ready') return;
    if (mapKP道路.size > 0) return;

    const features = mapKPSource道路.getFeatures();
    features.forEach(f => {
      const 地方整備局 = f.get('地方整備局');
      const 事務所 = f.get('事務所');
      const 道路種別 = f.get('道路種別');
      const 路線 = f.get('路線');
      const 現旧新区分 = f.get('現旧新区分');
      const 上下区分 = f.get('上下区分');

      const key = `${地方整備局}_${事務所}_${道路種別}_${路線}_${現旧新区分}_${上下区分}`;
      const text = `${道路種別} ${路線}号線 ${現旧新区分} ${上下区分}`;

      if (!mapKP道路.has(key)) {
        mapKP道路.set(key, text);
      }
    });
    createRoadRiverSelect(mapKP道路);
  });

  // ================================================================
  // 距離標選択状態Source Changeイベント
  mapKPSource.on('change', () => {
    console.log('mapKPSource change! -----------------------------------------------------');
    console.log(mapKPSource.getFeatures().length);
    if (mapKPSource.getFeatures().length == 0) {
      startKp.value = '';
      endKp.value = '';
    } else  if (mapKPSource.getFeatures().length > 0) {
      const features = mapKPSource.getFeatures();
      const kp_s = (startKp.value) ? Number(startKp.value) : null;
      const kp_e = (endKp.value) ? Number(endKp.value) : null;
      const feature = features[0].get('srcFeature');
      startKp.value = Number(feature.get(kpProp));
      if (features.length > 1) {
        const f2 = features[0].get('srcFeature');
        endKp.value = Number(f2.get(kpProp));
      }
    }
  });


  // ================================================================
  // セレクトボックス作成
  function createRoadRiverSelect(uniqueMap) {
    selRoadRiver.innerHTML = '';
    selRoadRiver.appendChild(new Option('選択してください', ''));

    const sortedEntries = [...uniqueMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'));

    sortedEntries.forEach(([key, text]) => {
      selRoadRiver.appendChild(new Option(text, key));
    });
  };

  // ================================================================
  // KPレイヤクリックHandle
  function handleMapClick(feature, layer) {
    if (layer !== layerKP河川 && layer !== layerKP道路) {
      return false;
    }

    onKPLayerClickInternal(feature, layer);
    return true;
  }

  // ================================================================
  // KPレイヤクリック処理
  function onKPLayerClickInternal(feature, hoverLayer) {
    const features = mapKPSource.getFeatures();
    const cnt = features.length;

    // 同じ距離標を再クリック → 解除
    const existing = features.find(f => f.get('srcFeature') === feature);
    if (existing) {
      mapKPSource.removeFeature(existing);

      if (mapKPSource.getFeatures().length === 0) {
        if (hoverLayer === layerKP河川) {
          layerKP河川.setStyle(styleKPRiver);
          layerKPLine河川.setStyle(styleKPLineRiver);
        } else if (hoverLayer === layerKP道路) {
          layerKP道路.setStyle(styleKPRoad);
          layerKPLine道路.setStyle(styleKPLineRoad);
        }
      }
      return;
    }

    // 既に選択されている距離標Pointが無い場合
    if (cnt == 0) {
      mapKPSource.addFeature(getSelectedKPPoint(feature));
      if (feature._hoverLayer === layerKP河川) {
        layerKP河川.setStyle(function (f) {
          return isSameGroup(f, getParts(feature)) ? styleKPRiver(f) : null;
        });
        layerKPLine河川.setStyle(function (f) {
          return isSameGroup(f, getParts(feature)) ? styleKPLineRiver(f) : null;
        });
        // 距離標登録ダイアログ　入力補助
        setKPModalSelection(getParts(feature).join('_'), feature.get('距離標'));
      } else if (feature._hoverLayer === layerKP道路) {
        layerKP道路.setStyle(function (f) {
          return isSameGroup(f, getParts(feature)) ? styleKPRiver(f) : null;
        });
        layerKPLine道路.setStyle(function (f) {
          return isSameGroup(f, getParts(feature)) ? styleKPLineRiver(f) : null;
        });
        // 距離標登録ダイアログ　入力補助
        setKPModalSelection(getParts(feature).join('_'), feature.get('地点標名称'));
      }
      // 既に選択されている距離標Pointが1つある場合
    } else if (cnt == 1) {
      mapKPSource.addFeature(getSelectedKPPoint(feature));
      let kp_name = ''
      let source;
      if (feature._hoverLayer === layerKP河川) {
        kp_name = '距離標';
        source = mapKPSource河川;
      } else if (feature._hoverLayer === layerKP道路) {
        kp_name = '地点標名称'
        source = mapKPSource道路;
      }
      const kp = mapKPSource.getFeatures().map(f => {
        const src = f.get('srcFeature');
        return src?.get(kp_name);
      });

      // 距離標が両方入力されている場合
      const rangeFeatures = getKPRangeFeatures(source, getParts(feature), kp[0], kp[1]);

      // 同じポイントの場合はENDを削除
      if (rangeFeatures.length == 1) {
        document.getElementById('startKp').value = rangeFeatures[0].get(kp_name);
        document.getElementById('endKp').value = '';
      } else {
        showSelectedLine(rangeFeatures);
      }
      // 距離標登録ダイアログ　入力補助
      setKPModalSelection(null, feature.get(kp_name));
    }
  }

  // ================================================================
  // 河川距離標・道路距離標　マウスオーバーイベント
  let overFeature = null;
  map.on('pointermove', function (evt) {
    if (evt.dragging) return;

    const feature = map.forEachFeatureAtPixel(
      evt.pixel,
      (feature, layer) => {
        feature._hoverLayer = layer;
        return feature;
      },
      { layerFilter: l => l === layerKP河川 ||  l === layerKP道路 }
    );

    // マウスアウト
    if (overFeature && overFeature !== feature) {
      onMouseOut(overFeature);
      overFeature = null;
    }

    // マウスオーバー
    if (feature && feature !== overFeature) {
      if (feature._hoverLayer === layerKP河川) {
        onMouseOverKPRiver(feature);
      } else if (feature._hoverLayer === layerKP道路) {
        onMouseOverKPRoad(feature);
      }
      overFeature = feature;
    }
    const hit = map.hasFeatureAtPixel(evt.pixel);
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
  });


  // ================================================================
  // 一番近い距離標を選択
  function selectNearestKP() {
    const key = selRoadRiver.value;
    if (!key) return;

    const parts = key.split('_');

    let source = null;
    let kpProp = null;

    if (parts.length === 3) {
      source = mapKPSource河川;
      kpProp = '距離標';
    } else if (parts.length === 6) {
      source = mapKPSource道路;
      kpProp = '地点標名称';
    } else {
      return;
    }

    const kp_s = startKp.value !== '' ? Number(startKp.value) : null;
    const kp_e = endKp.value !== '' ? Number(endKp.value) : null;
    if (kp_s === null && kp_e === null) return;

    // 選択状態クリア
    mapKPSource.clear();

    // =====================
    // 片側入力
    if (kp_s === null || kp_e === null) {
      const target = kp_s !== null ? kp_s : kp_e;

      let nearest = null;
      let minDiff = Infinity;

      source.getFeatures().forEach(f => {
        if (!isSameGroup(f, parts)) return;

        let kp = f.get(kpProp);
        if (kp == null) return;

        kp = Number(String(kp).replace(/[^\d.]/g, ''));
        if (isNaN(kp)) return;

        const diff = Math.abs(kp - target);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = f;
        }
      });

      if (nearest) {
        (kp_s !== null ? startKp : endKp).value = nearest.get(kpProp);
        mapKPSource.addFeature(getSelectedKPPoint(nearest));
      }
      return;
    }

    // =====================
    // 両側入力
    const range = getKPRangeFeatures(source, parts, kp_s, kp_e);
    range.forEach(f => {
      mapKPSource.addFeature(getSelectedKPPoint(f));
    });
  }
  // ================================================================
  // 数値入力制限（km）
  [startKp, endKp].forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9.]/g, '');
    });
    input.addEventListener('change', selectNearestKP);
  });

  // ================================================================
  // 検索条件
  function isSameGroup(feature, parts) {
    if (!feature || !parts) return false;

    // 河川
    if (parts.length === 3) {
      return feature.get('水系名') === parts[0]
        && feature.get('河川名') === parts[1]
        && feature.get('左右岸') === parts[2];
    }

    // 道路
    if (parts.length === 6) {
      return feature.get('地方整備局') === parts[0]
        && feature.get('事務所') === parts[1]
        && feature.get('道路種別') === parts[2]
        && feature.get('路線') === parts[3]
        && feature.get('現旧新区分') === parts[4]
        && feature.get('上下区分') === parts[5];
    }
    return false;
  }

  // ================================================================
  // 距離標Point クリックからの
  // ダイアログ入力状態変更
  function setKPModalSelection(key, kp) {
    if (selRoadRiver.selectedIndex == 0) {
      selRoadRiver.value = key;
    }
    if (startKp.value == "") {
      startKp.value = kp;
    } else if (startKp.value != "" && endKp.value == "") {
      endKp.value = kp;
    }
  }

  // ================================================================
  // 河川・道路プルダウン　イベント
  selRoadRiver.addEventListener('change', e => {
    mapKPSource.clear();
    document.getElementById('startKp').value = '';
    document.getElementById('endKp').value = '';
    const values = e.target.value.split('_');
    if (values.length == 3) {
      layerKP河川.setStyle(function (f) {
        return (isSameGroup(f, values)) ? styleKPRiver(f) : null;
      });
      layerKPLine河川.setStyle(function (f) {
        return (isSameGroup(f, values)) ? styleKPLineRiver(f) : null;
      });
      zoomKPLine(layerKP河川);
    } else if (values.length == 6) {
      layerKP道路.setStyle(function (f) {
        return (isSameGroup(f, values)) ? styleKPRiver(f) : null;
      });
      layerKPLine道路.setStyle(function (f) {
        return (isSameGroup(f, values)) ? styleKPLineRiver(f) : null;
      });
      zoomKPLine(layerKP道路);
    }
  });
  // ================================================================
  // 距離標範囲のfeatureを取得
  function getKPRangeFeatures(source, parts, kp_s, kp_e) {
    const kpMin = Math.min(kp_s, kp_e);
    const kpMax = Math.max(kp_s, kp_e);
    const kpProp = (parts.length === 3) ? '距離標':'地点標名称'; 

    const rangeFeatures = [];
    source.getFeatures().forEach(f => {
      if (!isSameGroup(f, parts)) return;

      let kp = f.get(kpProp);
      if (kp == null) return;

      kp = Number(String(kp).replace(/[^\d.]/g, ''));
      if (isNaN(kp)) return;

      if (kp >= kpMin && kp <= kpMax) {
        rangeFeatures.push(f);
      }
    });
    return rangeFeatures;
  }

  // ================================================================
  // 選択された道路・河川にズーム
  const zoomKPLine = (layer) => {
    const source = layer.getSource();
    if (!source) return;
    const styleFn = layer.getStyle();
    if (!styleFn) return;
    const resolution = map.getView().getResolution();
    const visibleFeatures = source.getFeatures().filter(f => {
      return styleFn(f, resolution) !== null;
    });
    if (!visibleFeatures.length) return;
    let extent = ol.extent.createEmpty();
    visibleFeatures.forEach(f => {
      ol.extent.extend(extent, f.getGeometry().getExtent());
    });
    map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 300,
      maxZoom: 18
    });
  };

  // ================================================================
  // 距離標　登録ダイアログ
  // ドラッグ移動（ヘッダーのみ）
  (function enableDragModalKPPoint() {
    const header = modalKPPoint.querySelector('.panel-header');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let panelX = 0;
    let panelY = 0;
    header.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const rect = modalKPPoint.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      panelX = rect.left;
      panelY = rect.top;
      dragging = true;
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      modalKPPoint.style.left = panelX + dx + 'px';
      modalKPPoint.style.top = panelY + dy + 'px';
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
    });
  })();


  // ================================================================
  // 選択完了　ライン表示
  const showSelectedLine = (features) => {
    const coordinates = features
      .slice()
      .sort((a, b) => {
        const ka = Number(String(a.get(kpProp)).replace(/[^\d.]/g, ''));
        const kb = Number(String(b.get(kpProp)).replace(/[^\d.]/g, ''));
        return ka - kb;
      })
      .map(f => f.getGeometry().getCoordinates());

    const lineFeature = new ol.Feature({
      geometry: new ol.geom.LineString(coordinates)
    });
    mapSelectedKPLineSource.clear();
    mapSelectedKPLineSource.addFeature(lineFeature);
    layerSelectedKPLine.setVisible(true);
  }
  // ================================================================
  // 河川　表示
  function showRiverKP() {
    hideAllKPLayers();
    layerKP河川.setVisible(true);
    layerKPLine河川.setVisible(true);
  }

  // ================================================================
  // 道路　表示
  function showRoadKP() {
    hideAllKPLayers();
    layerKP道路.setVisible(true);
    layerKPLine道路.setVisible(true);
  }

  // ================================================================
  // 初期化
  function hideAllKPLayers() {
    layerKP河川.setVisible(false);
    layerKP道路.setVisible(false);
    layerKPLine河川.setVisible(false);
    layerKPLine道路.setVisible(false);
    layerSelectedKPLine.setVisible(false);

    mapSelectedKPLineSource.clear();
    mapKPSource.clear();
  }
  // ================================================================
  // featureから絞り込み条件を取得
  function getParts(feature) {
    // 河川
    if (feature.get('地点標名称') == undefined) {
      return [
        feature.get('水系名'),
        feature.get('河川名'),
        feature.get('左右岸')];
    // 道路
    } else {
      return [
        feature.get('地方整備局'),
        feature.get('事務所'),
        feature.get('道路種別'),
        feature.get('路線'),
        feature.get('現旧新区分'),
        feature.get('上下区分')];
    }
  }
  return {
    show() {
      ui.modalKPPoint.style.display = 'block';
    },
    hide() {
      ui.modalKPPoint.style.display = 'none';
      mapKPSource.clear();
    },
    showModal,
    hideModal,
    handleMapClick,
    hideAllKPLayers,
    showRiverKP,
    showRoadKP
  };
}


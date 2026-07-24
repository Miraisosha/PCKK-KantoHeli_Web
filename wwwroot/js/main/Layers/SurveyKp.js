'use strict';

// ********************************************************************************************
// ********************************************************************************************
// 調査地点追加　距離標　登録
// ********************************************************************************************
// ********************************************************************************************
export function SurveyKp(ctx) {
  const {
    root_url,
  } = ctx;
  const kp_font = '18px sans-serif';
  const kp_font_offset = -18;

  // ------------------------------------------
  // 距離標のソース設定
  function setKPSource(drawType) {
    let url = null;
    if (drawType == 'River') {
      url = root_url + '/files/kp_river_point.geojson'
    } else if (drawType == 'Road') {
      url = root_url + '/files/kp_road_point.geojson'
    } else {
      return null;
    }
    return new ol.source.Vector({
      url: url,
      format: new ol.format.GeoJSON({
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      })
    })
  }
  // ------------------------------------------
  // 河川　点　距離標レイヤ作成
  const createKPRiver = () => {
    const layer = new ol.layer.Vector({
      style: styleKP,
      visible: false
    });
    return layer;
  };
  // ------------------------------------------
  // 道路　点　距離標レイヤ作成
  function createKPRoad() {
    const layer = new ol.layer.Vector({
      style: styleKP,
      visible:false,
    });
    return layer;
  };
  // ------------------------------------------
  // 河川　線　距離標レイヤ作成
  function createKPLineRiver() {
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        url: root_url + '/files/kp_river_line.geojson',
        format: new ol.format.GeoJSON({
          dataProjection: 'EPSG:4326',     // GeoJSON の座標系
          featureProjection: 'EPSG:3857'   // 地図表示用
        })
      }),
      style: styleKPLine,
      visible:false 
    });
    return layer;
  }
  // ------------------------------------------
  // 道路　線　距離標レイヤ作成
  function createKPLineRoad(){
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        url: root_url + '/files/kp_road_line.geojson',
        format: new ol.format.GeoJSON({
          dataProjection: 'EPSG:4326',     // GeoJSON の座標系
          featureProjection: 'EPSG:3857'   // 地図表示用
        })
      }),
      style: styleKPLine,
      visible: false
    });
    return layer;
  }
  // ------------------------------------------
  // 選択状態
  function createSelectionKPLayer() {
    const selectLayer = new ol.layer.Vector({
      style: new ol.style.Style({
        image: new ol.style.Circle({
          radius: 10,
          stroke: new ol.style.Stroke({
            color: 'red',
            width: 3
          }),
          fill: new ol.style.Fill({
            color: 'rgba(255,0,0,0.2)'
          })
        })
      })
    });
    return selectLayer;
  }

  // ------------------------------------------
  // 距離標選択完了時のライン
  function createSelectedKPLineLayer(){
    const layer = new ol.layer.Vector({
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#0396FE',
          width: 4
        })
      })
    });
    return layer;
  }

  // ------------------------------------------
  // 河川　マウスオーバー
  function onMouseOverKPRiver(feature) {
    feature.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: 'orange' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
      }),
      text: new ol.style.Text({
        text: feature.get('河川名') + " " + feature.get('左右岸') + " " + Number(feature.get('距離標')) + "KP",
        font: kp_font,
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
        offsetY: kp_font_offset,
      })
    }));
  }
  // ------------------------------------------
  // 道路　マウスオーバー
  function onMouseOverKPRoad(feature) {
    feature.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: 'orange' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
      }),
      text: new ol.style.Text({
        text: feature.get('路線') + "号線 " + feature.get('現旧新区分') + " " + feature.get('地点標名称') + "KP",
        font: kp_font,
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
        offsetY: kp_font_offset,
      })
    }));
  }
  // ------------------------------------------
  // マウスアウト
  function onMouseOutKP(feature) {
    feature.setStyle(undefined);
  }
  function styleKPLine(feature) {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: '#81AFFF',
        width: 2
      })
    });
  }
  // ------------------------------------------
  // スタイル
  function styleKP(feature) {
    const styles = [];
    styles.push(
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: 5,
          fill: new ol.style.Fill({ color: 'blue' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
        })
      })
    );
    styles.push(
      new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'blue',
          width: 2
        })
      })
    );
    return styles;
  }

  return {
    createKPRiver,
    createKPLineRiver,
    createKPRoad,
    createKPLineRoad,
    createSelectionKPLayer,
    createSelectedKPLineLayer,
    styleKPLine,
    styleKP,
    setKPSource,
    onMouseOverKPRiver,
    onMouseOverKPRoad,
    onMouseOutKP,
  }
}

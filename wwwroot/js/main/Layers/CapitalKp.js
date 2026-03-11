'use strict';

// ********************************************************************************************
// ********************************************************************************************
// 調査地点追加　距離標　登録
// ********************************************************************************************
// ********************************************************************************************
export function CapitalKp(ctx) {
  const {
    map,
    root_url,
  } = ctx;
  const kp_font = '14px sans-serif';
  const kp_font_offset = -18;
  /**
   * 河川　距離標レイヤ作成
   * 
   * @param {any} map
   * @returns
   */
  const createKPRiver = (map) => {
    const layer = new ol.layer.Vector({
      style: styleKPRiver,
      visible: false
    });
    return layer;
  };
  function setKPSource(drawType) {
    let url = null;
    if (drawType == 'River') {
      url = root_url + '/files/kp_river_point.json'
    } else if (drawType == 'Road') {
      url = root_url + '/files/kp_road_point.json'
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
  function styleKPRiver(feature) {
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
  function onMouseOverKPRiver(feature) {
    feature.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: 'orange' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
      }),
      text: new ol.style.Text({
        text: feature.get('左右岸') + " " + Number(feature.get('距離標')) + "KP",
        font: kp_font,
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
        offsetY: kp_font_offset,
      })
    }));
  }
  const createKPLineRiver = (map) => {
    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        url: root_url + '/files/kp_river_line.json',
        format: new ol.format.GeoJSON({
          dataProjection: 'EPSG:4326',     // GeoJSON の座標系
          featureProjection: 'EPSG:3857'   // 地図表示用
        })
      }),
      style: styleKPLineRiver,
      visible:false 
    });
    return layer;
  }
  function styleKPLineRiver(feature) {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: '#81AFFF',
        width: 2
      })
    });
  }

  /**
   * 道路　距離標レイヤ作成
   * 
   * @param {any} map
   * @returns
   */
  const createKPRoad = (map) => {
    const layer = new ol.layer.Vector({
      style: _styleKPRoad,
      visible:false,
    });
    return layer;
  };
  function _styleKPRoad(feature) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({ color: 'blue' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
      }),
  //    text: new ol.style.Text({
  //      text: feature.get('路線') + "号線 " + feature.get('地点標名称') + "KP",
  //      font: '8px sans-serif',
  //      fill: new ol.style.Fill({ color: '#000' }),
  //      stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
  //      offsetY: 12
  //    })
    });
  }
  function onMouseOverKPRoad(feature) {
    feature.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: 'orange' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
      }),
      text: new ol.style.Text({
        text: feature.get('路線') + "号線 " + feature.get('地点標名称') + "KP",
        font: kp_font,
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
        offsetY: kp_font_offset,
      })
    }));
  }
}

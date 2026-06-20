export interface CityItem {
  name: string;
  pinyin: string;
}

export interface CityGroup {
  letter: string;
  cities: CityItem[];
}

export const CITY_GROUPS: CityGroup[] = [
  {
    letter: 'A',
    cities: [
      { name: '鞍山', pinyin: 'Anshan' },
      { name: '安庆', pinyin: 'Anqing' },
      { name: '安阳', pinyin: 'Anyang' },
      { name: '阿坝', pinyin: 'Aba' }
    ]
  },
  {
    letter: 'B',
    cities: [
      { name: '北京', pinyin: 'Beijing' },
      { name: '本溪', pinyin: 'Benxi' },
      { name: '包头', pinyin: 'Baotou' },
      { name: '保定', pinyin: 'Baoding' },
      { name: '宝鸡', pinyin: 'Baoji' },
      { name: '蚌埠', pinyin: 'Bengbu' }
    ]
  },
  {
    letter: 'C',
    cities: [
      { name: '成都', pinyin: 'Chengdu' },
      { name: '重庆', pinyin: 'Chongqing' },
      { name: '长沙', pinyin: 'Changsha' },
      { name: '长春', pinyin: 'Changchun' },
      { name: '常州', pinyin: 'Changzhou' },
      { name: '沧州', pinyin: 'Cangzhou' }
    ]
  },
  {
    letter: 'D',
    cities: [
      { name: '大连', pinyin: 'Dalian' },
      { name: '东莞', pinyin: 'Dongguan' },
      { name: '大庆', pinyin: 'Daqing' },
      { name: '大同', pinyin: 'Datong' },
      { name: '德州', pinyin: 'Dezhou' },
      { name: '东营', pinyin: 'Dongying' }
    ]
  },
  {
    letter: 'E',
    cities: [
      { name: '鄂尔多斯', pinyin: 'Ordos' },
      { name: '恩施', pinyin: 'Enshi' }
    ]
  },
  {
    letter: 'F',
    cities: [
      { name: '福州', pinyin: 'Fuzhou' },
      { name: '佛山', pinyin: 'Foshan' },
      { name: '抚顺', pinyin: 'Fushun' },
      { name: '阜新', pinyin: 'Fuxin' },
      { name: '阜阳', pinyin: 'Fuyang' }
    ]
  },
  {
    letter: 'G',
    cities: [
      { name: '广州', pinyin: 'Guangzhou' },
      { name: '贵阳', pinyin: 'Guiyang' },
      { name: '桂林', pinyin: 'Guilin' },
      { name: '赣州', pinyin: 'Ganzhou' }
    ]
  },
  {
    letter: 'H',
    cities: [
      { name: '杭州', pinyin: 'Hangzhou' },
      { name: '哈尔滨', pinyin: 'Harbin' },
      { name: '合肥', pinyin: 'Hefei' },
      { name: '呼和浩特', pinyin: 'Hohhot' },
      { name: '海口', pinyin: 'Haikou' },
      { name: '惠州', pinyin: 'Huizhou' },
      { name: '湖州', pinyin: 'Huzhou' },
      { name: '邯郸', pinyin: 'Handan' }
    ]
  },
  {
    letter: 'J',
    cities: [
      { name: '济南', pinyin: 'Jinan' },
      { name: '吉林', pinyin: 'Jilin' },
      { name: '江门', pinyin: 'Jiangmen' },
      { name: '嘉兴', pinyin: 'Jiaxing' },
      { name: '金华', pinyin: 'Jinhua' },
      { name: '荆州', pinyin: 'Jingzhou' },
      { name: '九江', pinyin: 'Jiujiang' }
    ]
  },
  {
    letter: 'K',
    cities: [
      { name: '昆明', pinyin: 'Kunming' },
      { name: '开封', pinyin: 'Kaifeng' },
      { name: '克拉玛依', pinyin: 'Karamay' }
    ]
  },
  {
    letter: 'L',
    cities: [
      { name: '兰州', pinyin: 'Lanzhou' },
      { name: '洛阳', pinyin: 'Luoyang' },
      { name: '临沂', pinyin: 'Linyi' },
      { name: '柳州', pinyin: 'Liuzhou' },
      { name: '连云港', pinyin: 'Lianyungang' },
      { name: '廊坊', pinyin: 'Langfang' }
    ]
  },
  {
    letter: 'M',
    cities: [
      { name: '马鞍山', pinyin: 'Maanshan' },
      { name: '茂名', pinyin: 'Maoming' },
      { name: '梅州', pinyin: 'Meizhou' },
      { name: '绵阳', pinyin: 'Mianyang' }
    ]
  },
  {
    letter: 'N',
    cities: [
      { name: '南京', pinyin: 'Nanjing' },
      { name: '南昌', pinyin: 'Nanchang' },
      { name: '南宁', pinyin: 'Nanning' },
      { name: '宁波', pinyin: 'Ningbo' },
      { name: '南通', pinyin: 'Nantong' },
      { name: '南阳', pinyin: 'Nanyang' }
    ]
  },
  {
    letter: 'P',
    cities: [
      { name: '盘锦', pinyin: 'Panjin' },
      { name: '平顶山', pinyin: 'Pingdingshan' },
      { name: '莆田', pinyin: 'Putian' }
    ]
  },
  {
    letter: 'Q',
    cities: [
      { name: '青岛', pinyin: 'Qingdao' },
      { name: '秦皇岛', pinyin: 'Qinhuangdao' },
      { name: '泉州', pinyin: 'Quanzhou' },
      { name: '齐齐哈尔', pinyin: 'Qiqihar' },
      { name: '衢州', pinyin: 'Quzhou' }
    ]
  },
  {
    letter: 'R',
    cities: [
      { name: '日照', pinyin: 'Rizhao' }
    ]
  },
  {
    letter: 'S',
    cities: [
      { name: '上海', pinyin: 'Shanghai' },
      { name: '深圳', pinyin: 'Shenzhen' },
      { name: '沈阳', pinyin: 'Shenyang' },
      { name: '石家庄', pinyin: 'Shijiazhuang' },
      { name: '苏州', pinyin: 'Suzhou' },
      { name: '三亚', pinyin: 'Sanya' },
      { name: '绍兴', pinyin: 'Shaoxing' },
      { name: '汕头', pinyin: 'Shantou' }
    ]
  },
  {
    letter: 'T',
    cities: [
      { name: '天津', pinyin: 'Tianjin' },
      { name: '太原', pinyin: 'Taiyuan' },
      { name: '唐山', pinyin: 'Tangshan' },
      { name: '台州', pinyin: 'Taizhou' },
      { name: '泰州', pinyin: 'Taizhou' },
      { name: '铁岭', pinyin: 'Tieling' }
    ]
  },
  {
    letter: 'W',
    cities: [
      { name: '武汉', pinyin: 'Wuhan' },
      { name: '无锡', pinyin: 'Wuxi' },
      { name: '乌鲁木齐', pinyin: 'Urumqi' },
      { name: '温州', pinyin: 'Wenzhou' },
      { name: '潍坊', pinyin: 'Weifang' },
      { name: '威海', pinyin: 'Weihai' },
      { name: '芜湖', pinyin: 'Wuhu' }
    ]
  },
  {
    letter: 'X',
    cities: [
      { name: '西安', pinyin: 'Xian' },
      { name: '厦门', pinyin: 'Xiamen' },
      { name: '西宁', pinyin: 'Xining' },
      { name: '新乡', pinyin: 'Xinxiang' },
      { name: '咸阳', pinyin: 'Xianyang' },
      { name: '邢台', pinyin: 'Xingtai' },
      { name: '徐州', pinyin: 'Xuzhou' },
      { name: '襄阳', pinyin: 'Xiangyang' }
    ]
  },
  {
    letter: 'Y',
    cities: [
      { name: '银川', pinyin: 'Yinchuan' },
      { name: '扬州', pinyin: 'Yangzhou' },
      { name: '烟台', pinyin: 'Yantai' },
      { name: '宜昌', pinyin: 'Yichang' },
      { name: '岳阳', pinyin: 'Yueyang' },
      { name: '盐城', pinyin: 'Yancheng' },
      { name: '义乌', pinyin: 'Yiwu' }
    ]
  },
  {
    letter: 'Z',
    cities: [
      { name: '郑州', pinyin: 'Zhengzhou' },
      { name: '珠海', pinyin: 'Zhuhai' },
      { name: '中山', pinyin: 'Zhongshan' },
      { name: '淄博', pinyin: 'Zibo' },
      { name: '漳州', pinyin: 'Zhangzhou' },
      { name: '株洲', pinyin: 'Zhuzhou' },
      { name: '镇江', pinyin: 'Zhenjiang' },
      { name: '湛江', pinyin: 'Zhanjiang' }
    ]
  }
];

export const ALL_CITIES_FLAT = CITY_GROUPS.reduce<CityItem[]>((acc, group) => {
  return [...acc, ...group.cities];
}, []);

/**
 * 行政区划种子数据。
 *
 * 单独成文件是因为存量数据导入脚本也要用它做地名匹配，
 * 而 seed.ts 在模块顶层就会连库跑迁移，不能被 import。
 *
 * 覆盖范围：全国主要省市，外加河北全境到区县 + 京津的区。
 * 河北下钻得细，是因为业务主战场在辛集一带，只到地级市会把不同通勤圈糊在一起。
 */
export type RegionSeed = { code: string; name: string; level: number; parent?: string; lat?: number; lng?: number };

export const REGIONS: RegionSeed[] = [
  { code: '110000', name: '北京市', level: 1 },
  { code: '110100', name: '北京市', level: 2, parent: '110000', lat: 39.9042, lng: 116.4074 },
  { code: '310000', name: '上海市', level: 1 },
  { code: '310100', name: '上海市', level: 2, parent: '310000', lat: 31.2304, lng: 121.4737 },
  { code: '440000', name: '广东省', level: 1 },
  { code: '440100', name: '广州市', level: 2, parent: '440000', lat: 23.1291, lng: 113.2644 },
  { code: '440300', name: '深圳市', level: 2, parent: '440000', lat: 22.5431, lng: 114.0579 },
  { code: '440600', name: '佛山市', level: 2, parent: '440000', lat: 23.0219, lng: 113.1214 },
  { code: '440400', name: '珠海市', level: 2, parent: '440000', lat: 22.271, lng: 113.5767 },
  { code: '330000', name: '浙江省', level: 1 },
  { code: '330100', name: '杭州市', level: 2, parent: '330000', lat: 30.2741, lng: 120.1551 },
  { code: '330200', name: '宁波市', level: 2, parent: '330000', lat: 29.8683, lng: 121.544 },
  { code: '330300', name: '温州市', level: 2, parent: '330000', lat: 27.9938, lng: 120.6994 },
  { code: '320000', name: '江苏省', level: 1 },
  { code: '320100', name: '南京市', level: 2, parent: '320000', lat: 32.0603, lng: 118.7969 },
  { code: '320500', name: '苏州市', level: 2, parent: '320000', lat: 31.2989, lng: 120.5853 },
  { code: '320200', name: '无锡市', level: 2, parent: '320000', lat: 31.4912, lng: 120.3119 },
  { code: '510000', name: '四川省', level: 1 },
  { code: '510100', name: '成都市', level: 2, parent: '510000', lat: 30.5728, lng: 104.0668 },
  { code: '420000', name: '湖北省', level: 1 },
  { code: '420100', name: '武汉市', level: 2, parent: '420000', lat: 30.5928, lng: 114.3055 },
  { code: '610000', name: '陕西省', level: 1 },
  { code: '610100', name: '西安市', level: 2, parent: '610000', lat: 34.3416, lng: 108.9398 },
  { code: '370000', name: '山东省', level: 1 },
  { code: '370100', name: '济南市', level: 2, parent: '370000', lat: 36.6512, lng: 117.1201 },
  { code: '370200', name: '青岛市', level: 2, parent: '370000', lat: 36.0671, lng: 120.3826 },
  { code: '410000', name: '河南省', level: 1 },
  { code: '410100', name: '郑州市', level: 2, parent: '410000', lat: 34.7466, lng: 113.6254 },
  { code: '430000', name: '湖南省', level: 1 },
  { code: '430100', name: '长沙市', level: 2, parent: '430000', lat: 28.2282, lng: 112.9388 },
  { code: '350000', name: '福建省', level: 1 },
  { code: '350100', name: '福州市', level: 2, parent: '350000', lat: 26.0745, lng: 119.2965 },
  { code: '350200', name: '厦门市', level: 2, parent: '350000', lat: 24.4798, lng: 118.0894 },
  { code: '120000', name: '天津市', level: 1 },
  { code: '120100', name: '天津市', level: 2, parent: '120000', lat: 39.3434, lng: 117.3616 },
  { code: '500000', name: '重庆市', level: 1 },
  { code: '500100', name: '重庆市', level: 2, parent: '500000', lat: 29.5647, lng: 106.5507 },
  { code: '340000', name: '安徽省', level: 1 },
  { code: '340100', name: '合肥市', level: 2, parent: '340000', lat: 31.8206, lng: 117.2272 },

  // ── 河北省：这是当前主要业务区域，必须下钻到区县 ──
  // 存量客户高度集中在辛集及石家庄周边，只到地级市粒度会把"辛集"和"石家庄"糊成一个，
  // 而这两地在相亲场景里恰恰是不同的通勤圈，红娘不接受。
  { code: '130000', name: '河北省', level: 1 },
  { code: '130100', name: '石家庄市', level: 2, parent: '130000', lat: 38.0428, lng: 114.5149 },
  { code: '130102', name: '长安区', level: 3, parent: '130100' },
  { code: '130104', name: '桥西区', level: 3, parent: '130100' },
  { code: '130105', name: '新华区', level: 3, parent: '130100' },
  { code: '130107', name: '井陉矿区', level: 3, parent: '130100' },
  { code: '130108', name: '裕华区', level: 3, parent: '130100' },
  { code: '130109', name: '藁城区', level: 3, parent: '130100' },
  { code: '130110', name: '鹿泉区', level: 3, parent: '130100' },
  { code: '130111', name: '栾城区', level: 3, parent: '130100' },
  { code: '130121', name: '井陉县', level: 3, parent: '130100' },
  { code: '130123', name: '正定县', level: 3, parent: '130100' },
  { code: '130125', name: '行唐县', level: 3, parent: '130100' },
  { code: '130126', name: '灵寿县', level: 3, parent: '130100' },
  { code: '130127', name: '高邑县', level: 3, parent: '130100' },
  { code: '130128', name: '深泽县', level: 3, parent: '130100' },
  { code: '130129', name: '赞皇县', level: 3, parent: '130100' },
  { code: '130130', name: '无极县', level: 3, parent: '130100' },
  { code: '130131', name: '平山县', level: 3, parent: '130100' },
  { code: '130132', name: '元氏县', level: 3, parent: '130100' },
  { code: '130133', name: '赵县', level: 3, parent: '130100' },
  { code: '130181', name: '辛集市', level: 3, parent: '130100', lat: 37.9403, lng: 115.2175 },
  { code: '130183', name: '晋州市', level: 3, parent: '130100', lat: 38.0317, lng: 115.0432 },
  { code: '130184', name: '新乐市', level: 3, parent: '130100' },
  { code: '130200', name: '唐山市', level: 2, parent: '130000', lat: 39.6304, lng: 118.1804 },
  { code: '130300', name: '秦皇岛市', level: 2, parent: '130000', lat: 39.9354, lng: 119.6, },
  { code: '130400', name: '邯郸市', level: 2, parent: '130000', lat: 36.6255, lng: 114.5391 },
  { code: '130500', name: '邢台市', level: 2, parent: '130000', lat: 37.0682, lng: 114.5048 },
  { code: '130502', name: '襄都区', level: 3, parent: '130500' },
  { code: '130503', name: '信都区', level: 3, parent: '130500' },
  { code: '130528', name: '新河县', level: 3, parent: '130500' },
  { code: '130600', name: '保定市', level: 2, parent: '130000', lat: 38.8671, lng: 115.4845 },
  { code: '130602', name: '竞秀区', level: 3, parent: '130600' },
  { code: '130606', name: '莲池区', level: 3, parent: '130600' },
  { code: '130607', name: '满城区', level: 3, parent: '130600' },
  { code: '130608', name: '清苑区', level: 3, parent: '130600' },
  { code: '130609', name: '徐水区', level: 3, parent: '130600' },
  { code: '130682', name: '定州市', level: 3, parent: '130600', lat: 38.5165, lng: 114.9903 },
  { code: '130700', name: '张家口市', level: 2, parent: '130000', lat: 40.7686, lng: 114.8869 },
  { code: '130800', name: '承德市', level: 2, parent: '130000', lat: 40.9515, lng: 117.9634 },
  { code: '130900', name: '沧州市', level: 2, parent: '130000', lat: 38.3037, lng: 116.8388 },
  { code: '130982', name: '任丘市', level: 3, parent: '130900' },
  { code: '131000', name: '廊坊市', level: 2, parent: '130000', lat: 39.5378, lng: 116.6836 },
  { code: '131100', name: '衡水市', level: 2, parent: '130000', lat: 37.7392, lng: 115.6705 },
  { code: '131103', name: '冀州区', level: 3, parent: '131100' },
  { code: '131121', name: '枣强县', level: 3, parent: '131100' },
  { code: '131123', name: '武强县', level: 3, parent: '131100' },
  { code: '131125', name: '安平县', level: 3, parent: '131100' },
  { code: '131182', name: '深州市', level: 3, parent: '131100' },
  { code: '130530', name: '宁晋县', level: 3, parent: '130500' },
  { code: '131082', name: '三河市', level: 3, parent: '131000' },

  // ── 直辖市的区：老数据里"北京海淀区""天津河东区"这类写法很多 ──
  { code: '110101', name: '东城区', level: 3, parent: '110100' },
  { code: '110102', name: '西城区', level: 3, parent: '110100' },
  { code: '110105', name: '朝阳区', level: 3, parent: '110100' },
  { code: '110106', name: '丰台区', level: 3, parent: '110100' },
  { code: '110107', name: '石景山区', level: 3, parent: '110100' },
  { code: '110108', name: '海淀区', level: 3, parent: '110100' },
  { code: '110111', name: '房山区', level: 3, parent: '110100' },
  { code: '110112', name: '通州区', level: 3, parent: '110100' },
  { code: '110113', name: '顺义区', level: 3, parent: '110100' },
  { code: '110114', name: '昌平区', level: 3, parent: '110100' },
  { code: '110115', name: '大兴区', level: 3, parent: '110100' },
  { code: '120102', name: '河东区', level: 3, parent: '120100' },
  { code: '120103', name: '河西区', level: 3, parent: '120100' },
  { code: '120104', name: '南开区', level: 3, parent: '120100' },
  { code: '120105', name: '河北区', level: 3, parent: '120100' },
  { code: '120110', name: '东丽区', level: 3, parent: '120100' },
  { code: '120111', name: '西青区', level: 3, parent: '120100' },
  { code: '120112', name: '津南区', level: 3, parent: '120100' },
  { code: '120113', name: '北辰区', level: 3, parent: '120100' },
  { code: '120114', name: '武清区', level: 3, parent: '120100' },
  { code: '120116', name: '滨海新区', level: 3, parent: '120100' },

  // ── 存量客户里零星出现的外省市 ──
  { code: '140000', name: '山西省', level: 1 },
  { code: '140200', name: '大同市', level: 2, parent: '140000' },
  { code: '370600', name: '烟台市', level: 2, parent: '370000' },
  { code: '320600', name: '南通市', level: 2, parent: '320000' },
  { code: '340800', name: '安庆市', level: 2, parent: '340000' },
  { code: '220000', name: '吉林省', level: 1 },
  { code: '640000', name: '宁夏回族自治区', level: 1 },
];

/**
 * 地名别名：本地人报单位、村镇、旧地名，等同于报地址。
 *
 * 老库里"澳森办公楼""束鹿街西头""中里厢乡"这种写法，在本地人看来就是辛集，
 * 但它们不在行政区划表里。这张表把它们挂到对应的区划代码上。
 *
 * 绝大多数条目指向辛集（130181）——业务主战场在那儿，村镇名基本都是辛集下辖的。
 * 新增条目请确认真的唯一指向某地，"万达""开发区""老家"这类到处都有的不要加。
 */
export const REGION_ALIASES: Record<string, string> = {
  // 辛集（130181）：旧称、本地企业、下辖乡镇与村
  束鹿: '130181', // 辛集旧称
  澳森: '130181', // 澳森集团，辛集最大的用工单位之一
  奥森: '130181', // 澳森的常见错写
  皮革城: '130181', // 辛集国际皮革城
  锚营: '130181',
  位伯: '130181',
  中里厢: '130181',
  中里相: '130181', // 中里厢的常见错写
  旧城: '130181',
  新城: '130181',
  小辛庄: '130181',
  张古庄: '130181',
  王口: '130181',
  南智丘: '130181',
  南智邱: '130181',
  天宫营: '130181',
  田家庄: '130181',
  马庄: '130181',
  范家庄: '130181',
  范庄: '130181',
  大士庄: '130181',
  小士庄: '130181',
  总十庄: '130181',
  和睦井: '130181',
  泊庄: '130181',
  郭西: '130181',
  浩固: '130181',
  大冯: '130181',
  京洲幸福城: '130181',

  // 其他：旧地名与俗称
  晋县: '130183', // 晋州市旧称
  冀州: '131103',
  燕郊: '131082', // 三河市燕郊镇，跨省通勤到北京的那片
  雄安: '130600', // 雄安新区没有独立 adcode，挂到代管的保定
};

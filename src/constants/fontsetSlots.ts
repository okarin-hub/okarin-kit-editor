/**
 * Character slots of the PES 2021 number / name font textures, measured from modder templates
 * (three different fontsets put every character in the same place, ±5 px).
 * x0..x1 = union of the glyph extents seen in the samples; the game cuts the characters from these places.
 */

export interface FontSlot {
  ch: string;
  x0: number;
  x1: number;
}

export interface FontsetLayout {
  width: number;
  height: number;
  rowHeight: number;
  rows: FontSlot[][];
  /** glyph top / baseline inside a row, at this layout's own scale */
  top: number;
  baseline: number;
}

const slots = (chars: string[], boxes: [number, number][]): FontSlot[] =>
  chars.map((ch, i) => ({ ch, x0: boxes[i][0], x1: boxes[i][1] }));

const DIGIT_BOXES: [number, number][] = [
  [17, 142], [199, 285], [359, 480], [559, 683], [752, 886],
  [960, 1080], [1158, 1282], [1360, 1481], [1556, 1684], [1758, 1882],
];
const DIGITS = '0123456789'.split('');

/** chest and shorts (leg) numbers: 2048×256; digits fill the whole height */
export const NUMBER_LAYOUT: FontsetLayout = {
  width: 2048,
  height: 256,
  rowHeight: 256,
  rows: [slots(DIGITS, DIGIT_BOXES)],
  top: 2,
  baseline: 253,
};

/** back numbers: 4096×512, the same layout at twice the size */
export const BACK_NUMBER_LAYOUT: FontsetLayout = {
  width: 4096,
  height: 512,
  rowHeight: 512,
  rows: [slots(DIGITS, DIGIT_BOXES.map(([a, b]) => [a * 2, b * 2]))],
  top: 4,
  baseline: 506,
};

/** name font: 2048×512, A–N / O–Z and the full stop; capitals from y 55 to the baseline at 220 of each 256 px row */
export const NAME_LAYOUT: FontsetLayout = {
  width: 2048,
  height: 512,
  rowHeight: 256,
  rows: [
    slots('ABCDEFGHIJKLMN'.split(''), [
      [44, 136], [206, 292], [359, 440], [517, 601], [672, 742], [801, 871], [935, 1017],
      [1088, 1173], [1225, 1254], [1306, 1386], [1442, 1529], [1589, 1660], [1719, 1849], [1909, 1994],
    ]),
    slots('OPQRSTUVWXYZ.'.split(''), [
      [48, 130], [208, 290], [363, 453], [535, 619], [689, 767], [838, 921], [989, 1073],
      [1143, 1234], [1305, 1447], [1508, 1596], [1670, 1756], [1833, 1910], [1971, 2002],
    ]),
  ],
  top: 55,
  baseline: 220,
};

/** name font extension (<NameFontFile>_ex): 2048×1024, accented capitals, same scale as the name font */
export const NAME_EX_LAYOUT: FontsetLayout = {
  width: 2048,
  height: 1024,
  rowHeight: 256,
  rows: [
    slots(['´', '-', 'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Ă', 'Æ', 'Ç', 'Ć', 'Č'], [
      [34, 67], [123, 180], [241, 333], [401, 493], [561, 653], [722, 814], [881, 973],
      [1041, 1133], [1202, 1294], [1377, 1504], [1584, 1665], [1729, 1810], [1872, 1953],
    ]),
    // one slot between Ę and Ğ is empty in every sample, so it is left out
    slots(['Ð', 'Đ', 'È', 'É', 'Ê', 'Ë', 'Ę', 'Ğ', 'Ì', 'Í', 'Î', 'Ï', 'İ', 'Ł'], [
      [35, 131], [193, 289], [365, 433], [510, 578], [654, 722], [798, 866], [942, 1010],
      [1223, 1304], [1369, 1406], [1491, 1528], [1590, 1641], [1700, 1755], [1819, 1846], [1908, 1987],
    ]),
    slots(['Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'Ř', 'Ş', 'Š', 'ß', 'Ţ', 'Þ'], [
      [44, 130], [206, 289], [365, 449], [526, 610], [686, 770], [846, 930], [1015, 1099],
      [1172, 1256], [1314, 1394], [1445, 1525], [1575, 1668], [1719, 1802], [1864, 1946],
    ]),
    slots(['Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Ż', 'Ž', 'Ą'], [
      [39, 123], [186, 270], [334, 418], [483, 567], [630, 714], [778, 854], [921, 997], [1071, 1163],
    ]),
  ],
  top: 55,
  baseline: 220,
};

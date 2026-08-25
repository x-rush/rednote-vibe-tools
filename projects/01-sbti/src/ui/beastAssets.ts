export type BeastAsset = {
  beastId: string
  src: string
  placeholder?: string
  shareFocusY: number
}

const BEAST_ASSETS: Readonly<Record<string, BeastAsset>> = {
  RTLS: { beastId: 'luwu', src: './assets/shbti/beasts/luwu/profile-v2-reference-verified.webp', placeholder: './assets/shbti/beasts/luwu/placeholder-v2.webp', shareFocusY: 0.5 },
  RTLM: { beastId: 'ershu', src: './assets/shbti/beasts/ershu/profile-v2-reference-verified.webp', placeholder: './assets/shbti/beasts/ershu/placeholder-v2.webp', shareFocusY: 0.5 },
  RTES: { beastId: 'dangkang', src: './assets/shbti/beasts/dangkang/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/dangkang/placeholder-v1.webp', shareFocusY: 0.5 },
  RTEM: { beastId: 'xingxing', src: './assets/shbti/beasts/xingxing/profile-v2-reference-verified.webp', placeholder: './assets/shbti/beasts/xingxing/placeholder-v2.webp', shareFocusY: 0.5 },
  RVLS: { beastId: 'yingzhao', src: './assets/shbti/beasts/yingzhao/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/yingzhao/placeholder-v1.webp', shareFocusY: 0.3 },
  RVLM: { beastId: 'dijiang', src: './assets/shbti/beasts/dijiang/profile-v2-reference-verified.webp', placeholder: './assets/shbti/beasts/dijiang/placeholder-v2.webp', shareFocusY: 0.5 },
  RVES: { beastId: 'huan', src: './assets/shbti/beasts/huan/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/huan/placeholder-v1.webp', shareFocusY: 0.5 },
  RVEM: { beastId: 'fenghuang', src: './assets/shbti/beasts/fenghuang/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/fenghuang/placeholder-v1.webp', shareFocusY: 0.25 },
  HTLS: { beastId: 'xuangui', src: './assets/shbti/beasts/xuangui/profile-v3-reference-verified.webp', placeholder: './assets/shbti/beasts/xuangui/placeholder-v3.webp', shareFocusY: 0.4 },
  HTLM: { beastId: 'bifang', src: './assets/shbti/beasts/bifang/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/bifang/placeholder-v1.webp', shareFocusY: 0.25 },
  HTES: { beastId: 'jingwei', src: './assets/shbti/beasts/jingwei/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/jingwei/placeholder-v1.webp', shareFocusY: 0.5 },
  HTEM: { beastId: 'lushu', src: './assets/shbti/beasts/lushu/profile-v2-reference-verified.webp', placeholder: './assets/shbti/beasts/lushu/placeholder-v2.webp', shareFocusY: 0.3 },
  HVLS: { beastId: 'kaimingshou', src: './assets/shbti/beasts/kaimingshou/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/kaimingshou/placeholder-v1.webp', shareFocusY: 0.25 },
  HVLM: { beastId: 'zhuyin', src: './assets/shbti/beasts/zhuyin/profile-v1-reference-verified.webp', placeholder: './assets/shbti/beasts/zhuyin/placeholder-v1.webp', shareFocusY: 0.25 },
  HVES: { beastId: 'feifei', src: './assets/shbti/beasts/feifei/profile-v2-reference-verified.webp', placeholder: './assets/shbti/beasts/feifei/placeholder-v2.webp', shareFocusY: 0.5 },
  HVEM: { beastId: 'jiuweihu', src: './assets/shbti/beasts/jiuweihu/profile-v3-reference-verified.webp', placeholder: './assets/shbti/beasts/jiuweihu/placeholder-v3.webp', shareFocusY: 0.5 },
}

export function getBeastAsset(code: string): BeastAsset | undefined {
  return BEAST_ASSETS[code]
}

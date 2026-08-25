export type BeastAsset = {
  beastId: string
  src: string
  placeholder?: string
}

const BEAST_ASSETS: Readonly<Record<string, BeastAsset>> = {
  RTLS: { beastId: 'luwu', src: '/assets/sbti/beasts/luwu/profile-v2-reference-verified.webp', placeholder: '/assets/sbti/beasts/luwu/placeholder-v2.webp' },
  RTLM: { beastId: 'ershu', src: '/assets/sbti/beasts/ershu/profile-v2-reference-verified.webp' },
  RTES: { beastId: 'dangkang', src: '/assets/sbti/beasts/dangkang/profile-v1-reference-verified.webp' },
  RTEM: { beastId: 'xingxing', src: '/assets/sbti/beasts/xingxing/profile-v2-reference-verified.webp' },
  RVLS: { beastId: 'yingzhao', src: '/assets/sbti/beasts/yingzhao/profile-v1-reference-verified.webp' },
  RVLM: { beastId: 'dijiang', src: '/assets/sbti/beasts/dijiang/profile-v2-reference-verified.webp' },
  RVES: { beastId: 'huan', src: '/assets/sbti/beasts/huan/profile-v1-reference-verified.webp' },
  RVEM: { beastId: 'fenghuang', src: '/assets/sbti/beasts/fenghuang/profile-v1-reference-verified.webp' },
  HTLS: { beastId: 'xuangui', src: '/assets/sbti/beasts/xuangui/profile-v3-reference-verified.webp' },
  HTLM: { beastId: 'bifang', src: '/assets/sbti/beasts/bifang/profile-v1-reference-verified.webp', placeholder: '/assets/sbti/beasts/bifang/placeholder-v1.webp' },
  HTES: { beastId: 'jingwei', src: '/assets/sbti/beasts/jingwei/profile-v1-reference-verified.webp', placeholder: '/assets/sbti/beasts/jingwei/placeholder-v1.webp' },
  HTEM: { beastId: 'lushu', src: '/assets/sbti/beasts/lushu/profile-v2-reference-verified.webp', placeholder: '/assets/sbti/beasts/lushu/placeholder-v2.webp' },
  HVLS: { beastId: 'kaimingshou', src: '/assets/sbti/beasts/kaimingshou/profile-v1-reference-verified.webp', placeholder: '/assets/sbti/beasts/kaimingshou/placeholder-v1.webp' },
  HVLM: { beastId: 'zhuyin', src: '/assets/sbti/beasts/zhuyin/profile-v1-reference-verified.webp', placeholder: '/assets/sbti/beasts/zhuyin/placeholder-v1.webp' },
  HVES: { beastId: 'feifei', src: '/assets/sbti/beasts/feifei/profile-v2-reference-verified.webp', placeholder: '/assets/sbti/beasts/feifei/placeholder-v2.webp' },
  HVEM: { beastId: 'jiuweihu', src: '/assets/sbti/beasts/jiuweihu/profile-v3-reference-verified.webp', placeholder: '/assets/sbti/beasts/jiuweihu/placeholder-v3.webp' },
}

export function getBeastAsset(code: string): BeastAsset | undefined {
  return BEAST_ASSETS[code]
}

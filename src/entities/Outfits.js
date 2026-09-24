// Clothing definitions. `disguise` is the gameplay identity used for zone
// access; several visual outfits may share one disguise (all guests are 'guest').

export const DISGUISES = {
  suit: { name: 'Костюм агента', short: 'Костюм' },
  guest: { name: 'Гость', short: 'Гость' },
  waiter: { name: 'Официант', short: 'Официант' },
  bartender: { name: 'Бармен', short: 'Бармен' },
  chef: { name: 'Повар', short: 'Повар' },
  sommelier: { name: 'Сомелье', short: 'Сомелье' },
  gardener: { name: 'Садовник', short: 'Садовник' },
  guard: { name: 'Охранник', short: 'Охранник' },
  security_chief: { name: 'Начальник охраны', short: 'Нач. охраны' },
  appraiser: { name: 'Оценщик', short: 'Оценщик' },
  technician: { name: 'Техник', short: 'Техник' },
  underwear: { name: 'Нижнее бельё', short: 'Бельё' },
};

// Colours are hex numbers; style flags drive the geometry generator.
export const OUTFITS = {
  // The player's own look: charcoal-grey suit, dark shirt, no tie.
  agent: {
    disguise: 'suit',
    jacket: 0x4c525b,
    shirt: 0x24272c,
    pants: 0x464c55,
    shoes: 0x16110e,
    lapel: 0x3d424a,
    style: 'suit',
  },
  guest_navy: { disguise: 'guest', jacket: 0x1d2638, shirt: 0xf0f0ec, pants: 0x1d2638, shoes: 0x1a1410, tie: 0x6a1a2a, style: 'suit' },
  guest_black: { disguise: 'guest', jacket: 0x121214, shirt: 0xf4f4f0, pants: 0x121214, shoes: 0x0c0c0c, tie: 0x101010, bowtie: true, style: 'suit' },
  guest_beige: { disguise: 'guest', jacket: 0xb8a282, shirt: 0xe8e4dc, pants: 0x8a7a62, shoes: 0x4a2e1a, tie: 0x2a4a6a, style: 'suit' },
  guest_white: { disguise: 'guest', jacket: 0xe6e2d8, shirt: 0x1a1a1a, pants: 0x2a2a2a, shoes: 0x101010, style: 'suit' },
  guest_burgundy: { disguise: 'guest', jacket: 0x4a1620, shirt: 0x151515, pants: 0x151515, shoes: 0x0c0c0c, style: 'suit' },
  dress_red: { disguise: 'guest', dress: 0x8a1420, shoes: 0x2a0a0a, style: 'dress', long: true },
  dress_black: { disguise: 'guest', dress: 0x141418, shoes: 0x0a0a0a, style: 'dress', long: false },
  dress_emerald: { disguise: 'guest', dress: 0x0e4a38, shoes: 0x1a1a1a, style: 'dress', long: true },
  dress_gold: { disguise: 'guest', dress: 0xb8944a, shoes: 0x3a2a14, style: 'dress', long: false },
  dress_blue: { disguise: 'guest', dress: 0x1e3a6a, shoes: 0x101010, style: 'dress', long: true },
  waiter: { disguise: 'waiter', jacket: 0x151515, vest: true, shirt: 0xf6f6f2, pants: 0x151515, shoes: 0x0c0c0c, bowtie: true, tie: 0x101010, style: 'vest' },
  bartender: { disguise: 'bartender', jacket: 0x5a1a22, vest: true, shirt: 0xf2f0ea, pants: 0x1a1a1a, shoes: 0x0c0c0c, apron: 0x1a1a1a, style: 'vest' },
  chef: { disguise: 'chef', jacket: 0xf4f4f2, shirt: 0xf4f4f2, pants: 0x2a2a2e, shoes: 0x1a1a1a, apron: 0xe8e8e4, hat: 'toque', style: 'chef' },
  head_chef: { disguise: 'chef', jacket: 0xf4f4f2, shirt: 0xf4f4f2, pants: 0x1a1a1a, shoes: 0x1a1a1a, apron: 0x1a1a1a, hat: 'toque', neckerchief: 0xb02020, style: 'chef' },
  sommelier: { disguise: 'sommelier', jacket: 0x1a1a1c, vest: true, shirt: 0xf0ece0, pants: 0x1a1a1c, shoes: 0x2a1a10, apron: 0x3a2a20, tie: 0x5a1a22, style: 'vest' },
  gardener: { disguise: 'gardener', jacket: 0x4a5a3a, shirt: 0x6a6a52, pants: 0x3a3a2c, shoes: 0x3a2a1a, hat: 'bucket', hatColor: 0x6a6a4a, gloves: 0x8a7a50, style: 'overalls' },
  guard: { disguise: 'guard', jacket: 0x1c1f24, shirt: 0x2a2e34, pants: 0x1c1f24, shoes: 0x0e0e0e, tie: 0x14161a, earpiece: true, style: 'suit' },
  guard_tactical: { disguise: 'guard', jacket: 0x2a2e30, shirt: 0x2a2e30, pants: 0x2a2e30, shoes: 0x141414, vestTac: 0x1a1c1e, cap: 0x1a1c1e, earpiece: true, style: 'tactical' },
  security_chief: { disguise: 'security_chief', jacket: 0x2a2a30, shirt: 0xd8d8d4, pants: 0x2a2a30, shoes: 0x0e0e0e, tie: 0x0e2238, earpiece: true, glasses: 'shades', style: 'suit' },
  appraiser: { disguise: 'appraiser', jacket: 0x6a5238, shirt: 0xe8e0cc, pants: 0x4a3a28, shoes: 0x3a2414, tie: 0x2a4a2a, glasses: 'round', style: 'suit' },
  technician: { disguise: 'technician', jacket: 0x2a4a7a, shirt: 0x2a4a7a, pants: 0x2a4a7a, shoes: 0x1a1a1a, cap: 0x2a4a7a, style: 'overalls' },
  // Victims left in their underwear after the player takes their clothes.
  underwear: { disguise: 'underwear', jacket: 0xe8e8e4, shirt: 0xe8e8e4, pants: 0xd0d0cc, shoes: 0x1a1a1a, style: 'underwear' },
  // Targets
  kessler: { disguise: 'guest', jacket: 0x0e0f14, shirt: 0x6a1a1a, pants: 0x0e0f14, shoes: 0x3a1e10, pocketSquare: 0xc8a050, style: 'suit' },
  vale: { disguise: 'guest', dress: 0xe6e0d0, shoes: 0x8a6a3a, style: 'dress', long: true, necklace: true },
};

export const SKIN_TONES = [0xe8c4a8, 0xd8b090, 0xc89878, 0xa87858, 0x8a5a3c, 0x6a4028, 0xf0d0b8];
export const HAIR_COLORS = [0x1a1410, 0x2a1e14, 0x4a3420, 0x6a4a2a, 0x8a8a8a, 0xc8b080, 0x3a2a20, 0xd0d0d0];

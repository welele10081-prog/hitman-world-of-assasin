import * as THREE from 'three';

// Item definitions. `illegal` items raise suspicion when seen in hand.
export const ITEMS = {
  coin: { name: 'Монета', icon: '●', throwable: true, stack: true, desc: 'Брось, чтобы отвлечь внимание звуком.' },
  pistol: { name: 'Пистолет «Сойка» с глушителем', icon: '▲', weapon: true, illegal: true, desc: 'Тихий выстрел. Попадание в голову смертельно.' },
  fiberwire: { name: 'Удавка', icon: '∞', lethalMelee: true, concealed: true, desc: 'Бесшумное устранение со спины [F].' },
  rat_poison: { name: 'Крысиный яд', icon: '☠', poison: 'lethal', desc: 'Смертельный яд. Подсыпь в еду или напиток.' },
  emetic: { name: 'Рвотное средство', icon: '✚', poison: 'emetic', desc: 'Жертва побежит в уборную — одна.' },
  wrench: { name: 'Гаечный ключ', icon: '⚒', melee: 'blunt', throwable: true, desc: 'Оглушить ударом или броском.' },
  kitchen_knife: { name: 'Кухонный нож', icon: '†', melee: 'sharp', lethalMelee: true, throwable: true, illegal: true, desc: 'Смертельное оружие ближнего боя и броска.' },
  crowbar: { name: 'Лом', icon: '⟋', melee: 'blunt', throwable: true, illegal: true, desc: 'Тяжёлый. Оглушает.' },
  wine_bottle: { name: 'Бутылка вина', icon: '⚱', melee: 'blunt', throwable: true, desc: 'Оглушает при броске.' },
  keycard_vault: { name: 'Ключ-карта хранилища', icon: '▭', key: true, desc: 'Открывает дверь хранилища.' },
  key_cellar: { name: 'Ключ от погреба', icon: '⚷', key: true, desc: 'Открывает заднюю дверь винного погреба.' },
};

// Small 3D meshes for items lying in the world or held in hand.
export function makeItemMesh(id, materials) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? materials.get(mat) : mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (id) {
    case 'coin':
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 12), 'gold');
      break;
    case 'pistol':
      add(new THREE.BoxGeometry(0.035, 0.03, 0.2), 'darkMetal', 0, 0.02, 0.05);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), 'black', 0, 0.02, 0.2, Math.PI / 2);
      add(new THREE.BoxGeometry(0.03, 0.1, 0.045), 'black', 0, -0.03, -0.02, -0.25);
      break;
    case 'fiberwire':
      add(new THREE.TorusGeometry(0.05, 0.006, 6, 16), 'steel');
      break;
    case 'rat_poison':
      add(new THREE.BoxGeometry(0.12, 0.16, 0.06), materials.color(0xc02020, 0.6));
      add(new THREE.BoxGeometry(0.121, 0.05, 0.061), 'paperWhite', 0, 0.02, 0);
      break;
    case 'emetic':
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10), materials.color(0xe8e8e0, 0.3));
      add(new THREE.CylinderGeometry(0.027, 0.027, 0.02, 10), materials.color(0x2a8a3a, 0.5), 0, 0.05, 0);
      break;
    case 'wrench':
      add(new THREE.BoxGeometry(0.03, 0.015, 0.26), 'steel', 0, 0, 0);
      add(new THREE.TorusGeometry(0.03, 0.01, 6, 10, Math.PI * 1.5), 'steel', 0, 0, 0.14, Math.PI / 2);
      break;
    case 'kitchen_knife':
      add(new THREE.BoxGeometry(0.008, 0.035, 0.18), 'chrome', 0, 0, 0.1);
      add(new THREE.BoxGeometry(0.02, 0.03, 0.1), 'black', 0, 0, -0.04);
      break;
    case 'crowbar':
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8), materials.color(0x8a1a1a, 0.5), 0, 0, 0, Math.PI / 2);
      break;
    case 'wine_bottle':
      add(new THREE.CylinderGeometry(0.035, 0.037, 0.22, 10), 'bottleGlass', 0, 0.11, 0);
      add(new THREE.CylinderGeometry(0.012, 0.03, 0.1, 10), 'bottleGlass', 0, 0.27, 0);
      break;
    case 'keycard_vault':
      add(new THREE.BoxGeometry(0.085, 0.004, 0.055), materials.color(0x2a6ac8, 0.4));
      break;
    case 'key_cellar':
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), 'brass', 0, 0, 0, Math.PI / 2);
      add(new THREE.TorusGeometry(0.015, 0.004, 6, 10), 'brass', 0, 0, -0.045, Math.PI / 2);
      break;
    case 'clothes':
      add(new THREE.BoxGeometry(0.45, 0.1, 0.35), 'fabricDark', 0, 0.05, 0);
      break;
    default:
      add(new THREE.BoxGeometry(0.1, 0.1, 0.1), 'white');
  }
  return g;
}

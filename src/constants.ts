export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
}

export const PRODUCT_LIST: Product[] = [
  // Condom
  { id: 'c1', name: 'Raja Super (60 dispenser)', price: 385, category: 'Condom' },
  { id: 'c2', name: 'Hero 3\'s (15 dispenser)', price: 185, category: 'Condom' },
  { id: 'c3', name: 'Panther Dotted (15 dispenser)', price: 196.2, category: 'Condom' },
  { id: 'c4', name: 'Panther Banana (15 dispenser)', price: 196.2, category: 'Condom' },
  { id: 'c5', name: 'Sensation Classic (15 dispenser)', price: 327, category: 'Condom' },
  { id: 'c6', name: 'Sensation SD (Super Dotted) (15 dispenser)', price: 327, category: 'Condom' },
  { id: 'c7', name: 'Sensation Coffee (15 dispenser)', price: 327, category: 'Condom' },
  { id: 'c8', name: 'U&ME Long Love (15 dispenser)', price: 570, category: 'Condom' },
  { id: 'c9', name: 'U&ME Anatomic (15 dispenser)', price: 570, category: 'Condom' },
  { id: 'c10', name: 'Xtreme 3 in 1 (15 dispenser)', price: 709.8, category: 'Condom' },
  { id: 'c11', name: 'Xtreme Ultra Thin (15 dispenser)', price: 709.8, category: 'Condom' },
  { id: 'c12', name: 'Amore 3\'s Gold (30 dispenser)', price: 370.56, category: 'Condom' },
  { id: 'c13', name: 'Amore 3\'s Black (30 dispenser)', price: 370.56, category: 'Condom' },

  //Saline
  { id: 's1', name: 'SMC ORSaline (20 dispenser)', price: 122, category: 'Saline' },
  { id: 's2', name: 'SMC Fruity Orange New (20 dispenser)', price: 102, category: 'Saline' },

  // Taste Me
  { id: 't1', name: 'Taste Me 16gm Orange (20 dispenser)', price: 122, category: 'Taste Me' },
  { id: 't2', name: 'Taste Me 16gm Mango (20 dispenser)', price: 188.16, category: 'Taste Me' },
  { id: 't3', name: 'Taste Me 200gm Orange (24 Box)', price: 89.3, category: 'Taste Me' },
  { id: 't4', name: 'Taste Me 200gm Mango (24 Box)', price: 89.3, category: 'Taste Me' },
  { id: 't5', name: 'Taste Me 500gm Orange (24 Box)', price: 236, category: 'Taste Me' },
  { id: 't6', name: 'Taste Me 500gm Mango (24 Box)', price: 236, category: 'Taste Me' },
  { id: 't7', name: 'Taste Me 1 KG Orange (6 Jar)', price: 439.07, category: 'Taste Me' },
  { id: 't8', name: 'Taste Me 1 KG Mango (6 Jar)', price: 439.07, category: 'Taste Me' },

  // BOLT
  { id: 'b1', name: 'BOLT 25 gm (12 dispenser)', price: 154.2, category: 'BOLT' },
  { id: 'b2', name: 'BOLT 200 gm (24 Packet)', price: 67.29, category: 'BOLT' },
  { id: 'b3', name: 'BOLT 400 gm (24 dispenser)', price: 116.82, category: 'BOLT' },

  // SMC Plus
  { id: 'p1', name: 'SMC Plus 200 ml Orange (40 pcs)', price: 28.3, category: 'SMC Plus' },
  { id: 'p2', name: 'SMC Plus 200 ml Lemon (40 pcs)', price: 28.3, category: 'SMC Plus' },
  { id: 'p3', name: 'SMC Plus 200 ml Apple (40 pcs)', price: 30.84, category: 'SMC Plus' },
  { id: 'p4', name: 'SMC Plus 200 ml Mixed fruits (40 pcs)', price: 30.84, category: 'SMC Plus' },
  { id: 'p5', name: 'SMC Plus 250 ml Orange (48 pcs)', price: 32.08, category: 'SMC Plus' },
  { id: 'p6', name: 'SMC Plus 250 ml Lemon (48 pcs)', price: 32.08, category: 'SMC Plus' },

  // Super Kid
  { id: 'sk1', name: 'Super Kid Dudh Malai (8 Jars)', price: 316.8, category: 'Super Kid' },
  { id: 'sk2', name: 'Super Kid Badam Chocolate (8 Jars)', price: 316.8, category: 'Super Kid' },
  { id: 'sk3', name: 'Super Kid Chocolate Bar (24 Box)', price: 190.08, category: 'Super Kid' },

  // Biscuit
  { id: 'bc1', name: 'SMC Butter Cookies 200gm (8 pack)', price: 51.45, category: 'Biscuit' },
  { id: 'bc2', name: 'SMC Lexus Vegetable Crackers 216gm (8 box)', price: 64.25, category: 'Biscuit' },

  // Napkin
  { id: 'n1', name: 'Joya 8\'s Belt (24 Pack)', price: 46.5, category: 'Napkin' },
  { id: 'n2', name: 'Joya 5\'s Belt (24 Pack)', price: 28.83, category: 'Napkin' },
  { id: 'n3', name: 'Joya 15\'s Belt (16 Pack)', price: 83, category: 'Napkin' },
  { id: 'n4', name: 'Joya 8\'s Wings (24 Pack)', price: 64, category: 'Napkin' },
  { id: 'n5', name: 'Joya 15\'s Wings (16 Pack)', price: 112, category: 'Napkin' },
  { id: 'n6', name: 'Joya 5\'s Wings (24 Pack)', price: 29.5, category: 'Napkin' },
  { id: 'n7', name: 'Joya Ultra Comfort (24 Pack)', price: 72.54, category: 'Napkin' },
  { id: 'n8', name: 'Joya Extra Heavy Flow (24 Pack)', price: 81.84, category: 'Napkin' },
  { id: 'n9', name: 'Joya All Night (24 Pack)', price: 91.14, category: 'Napkin' },
  { id: 'n10', name: 'Joya Extra Heavy Flow 16s (16 pack)', price: 121, category: 'Napkin' },

  // Smile
  { id: 'sm1', name: 'Smile Pants Mini Series S 5\'s (24 Packets)', price: 89.3, category: 'Smile' },
  { id: 'sm2', name: 'Smile Pants Mini Series M 5\'s (24 Packets)', price: 89.3, category: 'Smile' },
  { id: 'sm3', name: 'Smile Pants Mini Series L 4\'s (24 Packets)', price: 89.3, category: 'Smile' },
  { id: 'sm4', name: 'Smile Pants Mini Series XL 4\'s (24 Packets)', price: 89.3, category: 'Smile' },
  { id: 'sm5', name: 'Smile Pants Mini Series XXL 4\'s (24 Packets)', price: 89.3, category: 'Smile' },
  { id: 'sm6', name: 'Smile Standard Series S 42\'s (4 Packets)', price: 567.5, category: 'Smile' },
  { id: 'sm7', name: 'Smile Standard Series M 40\'s (4 Packets)', price: 567.5, category: 'Smile' },
  { id: 'sm8', name: 'Smile Standard Series L 34\'s (4 Packets)', price: 567.5, category: 'Smile' },
  { id: 'sm9', name: 'Smile Standard Series XL 32\'s (4 Packets)', price: 567.5, category: 'Smile' },
  { id: 'sm10', name: 'Smile Standard Series XXL 24\'s (4 Packets)', price: 567.5, category: 'Smile' },
  { id: 'sm11', name: 'Smile Pant S 60 (4 Packets)', price: 818, category: 'Smile' },
  { id: 'sm12', name: 'Smile Pant L 48 (4 Packets)', price: 818, category: 'Smile' },
  { id: 'sm13', name: 'Smile Pant M 50 (4 Packets)', price: 818, category: 'Smile' },
];

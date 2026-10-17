const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../src/models/product.model');
const Inventory = require('../src/models/inventory.model');
const Category = require('../src/models/category.model');
const SubCategory = require('../src/models/subcategory.model');
const s3Service = require('../src/services/s3.service');

// Curated Unsplash photo pools for high quality real e-commerce imagery
const PHOTO_POOLS = {
  Sarees: [
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1610030469668-935cb172f3a6?w=650&auto=format&fit=crop&q=80',
  ],
  Kurtis: [
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=650&auto=format&fit=crop&q=80',
  ],
  Leggings: [
    'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=650&auto=format&fit=crop&q=80',
  ],
  Nightwear: [
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=650&auto=format&fit=crop&q=80',
  ],
  Dupattas: [
    'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=650&auto=format&fit=crop&q=80',
  ],
  'Storage boxes': [
    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=650&auto=format&fit=crop&q=80',
  ],
  Choppers: [
    'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585515320310-259814833e62?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=650&auto=format&fit=crop&q=80',
  ],
  Organizers: [
    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=650&auto=format&fit=crop&q=80',
  ],
  Cookware: [
    'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585515320310-259814833e62?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=650&auto=format&fit=crop&q=80',
  ],
  Earrings: [
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1611591475878-a28a38f3cb29?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=650&auto=format&fit=crop&q=80',
  ],
  Chains: [
    'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1611591475878-a28a38f3cb29?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=650&auto=format&fit=crop&q=80',
  ],
  Bangles: [
    'https://images.unsplash.com/photo-1611591475878-a28a38f3cb29?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=650&auto=format&fit=crop&q=80',
  ],
  'Necklace sets': [
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1611591475878-a28a38f3cb29?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=650&auto=format&fit=crop&q=80',
  ],
  'Hair accessories': [
    'https://images.unsplash.com/photo-1584297091622-af8e5fd75986?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=650&auto=format&fit=crop&q=80',
  ],
  Skincare: [
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608248597359-573e35a113ec?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=650&auto=format&fit=crop&q=80',
  ],
  'Herbal products': [
    'https://images.unsplash.com/photo-1608248597359-573e35a113ec?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=650&auto=format&fit=crop&q=80',
  ],
  Cases: [
    'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=650&auto=format&fit=crop&q=80',
  ],
  Chargers: [
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1616440347437-b1c73416efc2?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=650&auto=format&fit=crop&q=80',
  ],
  Cables: [
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1616440347437-b1c73416efc2?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=650&auto=format&fit=crop&q=80',
  ],
  Stands: [
    'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1510519138161-58474dfab9c8?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=650&auto=format&fit=crop&q=80',
  ],
  Earbuds: [
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=650&auto=format&fit=crop&q=80',
  ],
  'Sungudi sarees': [
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1610030469668-935cb172f3a6?w=650&auto=format&fit=crop&q=80',
  ],
  'Brass items': [
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=650&auto=format&fit=crop&q=80',
  ],
  'Tanjore crafts': [
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=650&auto=format&fit=crop&q=80',
  ],
  Murukku: [
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567337710282-00832b415979?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=650&auto=format&fit=crop&q=80',
  ],
  Mixture: [
    'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567337710282-00832b415979?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=650&auto=format&fit=crop&q=80',
  ],
  Pickles: [
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=650&auto=format&fit=crop&q=80',
  ],
  Podi: [
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567337710282-00832b415979?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=650&auto=format&fit=crop&q=80',
  ],
  Sweets: [
    'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567337710282-00832b415979?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=650&auto=format&fit=crop&q=80',
  ],
  'Wall décor': [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=650&auto=format&fit=crop&q=80',
  ],
  'Artificial plants': [
    'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1545241047-6083a3684587?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=650&auto=format&fit=crop&q=80',
  ],
  Lamps: [
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?w=650&auto=format&fit=crop&q=80',
  ],
  Toys: [
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=650&auto=format&fit=crop&q=80',
  ],
  Stationery: [
    'https://images.unsplash.com/photo-1585336261026-41ffb307ec14?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1456735190829-80ab072ac175?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=650&auto=format&fit=crop&q=80',
  ],
  'School accessories': [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1577741314755-048d8525d31e?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1588072432836-e10032774350?w=650&auto=format&fit=crop&q=80',
  ],
  'Resistance bands': [
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=650&auto=format&fit=crop&q=80',
  ],
  'Yoga accessories': [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=650&auto=format&fit=crop&q=80',
  ],
  Bottles: [
    'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=650&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=650&auto=format&fit=crop&q=80',
  ],
};

// Map of 5 real product definitions for EACH of the 39 subcategories
const PRODUCTS_CATALOG = {
  Sarees: [
    {
      name: 'Kanjeevaram Pure Soft Silk Bridal Saree with Rich Zari Pallu',
      price: 4999,
      discountPrice: 2899,
      stock: 25,
      characteristics: [{ key: 'Fabric', value: 'Pure Soft Silk' }, { key: 'Weave', value: 'Kanjeevaram Jacquard Zari' }, { key: 'Occasion', value: 'Bridal / Festive' }],
      tags: ['saree', 'silk', 'kanjeevaram', 'wedding', 'festive']
    },
    {
      name: 'Banarasi Brocade Floral Butta Woven Wedding Saree',
      price: 3899,
      discountPrice: 2199,
      stock: 20,
      characteristics: [{ key: 'Fabric', value: 'Banarasi Art Silk' }, { key: 'Border', value: 'Heavy Golden Zari' }, { key: 'Length', value: '6.3 Meters with Blouse' }],
      tags: ['banarasi', 'saree', 'zari', 'traditional']
    },
    {
      name: 'Chanderi Pure Cotton Hand-Block Floral Print Saree',
      price: 1899,
      discountPrice: 1199,
      stock: 35,
      characteristics: [{ key: 'Fabric', value: 'Chanderi Cotton' }, { key: 'Print', value: 'Hand Block Ajrakh' }, { key: 'Blouse', value: 'Running Unstitched' }],
      tags: ['cotton', 'chanderi', 'daily wear', 'office wear']
    },
    {
      name: 'Handloom Madurai Sungudi Pure Cotton Traditional Saree',
      price: 1499,
      discountPrice: 899,
      stock: 40,
      characteristics: [{ key: 'Fabric', value: '100% Combed Cotton' }, { key: 'Dye', value: 'Traditional Tie-Dye' }, { key: 'Origin', value: 'Madurai, Tamil Nadu' }],
      tags: ['sungudi', 'madurai', 'handloom', 'cotton']
    },
    {
      name: 'Organza Embroidered Designer Partywear Pastel Saree',
      price: 2999,
      discountPrice: 1699,
      stock: 18,
      characteristics: [{ key: 'Fabric', value: 'Tissue Organza' }, { key: 'Work', value: 'Cutwork Resham Embroidery' }, { key: 'Occasion', value: 'Party / Reception' }],
      tags: ['organza', 'partywear', 'designer', 'embroidered']
    }
  ],
  Kurtis: [
    {
      name: 'Anarkali Flared Embroidered Rayon Festive Kurti',
      price: 1699,
      discountPrice: 999,
      stock: 30,
      characteristics: [{ key: 'Fabric', value: 'Heavy 14kg Rayon' }, { key: 'Sleeve', value: '3/4 Sleeve' }, { key: 'Neckline', value: 'Round Neck with Gota' }],
      tags: ['kurti', 'anarkali', 'flared', 'rayon', 'ethnic']
    },
    {
      name: 'Straight Cut Pure Cotton Daily Wear Office Kurti',
      price: 1099,
      discountPrice: 599,
      stock: 45,
      characteristics: [{ key: 'Fabric', value: '100% Breathable Cotton' }, { key: 'Fit', value: 'Regular Straight Fit' }, { key: 'Pattern', value: 'Ikat Geometric Print' }],
      tags: ['kurti', 'cotton', 'daily wear', 'office wear']
    },
    {
      name: 'Chikankari Hand Embroidered Georgette Long Kurti with Slip',
      price: 2499,
      discountPrice: 1499,
      stock: 22,
      characteristics: [{ key: 'Fabric', value: 'Pure Georgette' }, { key: 'Work', value: 'Lucknowi Chikankari' }, { key: 'Lining', value: 'Soft Cotton Slip Included' }],
      tags: ['chikankari', 'lucknowi', 'georgette', 'designer']
    },
    {
      name: 'A-Line Floral Printed Festive Kurti with Pant Set',
      price: 2199,
      discountPrice: 1299,
      stock: 28,
      characteristics: [{ key: 'Set Includes', value: 'Kurti + Tapered Pants' }, { key: 'Fabric', value: 'Cotton Silk Blend' }, { key: 'Pockets', value: '1 Side Pocket in Pant' }],
      tags: ['kurti set', 'floral', 'pant set', 'festive']
    },
    {
      name: 'Solid Rayon Slub Front Slit Casual Kurti',
      price: 999,
      discountPrice: 549,
      stock: 50,
      characteristics: [{ key: 'Fabric', value: 'Rayon Slub' }, { key: 'Style', value: 'Front Slit Buttoned Placket' }, { key: 'Length', value: 'Calf Length (44 inch)' }],
      tags: ['casual', 'rayon', 'slit kurti', 'everyday']
    }
  ],
  Leggings: [
    {
      name: '4-Way Stretch Ankle Length Bio-Washed Cotton Leggings',
      price: 699,
      discountPrice: 399,
      stock: 60,
      characteristics: [{ key: 'Material', value: '95% Combed Cotton, 5% Spandex' }, { key: 'GSM', value: '210 GSM Thick Fabric' }, { key: 'Waistband', value: 'Soft Elastic' }],
      tags: ['leggings', 'ankle length', 'cotton', 'stretch']
    },
    {
      name: 'Churidar Stretchable Cotton Rich Solid Leggings with Gatherings',
      price: 749,
      discountPrice: 429,
      stock: 55,
      characteristics: [{ key: 'Style', value: 'Churidar Long Gathers' }, { key: 'Fabric', value: 'Bio-Washed Cotton Lycra' }, { key: 'Color Fastness', value: '100% Guaranteed' }],
      tags: ['churidar', 'leggings', 'ethnic', 'bottomwear']
    },
    {
      name: 'Shimmer Festive Partywear Metallic Stretch Leggings',
      price: 899,
      discountPrice: 499,
      stock: 35,
      characteristics: [{ key: 'Finish', value: 'Metallic Gold Shimmer' }, { key: 'Occasion', value: 'Weddings / Sangeet' }, { key: 'Elasticity', value: 'High 4-Way Stretch' }],
      tags: ['shimmer', 'partywear', 'gold leggings', 'glitter']
    },
    {
      name: 'High-Waist Tummy Control Seamless Shaping Leggings',
      price: 1099,
      discountPrice: 649,
      stock: 40,
      characteristics: [{ key: 'Compression', value: 'Medium Tummy Flattener' }, { key: 'Waistband', value: '4-Inch Wide Band' }, { key: 'Fabric', value: 'Microfiber Lycra' }],
      tags: ['shaping', 'tummy control', 'high waist', 'active']
    },
    {
      name: 'Ultra-Soft Modal Viscose Breathable Everyday Leggings',
      price: 799,
      discountPrice: 449,
      stock: 48,
      characteristics: [{ key: 'Material', value: 'Lenzing Modal' }, { key: 'Feel', value: 'Feather Soft & Cool' }, { key: 'Durability', value: 'Anti-Pilling Finish' }],
      tags: ['viscose', 'modal', 'soft', 'daily wear']
    }
  ],
  Nightwear: [
    {
      name: 'Pure Cotton Printed Top and Capri Pajama Nightsuit Set',
      price: 1299,
      discountPrice: 749,
      stock: 35,
      characteristics: [{ key: 'Fabric', value: '100% Breathable Hosiery Cotton' }, { key: 'Fit', value: 'Relaxed Comfort Fit' }, { key: 'Care', value: 'Machine Washable' }],
      tags: ['nightwear', 'pajama set', 'cotton', 'sleepwear']
    },
    {
      name: 'Satin Silk Lace Trim Robe and Slip Nighty 2-Piece Set',
      price: 1999,
      discountPrice: 1199,
      stock: 25,
      characteristics: [{ key: 'Material', value: 'High Gloss Satin Silk' }, { key: 'Trim', value: 'Scalloped French Lace' }, { key: 'Includes', value: 'Nighty + Robe + Tie Belt' }],
      tags: ['satin', 'nighty', 'robe set', 'honeymoon']
    },
    {
      name: 'Soft Rayon Button-Down Lounge Sleepwear Two-Piece Set',
      price: 1499,
      discountPrice: 849,
      stock: 30,
      characteristics: [{ key: 'Pattern', value: 'Notch Collar Classic Stripes' }, { key: 'Fabric', value: 'Lightweight Rayon Slub' }, { key: 'Waist', value: 'Elasticated Drawstring' }],
      tags: ['lounge set', 'rayon', 'striped', 'comfort']
    },
    {
      name: 'Front Open Buttoned Pure Cotton Feeding-Friendly Nighty',
      price: 999,
      discountPrice: 599,
      stock: 45,
      characteristics: [{ key: 'Design', value: 'Maternity & Nursing Friendly' }, { key: 'Pockets', value: '1 Deep Side Pocket' }, { key: 'Fabric', value: 'Cotton Cambric' }],
      tags: ['maternity', 'feeding nighty', 'nursing', 'cotton']
    },
    {
      name: 'Modal Jersey Ribbed Sleeveless Night Dress Maxi Gown',
      price: 1199,
      discountPrice: 699,
      stock: 32,
      characteristics: [{ key: 'Material', value: 'Ribbed Modal Stretch' }, { key: 'Length', value: 'Full Ankle Length Gown' }, { key: 'Texture', value: 'Buttery Smooth' }],
      tags: ['maxi gown', 'night dress', 'modal', 'sleep']
    }
  ],
  Dupattas: [
    {
      name: 'Banarasi Silk Golden Zari Brocade Heavy Royal Dupatta',
      price: 1899,
      discountPrice: 1099,
      stock: 28,
      characteristics: [{ key: 'Fabric', value: 'Art Silk Banarasi' }, { key: 'Length', value: '2.5 Meters Full Width' }, { key: 'Tassels', value: 'Handmade Latkan Fringe' }],
      tags: ['dupatta', 'banarasi', 'zari', 'bridal']
    },
    {
      name: 'Phulkari Hand Embroidered Traditional Chanderi Dupatta',
      price: 1599,
      discountPrice: 899,
      stock: 30,
      characteristics: [{ key: 'Embroidery', value: 'Multicolor Resham Thread' }, { key: 'Border', value: 'Golden Gota Patti' }, { key: 'Base', value: 'Chanderi Poly Silk' }],
      tags: ['phulkari', 'embroidery', 'traditional', 'colorful']
    },
    {
      name: 'Jaipuri Bandhani Tie-Dye Pure Cotton Colorful Dupatta',
      price: 899,
      discountPrice: 499,
      stock: 45,
      characteristics: [{ key: 'Art Form', value: 'Authentic Bandhej Dot Dye' }, { key: 'Fabric', value: 'Mulmul Cotton' }, { key: 'Pom Poms', value: 'Edge Pom-Pom Lace' }],
      tags: ['bandhani', 'cotton', 'jaipuri', 'tie dye']
    },
    {
      name: 'Net Embroidered Scalloped Border Partywear Dupatta',
      price: 1299,
      discountPrice: 749,
      stock: 32,
      characteristics: [{ key: 'Fabric', value: 'Soft Butterfly Net' }, { key: 'Work', value: 'Zari and Sequin Floral Jaal' }, { key: 'Edge', value: 'Cutwork Scallop' }],
      tags: ['net dupatta', 'sequin', 'partywear', 'wedding']
    },
    {
      name: 'Solid Lightweight Chiffon Daily Wear Flowing Dupatta',
      price: 599,
      discountPrice: 299,
      stock: 60,
      characteristics: [{ key: 'Fabric', value: 'Featherlight Chiffon' }, { key: 'Finish', value: 'Interlock Stitched Hem' }, { key: 'Colors', value: 'High Vibrant Dye' }],
      tags: ['chiffon', 'daily dupatta', 'solid', 'lightweight']
    }
  ],
  'Storage boxes': [
    {
      name: 'Modular Airtight Kitchen Grain & Cereal Container Set (6 Pcs)',
      price: 1599,
      discountPrice: 999,
      stock: 35,
      characteristics: [{ key: 'Capacity', value: '1.2L x 6 Containers' }, { key: 'Material', value: 'BPA-Free Food Grade Plastic' }, { key: 'Lock', value: '4-Sided Silicone Seal' }],
      tags: ['storage', 'kitchen', 'airtight', 'containers']
    },
    {
      name: 'Underbed Moisture-Proof Fabric Clothes Storage Bag (75L)',
      price: 899,
      discountPrice: 499,
      stock: 45,
      characteristics: [{ key: 'Material', value: '3-Layer Non-Woven Fabric' }, { key: 'Features', value: 'Clear PVC Window + Steel Zippers' }, { key: 'Capacity', value: '75 Liters' }],
      tags: ['wardrobe', 'storage box', 'underbed', 'clothes']
    },
    {
      name: 'Clear Stackable Fridge Organizer Bin with Ergonomic Handle',
      price: 699,
      discountPrice: 399,
      stock: 50,
      characteristics: [{ key: 'Material', value: 'Shatterproof PET Plastic' }, { key: 'Use', value: 'Fruits, Veggies, Beverage Cans' }, { key: 'Stackable', value: 'Yes with Anti-Slip Base' }],
      tags: ['fridge organizer', 'clear bin', 'kitchen']
    },
    {
      name: 'Foldable Wardrobe Drawer Divider Set for Innerwear & Socks (4 Pcs)',
      price: 799,
      discountPrice: 449,
      stock: 40,
      characteristics: [{ key: 'Cells', value: '6, 7, 8, 24 Compartments' }, { key: 'Material', value: 'Mould-Proof Non-Woven' }, { key: 'Foldable', value: 'Zipper Base Flat Pack' }],
      tags: ['drawer divider', 'wardrobe organizer', 'closet']
    },
    {
      name: 'Multipurpose Emergency Medicine & First Aid Storage Box with Tray',
      price: 999,
      discountPrice: 599,
      stock: 38,
      characteristics: [{ key: 'Compartments', value: 'Removable 2-Tier Tray' }, { key: 'Handle', value: 'Fold-Flat Carry Handle' }, { key: 'Lock', value: 'Child-Safe Snap Lock' }],
      tags: ['medicine box', 'first aid', 'portable storage']
    }
  ],
  Choppers: [
    {
      name: 'Quick Pull-String Manual Vegetable & Fruit Chopper (900ml)',
      price: 799,
      discountPrice: 399,
      stock: 55,
      characteristics: [{ key: 'Blades', value: '3 Curved Stainless Steel 420' }, { key: 'Capacity', value: '900ml Large Bowl' }, { key: 'Base', value: 'Anti-Skid Silicone Ring' }],
      tags: ['chopper', 'manual chopper', 'vegetable cutter', 'kitchen tool']
    },
    {
      name: 'Electric Rechargeable Garlic & Onion Mini Food Processor (250ml)',
      price: 1299,
      discountPrice: 699,
      stock: 40,
      characteristics: [{ key: 'Motor', value: '30W High Torque Motor' }, { key: 'Charging', value: 'USB Type-C Fast Charge' }, { key: 'Blades', value: 'Triple 304 Stainless Steel' }],
      tags: ['electric chopper', 'rechargeable', 'garlic chopper', 'mini']
    },
    {
      name: 'Multi-Blade Mandoline Slicer with Safety Hand Guard (6-in-1)',
      price: 1199,
      discountPrice: 649,
      stock: 35,
      characteristics: [{ key: 'Cuts', value: 'Julienne, Grate, Wavy, Slice' }, { key: 'Safety', value: 'Food Pusher Guard Included' }, { key: 'Base', value: 'Catch Basin Drawer' }],
      tags: ['mandoline', 'slicer', 'grater', 'julienne']
    },
    {
      name: 'Stainless Steel Heavy-Duty French Fry & Potato Wedge Cutter',
      price: 1499,
      discountPrice: 899,
      stock: 28,
      characteristics: [{ key: 'Body', value: 'Heavy Duty Stainless Steel' }, { key: 'Blades', value: '36-Hole & 64-Hole Grid Dies' }, { key: 'Mount', value: 'Suction Lock Base' }],
      tags: ['french fry cutter', 'potato slicer', 'heavy duty']
    },
    {
      name: 'Press-to-Chop Compact Herb, Garlic & Nut Mincer',
      price: 599,
      discountPrice: 329,
      stock: 45,
      characteristics: [{ key: 'Operation', value: 'Spring Loaded Push Plunger' }, { key: 'Blades', value: 'Zig-Zag Self Rotating Blade' }, { key: 'Cleaning', value: 'Detachable Base' }],
      tags: ['herb chopper', 'nut mincer', 'push chopper']
    }
  ],
  Cookware: [
    {
      name: 'Triply Stainless Steel Induction Fry Pan with Honeycomb Finish (24cm)',
      price: 2499,
      discountPrice: 1499,
      stock: 30,
      characteristics: [{ key: 'Layering', value: 'SS304 + Aluminum Core + SS430' }, { key: 'Base', value: 'Induction & Gas Compatible' }, { key: 'Coating', value: 'Laser Hex Honeycomb Scratch-Proof' }],
      tags: ['cookware', 'triply', 'fry pan', 'induction']
    },
    {
      name: 'Pre-Seasoned Cast Iron Traditional Dosa Tawa Heavy Base (28cm)',
      price: 1899,
      discountPrice: 1199,
      stock: 35,
      characteristics: [{ key: 'Material', value: '100% Virgin Cast Iron' }, { key: 'Seasoning', value: 'Pre-Seasoned with Organic Til Oil' }, { key: 'Weight', value: '2.4 kg Heavy Base' }],
      tags: ['cast iron', 'dosa tawa', 'pre seasoned', 'traditional']
    },
    {
      name: 'Granite Stone Non-Stick Deep Kadai with Toughened Glass Lid (3.2L)',
      price: 2199,
      discountPrice: 1299,
      stock: 28,
      characteristics: [{ key: 'Coating', value: '5-Layer German Greblon Granite' }, { key: 'PFOA Free', value: '100% Non-Toxic' }, { key: 'Handles', value: 'Stay-Cool Soft Grip Bakelite' }],
      tags: ['kadai', 'granite cookware', 'non stick', 'deep fry']
    },
    {
      name: 'Hard Anodized Aluminum Outer Lid Pressure Cooker (5 Liters)',
      price: 2799,
      discountPrice: 1799,
      stock: 22,
      characteristics: [{ key: 'Capacity', value: '5 Liters' }, { key: 'Material', value: 'Hard Anodized Scratch Resistant' }, { key: 'Safety', value: 'Metallic Safety Plug + Gasket Release' }],
      tags: ['pressure cooker', 'anodized', '5 liter', 'kitchen']
    },
    {
      name: 'Cast Iron Appe & Kuzhi Paniyaram Pan 7 Cavities with Dual Handles',
      price: 1499,
      discountPrice: 899,
      stock: 40,
      characteristics: [{ key: 'Cavities', value: '7 Deep Cavity Pockets' }, { key: 'Material', value: 'Pure Cast Iron' }, { key: 'Enriches', value: 'Infuses Natural Iron in Food' }],
      tags: ['paniyaram pan', 'appe pan', 'cast iron', 'south indian']
    }
  ],
  Earrings: [
    {
      name: 'South Indian Antique Matte Gold Kemp Stone Jhumka Earrings',
      price: 1299,
      discountPrice: 699,
      stock: 45,
      characteristics: [{ key: 'Plating', value: 'Antique 1 Gram Gold Polish' }, { key: 'Stones', value: 'Ruby Pink Kemp & Green Emeralds' }, { key: 'Closure', value: 'Push Back Post' }],
      tags: ['earrings', 'jhumkas', 'kemp', 'temple jewellery']
    },
    {
      name: 'Sparkling Solitaire American Diamond Drop Chandbali Earrings',
      price: 1699,
      discountPrice: 899,
      stock: 35,
      characteristics: [{ key: 'Stone Type', value: 'AAA Grade Cubic Zirconia' }, { key: 'Metal', value: 'Brass Alloy with Rhodium Finish' }, { key: 'Weight', value: 'Lightweight 18g' }],
      tags: ['chandbali', 'american diamond', 'partywear earrings']
    },
    {
      name: 'Meenakari Kundan Studded Traditional Peacock Dangler Earrings',
      price: 1199,
      discountPrice: 599,
      stock: 40,
      characteristics: [{ key: 'Art Form', value: 'Hand Meenakari Enameling' }, { key: 'Stones', value: 'Faceted Glass Kundan' }, { key: 'Style', value: 'Peacock Motif Dangler' }],
      tags: ['meenakari', 'kundan', 'peacock', 'festive']
    },
    {
      name: 'Oxidized German Silver Bohemian Tribal Mirror Jhumka Earrings',
      price: 799,
      discountPrice: 399,
      stock: 50,
      characteristics: [{ key: 'Metal', value: 'Oxidized Silver Finish Alloy' }, { key: 'Detailing', value: 'Real Glass Mirror Inlay' }, { key: 'Ghungroo', value: 'Tinkling Bell Drops' }],
      tags: ['oxidized', 'boho', 'tribal', 'mirror work', 'silver']
    },
    {
      name: 'Natural Freshwater Pearl Drop Minimalist Daily Wear Huggie Hoops',
      price: 899,
      discountPrice: 449,
      stock: 48,
      characteristics: [{ key: 'Pearl', value: 'Cultured Teardrop Pearl' }, { key: 'Plating', value: '18K Yellow Gold Dip' }, { key: 'Hypoallergenic', value: 'Lead & Nickel Free' }],
      tags: ['pearl earrings', 'hoop earrings', 'minimalist', 'daily']
    }
  ],
  Chains: [
    {
      name: '1 Gram Micro Gold Plated Figaro Chain for Daily Wear (24 Inch)',
      price: 1199,
      discountPrice: 599,
      stock: 40,
      characteristics: [{ key: 'Length', value: '24 Inches' }, { key: 'Plating', value: '24K Micro Gold Dip' }, { key: 'Pattern', value: 'Classic 3+1 Figaro Link' }],
      tags: ['gold chain', 'figaro', 'daily chain', '1 gram gold']
    },
    {
      name: 'Traditional South Indian Mugappu Pattern Temple Design Gold Chain',
      price: 1599,
      discountPrice: 849,
      stock: 30,
      characteristics: [{ key: 'Side Ornament', value: 'Ruby Kemp Goddess Mugappu' }, { key: 'Thickness', value: '3mm Rope Link' }, { key: 'Warranty', value: '6 Months Anti-Tarnish' }],
      tags: ['mugappu chain', 'temple chain', 'south indian']
    },
    {
      name: 'Sleek Rhodium Silver Snake Chain with Austrian Crystal Pendant',
      price: 999,
      discountPrice: 499,
      stock: 50,
      characteristics: [{ key: 'Pendant', value: 'Solitaire Cushion Crystal' }, { key: 'Chain Type', value: 'Italian Flexible Snake Chain' }, { key: 'Finish', value: 'Platinum Rhodium' }],
      tags: ['crystal pendant', 'silver chain', 'western jewellery']
    },
    {
      name: 'Textured Gold Finish Traditional Thali Kodi Heavy Chain (30 Inch)',
      price: 1999,
      discountPrice: 1099,
      stock: 25,
      characteristics: [{ key: 'Design', value: 'Traditional Spiral Kodi' }, { key: 'Length', value: '30 Inches Waist Drop' }, { key: 'Weight', value: 'Heavy Durable 45g' }],
      tags: ['thali kodi', 'traditional chain', 'wedding chain']
    },
    {
      name: 'Minimalist Rose Gold Link Chain with Interlocking Infinity Charm',
      price: 899,
      discountPrice: 449,
      stock: 45,
      characteristics: [{ key: 'Charm', value: 'CZ Studded Infinity Symbol' }, { key: 'Plating', value: 'Rose Gold Electroplating' }, { key: 'Clasp', value: 'Sturdy Lobster Clasp' }],
      tags: ['rose gold', 'infinity', 'charm chain', 'gift for her']
    }
  ],
  Bangles: [
    {
      name: 'South Indian Antique Matte Finish Temple Bangles Set (Pack of 2)',
      price: 1499,
      discountPrice: 799,
      stock: 35,
      characteristics: [{ key: 'Sizes Available', value: '2.4, 2.6, 2.8' }, { key: 'Plating', value: 'Antique Reddish Matte Gold' }, { key: 'Motif', value: 'Lakshmi & Peacock Embossed' }],
      tags: ['bangles', 'temple jewellery', 'antique bangles']
    },
    {
      name: 'Velvet Glass Bangles Assorted Festive Color Box Set (Pack of 24)',
      price: 699,
      discountPrice: 349,
      stock: 60,
      characteristics: [{ key: 'Count', value: '24 Pieces Set' }, { key: 'Finish', value: 'Matte Soft Velvet Touch' }, { key: 'Material', value: 'Superior Firozabad Glass' }],
      tags: ['glass bangles', 'velvet bangles', 'festive set']
    },
    {
      name: 'American Diamond Kada Openable Bracelet Bangle for Women',
      price: 1399,
      discountPrice: 749,
      stock: 30,
      characteristics: [{ key: 'Lock', value: 'Hinged Screw Openable Kada' }, { key: 'Stones', value: 'Tapered Baguette CZ Diamonds' }, { key: 'Finish', value: 'White Rhodium' }],
      tags: ['kada', 'bracelet', 'american diamond', 'openable']
    },
    {
      name: 'Gold Polished Handcrafted Brass Daily Wear Bangles (Set of 4)',
      price: 999,
      discountPrice: 499,
      stock: 50,
      characteristics: [{ key: 'Quantity', value: '4 Slim Bangles' }, { key: 'Pattern', value: 'Diamond Cut Faceted Shine' }, { key: 'Skin Safe', value: 'Non-Allergic Brass' }],
      tags: ['daily bangles', 'gold polish', 'brass bangles']
    },
    {
      name: 'Silk Thread Handcrafted Bridal Bangle Set with Zari & Stone Balls',
      price: 1199,
      discountPrice: 649,
      stock: 28,
      characteristics: [{ key: 'Craft', value: 'Hand-Wound Pure Silk Thread' }, { key: 'Embellishment', value: 'Gold Ball Chains & Kundan' }, { key: 'Colors', value: 'Maroon & Mustard Yellow' }],
      tags: ['silk thread', 'bridal bangles', 'handcrafted']
    }
  ],
  'Necklace sets': [
    {
      name: 'Royal Kundan & Green Emerald Beads Choker Necklace Set with Maangtikka',
      price: 3499,
      discountPrice: 1899,
      stock: 20,
      characteristics: [{ key: 'Includes', value: 'Choker + Earrings + Maangtikka' }, { key: 'Backing', value: 'Adjustable Dori Thread' }, { key: 'Beads', value: 'Mint Green Onyx Drops' }],
      tags: ['necklace set', 'kundan choker', 'bridal jewellery', 'maangtikka']
    },
    {
      name: 'Antique Temple Nakshi Goddess Lakshmi Choker Set with Pearls',
      price: 2999,
      discountPrice: 1599,
      stock: 25,
      characteristics: [{ key: 'Idol', value: 'Goddess Lakshmi Centered' }, { key: 'Stones', value: 'Kemp Pink & Emerald Green' }, { key: 'Drops', value: 'Cluster Seed Pearls' }],
      tags: ['temple necklace', 'lakshmi choker', 'antique jewellery']
    },
    {
      name: 'Sparkling Solitaire CZ American Diamond Bridal Necklace Set',
      price: 3999,
      discountPrice: 2199,
      stock: 18,
      characteristics: [{ key: 'Plating', value: 'Platinum Silver Polish' }, { key: 'Stone Cut', value: 'Brilliant Round & Pear Cut CZ' }, { key: 'Weight', value: 'Comfort Fit Lightweight' }],
      tags: ['american diamond', 'bridal necklace', 'western partywear']
    },
    {
      name: 'Multilayer Pearl Mala Haar with Ruby Kemp Pendant Set',
      price: 1999,
      discountPrice: 999,
      stock: 35,
      characteristics: [{ key: 'Layers', value: '5 Layers Freshwater Finish Pearls' }, { key: 'Pendant', value: 'Filigree Kemp Brooch' }, { key: 'Earrings', value: 'Matching Stud Drops' }],
      tags: ['pearl haar', 'multilayer mala', 'rani haar']
    },
    {
      name: 'Floral Meenakari Enamel Bridal Long Rani Haar Set',
      price: 2799,
      discountPrice: 1499,
      stock: 22,
      characteristics: [{ key: 'Art', value: 'Jaipuri Hand Enamel Meena' }, { key: 'Length', value: '26 Inch Long Rani Haar' }, { key: 'Earrings', value: 'Matching Large Chandbalis' }],
      tags: ['rani haar', 'meenakari', 'jaipuri', 'bridal']
    }
  ],
  'Hair accessories': [
    {
      name: 'Traditional South Indian Bridal Floral Hair Choti Clip Jada Billa',
      price: 1199,
      discountPrice: 599,
      stock: 30,
      characteristics: [{ key: 'Design', value: 'Temple Kemp Sun & Moon Choti' }, { key: 'Count', value: '9 Linked Discs for Braid' }, { key: 'Finish', value: 'Antique Gold Polish' }],
      tags: ['jada billa', 'hair choti', 'bridal hair', 'temple jewellery']
    },
    {
      name: 'Premium Velvet Pearl Embellished Padded Headband Hairband',
      price: 599,
      discountPrice: 299,
      stock: 50,
      characteristics: [{ key: 'Material', value: 'Plush Velvet with Glass Pearls' }, { key: 'Base', value: 'Flexible Pain-Free Inner Band' }, { key: 'Occasion', value: 'Party / Casual Wear' }],
      tags: ['headband', 'pearl hairband', 'velvet', 'korean style']
    },
    {
      name: 'Large Pastel Matte Acrylic Claw Clips Strong Hold (Pack of 4)',
      price: 499,
      discountPrice: 249,
      stock: 65,
      characteristics: [{ key: 'Size', value: '4.3 Inch Jumbo Claw' }, { key: 'Grip', value: 'Double Interlocking Teeth Spring' }, { key: 'Colors', value: 'Sage, Mauve, Cream, Slate' }],
      tags: ['hair claw', 'claw clip', 'matte clip', 'hair accessories']
    },
    {
      name: '100% Pure Mulberry Silk Hair Scrunchies Anti-Frizz (Pack of 3)',
      price: 799,
      discountPrice: 399,
      stock: 45,
      characteristics: [{ key: 'Silk Grade', value: '22 Momme 6A Grade Pure Silk' }, { key: 'Benefits', value: 'Zero Hair Breakage & Creasing' }, { key: 'Elastic', value: 'Durable High Stretch Core' }],
      tags: ['silk scrunchies', 'mulberry silk', 'anti frizz', 'hair care']
    },
    {
      name: 'Artificial South Indian Jasmine Flower Gajra Hair Bun Band (Set of 2)',
      price: 399,
      discountPrice: 199,
      stock: 70,
      characteristics: [{ key: 'Design', value: 'Fresh Look Mallipoo Gajra' }, { key: 'Fragrance', value: 'Mild Natural Jasmine Scent' }, { key: 'Reusable', value: 'Washable & Long Lasting' }],
      tags: ['mallipoo', 'gajra', 'hair bun', 'flower gajra']
    }
  ],
  Skincare: [
    {
      name: 'Pure Kumkumadi Miraculous Night Glow Ayurvedic Face Oil (30ml)',
      price: 1499,
      discountPrice: 899,
      stock: 35,
      characteristics: [{ key: 'Ingredients', value: 'Kashmiri Saffron, Sandalwood, 26 Herbs' }, { key: 'Benefits', value: 'Fades Pigmentation, Boosts Radiance' }, { key: 'Skin Type', value: 'All Skin Types' }],
      tags: ['kumkumadi oil', 'face oil', 'saffron', 'ayurvedic skincare']
    },
    {
      name: '100% Pure Steam Distilled Kannauj Rose Water Facial Mist (200ml)',
      price: 599,
      discountPrice: 349,
      stock: 55,
      characteristics: [{ key: 'Process', value: 'Traditional Deg-Bhapka Steam Distillation' }, { key: 'Origin', value: 'Kannauj Desi Gulab' }, { key: 'Alcohol Free', value: '100% Pure & Organic' }],
      tags: ['rose water', 'toner', 'face mist', 'kannauj rose']
    },
    {
      name: 'Vitamin C & Niacinamide 10% Dark Spot Brightening Face Serum (30ml)',
      price: 999,
      discountPrice: 549,
      stock: 40,
      characteristics: [{ key: 'Key Actives', value: '10% Ethyl Ascorbic Acid + 2% Niacinamide' }, { key: 'Target', value: 'Dark Spots, Acne Scars & Dullness' }, { key: 'Texture', value: 'Non-Sticky Water Base' }],
      tags: ['vitamin c', 'face serum', 'brightening', 'niacinamide']
    },
    {
      name: 'Green Tea & Tea Tree Oil Clarifying Mattifying Gel Cream (50g)',
      price: 799,
      discountPrice: 449,
      stock: 45,
      characteristics: [{ key: 'Skin Type', value: 'Oily, Combination & Acne-Prone' }, { key: 'Key Extracts', value: 'Japanese Green Tea + Australian Tea Tree' }, { key: 'Finish', value: 'Ultra-Light Oil-Free Matte' }],
      tags: ['green tea moisturizer', 'gel cream', 'acne prone', 'matte']
    },
    {
      name: 'Ceramide & Hyaluronic Acid Deep Moisture Barrier Repair Lotion (250ml)',
      price: 899,
      discountPrice: 499,
      stock: 40,
      characteristics: [{ key: 'Active Ingredients', value: '5 Essential Ceramides + 2% Hyaluronic' }, { key: 'Protection', value: 'Repairs Damaged Skin Barrier' }, { key: 'Hydration', value: 'Up to 72 Hours Moisture' }],
      tags: ['body lotion', 'ceramide', 'hyaluronic', 'dry skin']
    }
  ],
  'Herbal products': [
    {
      name: '18 Herbs Cold-Pressed Traditional Ayurvedic Hair Growth Oil (200ml)',
      price: 899,
      discountPrice: 499,
      stock: 50,
      characteristics: [{ key: 'Key Herbs', value: 'Bhringraj, Amla, Brahmi, Hibiscus, Curry Leaves' }, { key: 'Base Oil', value: 'Wood-Pressed Black Sesame & Coconut Oil' }, { key: 'Results', value: 'Controls Hair Fall & Promotes Density' }],
      tags: ['hair oil', 'bhringraj', 'ayurvedic hair oil', 'hair fall control']
    },
    {
      name: 'Kasturi Manjal & Red Sandalwood Skin Clarifying Herbal Ubtan (100g)',
      price: 599,
      discountPrice: 329,
      stock: 60,
      characteristics: [{ key: 'Ingredients', value: 'Wild Turmeric, Rakta Chandana, Rose Petals' }, { key: 'Benefits', value: 'Removes Sun Tan & Facial Blemishes' }, { key: 'Chemical Free', value: '100% Edible-Grade Herbs' }],
      tags: ['kasturi manjal', 'ubtan', 'herbal face pack', 'turmeric']
    },
    {
      name: 'Shikakai, Reetha & Amla Natural Foaming Herbal Shampoo Bar (100g)',
      price: 449,
      discountPrice: 249,
      stock: 55,
      characteristics: [{ key: 'Form', value: 'Zero Plastic Eco Shampoo Bar' }, { key: 'Sulphate Free', value: '100% SLS / Paraben Free' }, { key: 'Conditioning', value: 'Fenugreek & Aloe Vera Infused' }],
      tags: ['shampoo bar', 'shikakai', 'natural shampoo', 'eco friendly']
    },
    {
      name: 'Pure Vetiver Root & Neem Leaf Bathing Herbal Soap (Pack of 3)',
      price: 499,
      discountPrice: 279,
      stock: 50,
      characteristics: [{ key: 'Aroma', value: 'Earthy Cooling Khus (Vetiver) Fragrance' }, { key: 'Process', value: 'Cold-Process Handcrafted Soap' }, { key: 'Antiseptic', value: 'Neem & Tulsi Antibacterial' }],
      tags: ['vetiver soap', 'neem soap', 'herbal soap', 'handmade soap']
    },
    {
      name: 'Organic Cold-Pressed Virgin Coconut Oil for Skin & Hair (500ml)',
      price: 649,
      discountPrice: 399,
      stock: 45,
      characteristics: [{ key: 'Extraction', value: 'Cold Centrifuged Coconut Milk' }, { key: 'Aroma', value: 'Fresh Sweet Coconut Fragrance' }, { key: 'Usage', value: 'Hair Conditioning, Body Massage, Baby Care' }],
      tags: ['virgin coconut oil', 'cold pressed', 'hair food', 'skin care']
    }
  ],
  Cases: [
    {
      name: 'Military Grade Drop-Tested Armor Shockproof Case with Kickstand',
      price: 899,
      discountPrice: 449,
      stock: 50,
      characteristics: [{ key: 'Protection', value: 'Dual Layer TPU + Polycarbonate' }, { key: 'Stand', value: 'Built-in 360 Ring Kickstand' }, { key: 'Camera', value: 'Raised 1.5mm Bezel Edge' }],
      tags: ['phone case', 'armor case', 'shockproof', 'mobile cover']
    },
    {
      name: 'Liquid Silicone Slim Case with Soft Microfiber Lining Inside',
      price: 699,
      discountPrice: 349,
      stock: 60,
      characteristics: [{ key: 'Material', value: 'Medical-Grade Liquid Silicone' }, { key: 'Touch', value: 'Baby Skin Ultra-Soft Finish' }, { key: 'Grip', value: 'Anti-Slip & Easy to Clean' }],
      tags: ['silicone case', 'slim cover', 'matte cover']
    },
    {
      name: 'Vintage Vegan Leather Wallet Flip Cover with Card & Cash Slots',
      price: 999,
      discountPrice: 549,
      stock: 35,
      characteristics: [{ key: 'Material', value: 'Textured PU Vegan Leather' }, { key: 'Slots', value: '3 Card Slots + 1 Currency Pocket' }, { key: 'Magnetic', value: 'Secure Front Flap Clasp' }],
      tags: ['wallet case', 'leather cover', 'flip cover']
    },
    {
      name: 'Ultra Clear Anti-Yellowing Hybrid Acrylic Bumper Phone Case',
      price: 599,
      discountPrice: 299,
      stock: 55,
      characteristics: [{ key: 'Backplate', value: '9H Optical Clear Hard Acrylic' }, { key: 'Corners', value: 'Air-Cushioned Shock Absorption' }, { key: 'Technology', value: 'Bayer Anti-UV Yellowing Formula' }],
      tags: ['transparent case', 'clear cover', 'acrylic bumper']
    },
    {
      name: 'Woven Fabric Texture Slim Fit Designer Mobile Back Cover',
      price: 799,
      discountPrice: 399,
      stock: 40,
      characteristics: [{ key: 'Texture', value: 'Sweat-Resistant Canvas Fabric' }, { key: 'Buttons', value: 'Independent Metallic Click Buttons' }, { key: 'Weight', value: 'Ultra Light 25g' }],
      tags: ['fabric case', 'designer cover', 'canvas phone case']
    }
  ],
  Chargers: [
    {
      name: '65W GaN Dual USB-C Fast Charger Power Adapter with Foldable Pin',
      price: 2499,
      discountPrice: 1499,
      stock: 30,
      characteristics: [{ key: 'Technology', value: 'Gallium Nitride (GaN III)' }, { key: 'Outputs', value: '2x Type-C (65W) + 1x USB-A (30W)' }, { key: 'Compatible', value: 'Laptops, MacBooks, iPhones & Android' }],
      tags: ['gan charger', '65w fast charger', 'type c charger']
    },
    {
      name: '20W PD Super Fast Charging Adapter Type-C Port Output',
      price: 999,
      discountPrice: 499,
      stock: 65,
      characteristics: [{ key: 'Protocol', value: 'Power Delivery (PD 3.0) + QC 4.0' }, { key: 'Speed', value: '0 to 50% in 25 Minutes' }, { key: 'Safety', value: 'Overheat & Surge Voltage Protection' }],
      tags: ['20w charger', 'iphone charger', 'fast charging adapter']
    },
    {
      name: '3-in-1 Foldable Magnetic Wireless Charging Station Stand',
      price: 2999,
      discountPrice: 1699,
      stock: 25,
      characteristics: [{ key: 'Simultaneous Charge', value: 'Phone (15W) + Watch (3W) + Earbuds (5W)' }, { key: 'Design', value: 'Foldable Travel Friendly' }, { key: 'Alignment', value: 'MagSafe Strong Auto-Lock' }],
      tags: ['wireless charger', '3 in 1 charger', 'magsafe stand']
    },
    {
      name: 'Quick Charge 3.0 Dual USB Fast Car Charger Adapter (36W)',
      price: 699,
      discountPrice: 349,
      stock: 50,
      characteristics: [{ key: 'Ports', value: 'Dual USB-A Quick Charge 3.0' }, { key: 'Body', value: 'Heat Dissipating Aluminum Shell' }, { key: 'Indicator', value: 'Soft Blue Ambient LED Ring' }],
      tags: ['car charger', 'fast car adapter', 'dual usb']
    },
    {
      name: '15W Qi-Certified Fast Wireless Charging Pad with Breathing LED',
      price: 1199,
      discountPrice: 599,
      stock: 40,
      characteristics: [{ key: 'Output', value: '15W / 10W / 7.5W Auto Adaptive' }, { key: 'Case Friendly', value: 'Charges Through Cases up to 5mm' }, { key: 'Surface', value: 'Non-Slip Matte Rubberized Coating' }],
      tags: ['wireless pad', 'qi charger', 'desk charger']
    }
  ],
  Cables: [
    {
      name: '100W Braided USB-C to USB-C Fast Charging Cable with E-Marker (2M)',
      price: 799,
      discountPrice: 399,
      stock: 55,
      characteristics: [{ key: 'Power', value: '100W (20V/5A) Ultra High Speed' }, { key: 'Length', value: '2 Meters Extra Long' }, { key: 'Braiding', value: 'Ballistic Nylon 10,000+ Bends' }],
      tags: ['type c cable', '100w cable', 'braided cable', 'fast charging']
    },
    {
      name: '3-in-1 Multi USB Charging Cable (Type-C, Lightning, Micro USB)',
      price: 699,
      discountPrice: 349,
      stock: 60,
      characteristics: [{ key: 'Connectors', value: 'Type-C, iPhone Lightning, Micro USB' }, { key: 'Simultaneous', value: 'Charges 3 Devices at Once' }, { key: 'Core', value: 'Thick Pure Tinned Copper' }],
      tags: ['multi cable', '3 in 1 cable', 'universal charger']
    },
    {
      name: 'Right Angle 90-Degree Gaming USB-C Fast Charge Cable (1.5M)',
      price: 599,
      discountPrice: 299,
      stock: 45,
      characteristics: [{ key: 'Design', value: 'L-Shape 90 Degree Ergonomic Elbow' }, { key: 'Gaming Benefit', value: 'Zero Hand Interference While Playing' }, { key: 'Current', value: '6A 66W Super Fast Support' }],
      tags: ['gaming cable', '90 degree cable', 'elbow cable']
    },
    {
      name: 'MFi-Certified Lightning to Type-C Braided Fast Charge Cable (1.2M)',
      price: 999,
      discountPrice: 499,
      stock: 40,
      characteristics: [{ key: 'Certification', value: 'Apple MFi Certified Chipset' }, { key: 'Compatibility', value: 'All iPhone & iPad Models' }, { key: 'Data Speed', value: '480 Mbps Sync Speed' }],
      tags: ['lightning cable', 'mfi certified', 'iphone cable']
    },
    {
      name: 'Liquid Silicone Tangle-Free Fast Data Cable 65W (1.5M)',
      price: 549,
      discountPrice: 279,
      stock: 50,
      characteristics: [{ key: 'Material', value: 'Food-Grade Soft Liquid Silicone' }, { key: 'Feature', value: '100% Tangle-Free & Knot-Proof' }, { key: 'Durability', value: 'High Temperature Resistant' }],
      tags: ['silicone cable', 'tangle free', 'soft cable']
    }
  ],
  Stands: [
    {
      name: 'Multi-Angle Heavy Aluminum Desktop Phone & Tablet Stand',
      price: 899,
      discountPrice: 449,
      stock: 45,
      characteristics: [{ key: 'Material', value: 'Aerospace CNC Solid Aluminum' }, { key: 'Adjustability', value: 'Dual Hinge 270 Degree Rotation' }, { key: 'Compatibility', value: 'Phones & Tablets 4 to 12.9 Inch' }],
      tags: ['mobile stand', 'aluminum stand', 'desktop holder', 'tablet stand']
    },
    {
      name: 'Flexible Long Arm Gooseneck Bed Mount Mobile Holder (85cm)',
      price: 799,
      discountPrice: 399,
      stock: 35,
      characteristics: [{ key: 'Length', value: '85cm Flexible Rigid Core Arm' }, { key: 'Clamp', value: 'Screw Lock Base up to 80mm Board' }, { key: 'Rotation', value: '360 Swivel Ball Head' }],
      tags: ['gooseneck stand', 'bed phone holder', 'flexible arm']
    },
    {
      name: 'MagSafe Compatible 360 Rotating Magnetic Ring Grip & Kickstand',
      price: 699,
      discountPrice: 349,
      stock: 55,
      characteristics: [{ key: 'Magnet', value: 'N52 Strong Rare Earth Neodymium' }, { key: 'Dual Function', value: 'Finger Grip + Multi-Angle Stand' }, { key: 'Removable', value: 'Snaps On & Off Instantly' }],
      tags: ['magsafe ring', 'finger grip', 'magnetic kickstand']
    },
    {
      name: 'Auto-Clamping Car Air Vent Mobile Mount Gravity Cradle',
      price: 649,
      discountPrice: 329,
      stock: 40,
      characteristics: [{ key: 'Operation', value: 'One-Handed Gravity Auto Lock' }, { key: 'Mount', value: 'Steel Core Vent Hook Clip' }, { key: 'Protection', value: 'Thick Silicone Padding' }],
      tags: ['car mobile holder', 'air vent mount', 'gravity stand']
    },
    {
      name: 'Foldable Pocket-Size Portable Plastic Mobile Stand (Pack of 2)',
      price: 399,
      discountPrice: 199,
      stock: 65,
      characteristics: [{ key: 'Portability', value: 'Folds Completely Flat (Card Size)' }, { key: 'Angles', value: '6 Adjustable Viewing Slots' }, { key: 'Quantity', value: 'Pack of 2 Stand Units' }],
      tags: ['portable stand', 'pocket stand', 'foldable stand']
    }
  ],
  Earbuds: [
    {
      name: 'Active Noise Cancelling True Wireless Earbuds with 40H Playtime',
      price: 3499,
      discountPrice: 1899,
      stock: 25,
      characteristics: [{ key: 'Noise Cancellation', value: 'Up to 32dB Hybrid ANC' }, { key: 'Drivers', value: '13mm Titanium Dynamic Drivers' }, { key: 'Battery', value: '40 Hours with Charging Case' }],
      tags: ['earbuds', 'anc earbuds', 'wireless earphones', 'bluetooth']
    },
    {
      name: 'Low Latency Gaming Wireless Earbuds with Breathing RGB Lights',
      price: 2499,
      discountPrice: 1299,
      stock: 30,
      characteristics: [{ key: 'Latency', value: 'Ultra Low 40ms Gaming Mode' }, { key: 'LED', value: 'Cool Glare Cyan Breathing Lights' }, { key: 'Mic', value: 'Dual MEMS Clear Voice Mics' }],
      tags: ['gaming earbuds', 'low latency', 'rgb earbuds']
    },
    {
      name: 'Ergonomic Sports Wireless Earphones with Secure Fit Earhooks',
      price: 1999,
      discountPrice: 999,
      stock: 35,
      characteristics: [{ key: 'Waterproof', value: 'IPX7 Sweat & Rain Proof' }, { key: 'Fit', value: 'Anti-Drop Soft Silicone Earhooks' }, { key: 'Playtime', value: '10H Single Charge, 50H with Case' }],
      tags: ['sports earphones', 'earhooks', 'waterproof earbuds', 'gym']
    },
    {
      name: 'Quad-Mic ENC Environmental Noise Canceling Bluetooth 5.3 Earbuds',
      price: 1799,
      discountPrice: 899,
      stock: 40,
      characteristics: [{ key: 'Calling', value: '4-Microphone ENC for Crystal Calls' }, { key: 'Bluetooth', value: 'v5.3 Instant Auto Pairing' }, { key: 'Touch Control', value: 'Volume, Track & Voice Assistant' }],
      tags: ['bluetooth 5.3', 'calling earbuds', 'enc mic']
    },
    {
      name: 'Compact Mini Half-in-Ear Bass Heavy Bluetooth Earbuds',
      price: 1499,
      discountPrice: 749,
      stock: 45,
      characteristics: [{ key: 'Weight', value: 'Only 3.2g Per Earbud' }, { key: 'Sound', value: 'Deep Punchy Extra Bass' }, { key: 'Charging Case', value: 'Pocket Sized Pebble Case' }],
      tags: ['mini earbuds', 'half in ear', 'deep bass', 'lightweight']
    }
  ],
  'Sungudi sarees': [
    {
      name: 'Authentic Chinnalapatti Pure Cotton Sungudi Saree with Zari Border',
      price: 1699,
      discountPrice: 999,
      stock: 35,
      characteristics: [{ key: 'Fabric', value: '100% Combed Madurai Cotton' }, { key: 'Border', value: 'Traditional Golden Zari Kaddi' }, { key: 'Technique', value: 'Tie and Dye Sungudi Knots' }],
      tags: ['sungudi saree', 'chinnalapatti', 'madurai', 'pure cotton']
    },
    {
      name: 'Hand-Dyed Madurai Sungudi Saree with Contrast Rich Pallu',
      price: 1899,
      discountPrice: 1099,
      stock: 30,
      characteristics: [{ key: 'Origin', value: 'Madurai Traditional Weavers' }, { key: 'Pattern', value: 'Classic Round Dot Sungudi Butta' }, { key: 'Length', value: '6.2 Meters with Blouse Piece' }],
      tags: ['madurai cotton', 'sungudi', 'contrast pallu', 'traditional']
    },
    {
      name: 'Traditional Micro-Dot Bandhani Pattern Sungudi Cotton Saree',
      price: 1499,
      discountPrice: 849,
      stock: 40,
      characteristics: [{ key: 'Dye', value: 'Fast Color Vat Dyed' }, { key: 'Texture', value: 'Soft Starched Crisp Drape' }, { key: 'Occasion', value: 'Temple & Daily Ethnic Wear' }],
      tags: ['bandhani sungudi', 'cotton saree', 'temple wear']
    },
    {
      name: 'Kalamkari Handblock Printed Border Sungudi Cotton Saree',
      price: 1999,
      discountPrice: 1199,
      stock: 25,
      characteristics: [{ key: 'Border Art', value: 'Natural Dye Kalamkari Print' }, { key: 'Body', value: 'Solid Sungudi Dots' }, { key: 'Feel', value: 'Cooling Summer Cotton' }],
      tags: ['kalamkari', 'sungudi saree', 'handblock print']
    },
    {
      name: 'Temple Border Festive Peacock Motif Madurai Sungudi Saree',
      price: 1799,
      discountPrice: 1049,
      stock: 28,
      characteristics: [{ key: 'Motif', value: 'Mayil (Peacock) Woven Border' }, { key: 'Color', value: 'Vibrant Peacock Blue & Maroon' }, { key: 'Wash Care', value: 'First Wash Dry Clean, Then Hand Wash' }],
      tags: ['peacock border', 'sungudi', 'festive cotton', 'madurai']
    }
  ],
  'Brass items': [
    {
      name: 'Traditional Handcrafted Brass Kuthu Vilakku Pooja Lamp (12 Inch Pair)',
      price: 3499,
      discountPrice: 2199,
      stock: 20,
      characteristics: [{ key: 'Material', value: 'Pure Solid Heavy Brass' }, { key: 'Height', value: '12 Inches (Pair of 2 Diya)' }, { key: 'Origin', value: 'Nachiarkoil Brass Artisans' }],
      tags: ['kuthu vilakku', 'brass lamp', 'pooja items', 'traditional']
    },
    {
      name: 'Brass Kamakshi Deepam Lamp with Embossed Goddess Idol (6 Inch)',
      price: 1299,
      discountPrice: 749,
      stock: 35,
      characteristics: [{ key: 'Idol', value: 'Goddess Kamakshi with Gajalakshmi' }, { key: 'Weight', value: '750 Grams Solid Cast Brass' }, { key: 'Finish', value: 'Mirror Golden Polish' }],
      tags: ['kamakshi vilakku', 'brass deepam', 'pooja lamp']
    },
    {
      name: 'Antique Finish Brass Urli Bowl for Floating Flowers & Diyas (10 Inch)',
      price: 2199,
      discountPrice: 1299,
      stock: 25,
      characteristics: [{ key: 'Diameter', value: '10 Inches' }, { key: 'Detailing', value: 'Hand Carved Floral Border Rim' }, { key: 'Placement', value: 'Living Room Centerpiece or Entryway' }],
      tags: ['brass urli', 'floating flowers', 'urli bowl', 'home decor']
    },
    {
      name: 'Traditional South Indian Brass Filter Coffee Drip Decoction Maker (200ml)',
      price: 1499,
      discountPrice: 849,
      stock: 45,
      characteristics: [{ key: 'Capacity', value: '4 to 6 Cups Strong Decoction' }, { key: 'Material', value: 'Food-Grade Heavy Brass' }, { key: 'Includes', value: 'Top Container, Bottom Mug, Plunger & Lid' }],
      tags: ['filter coffee maker', 'brass coffee filter', 'south indian coffee']
    },
    {
      name: 'Handcrafted Brass Annam Bird Table Diya Oil Lamp with Base',
      price: 1099,
      discountPrice: 599,
      stock: 38,
      characteristics: [{ key: 'Motif', value: 'Royal Annam (Swan) Bird' }, { key: 'Wick Spouts', value: '5 Spout Akhand Diya' }, { key: 'Material', value: 'Hand Cast Virgin Brass' }],
      tags: ['annam vilakku', 'brass diya', 'oil lamp']
    }
  ],
  'Tanjore crafts': [
    {
      name: 'Authentic 22K Gold Foil Framed Thanjavur Goddess Lakshmi Painting (10x12)',
      price: 6999,
      discountPrice: 4299,
      stock: 12,
      characteristics: [{ key: 'Gold Foil', value: 'Certified 22 Karat Gold Leaf' }, { key: 'Stones', value: 'Original Jaipur Gems & Kundan' }, { key: 'Frame', value: 'Teakwood Mani Type Frame with Glass' }],
      tags: ['tanjore painting', 'gold foil painting', 'lakshmi', 'thanjavur art']
    },
    {
      name: 'Traditional Thanjavur Dancing Doll Thalaiyatti Bommai (Handmade Pair)',
      price: 1499,
      discountPrice: 899,
      stock: 30,
      characteristics: [{ key: 'Movement', value: 'Gravitational Balancing Oscillating Head' }, { key: 'Material', value: 'Paper Mache & Natural Clay' }, { key: 'Set', value: 'King (Raja) & Queen (Rani) Pair' }],
      tags: ['thalaiyatti bommai', 'tanjore doll', 'dancing doll', 'handicrafts']
    },
    {
      name: 'Hand-Painted Wooden Temple Art Decorative Wall Hanging Plate (10 Inch)',
      price: 1299,
      discountPrice: 699,
      stock: 25,
      characteristics: [{ key: 'Art', value: 'Traditional Mural Folk Art' }, { key: 'Base', value: 'Pre-Treated Moisture Resistant Wood' }, { key: 'Ready to Hang', value: 'Pre-Attached Metal Hook' }],
      tags: ['temple art', 'wall plate', 'wooden craft', 'tamil culture']
    },
    {
      name: 'Gold Embossed Traditional Ganesha Tanjore Relief Art Wall Panel',
      price: 4999,
      discountPrice: 2999,
      stock: 15,
      characteristics: [{ key: 'Deity', value: 'Lord Ganesha with Modak' }, { key: 'Work', value: '3D Relief Gesso Paste with Gold Leaf' }, { key: 'Dimensions', value: '8 x 10 Inches Framed' }],
      tags: ['ganesha tanjore', 'relief art', 'spiritual art']
    },
    {
      name: 'Miniature Handcrafted Wooden & Brass Temple Chariot Model (Ther)',
      price: 2499,
      discountPrice: 1499,
      stock: 18,
      characteristics: [{ key: 'Replication', value: 'Traditional Tamil Temple Car (Ther)' }, { key: 'Wheels', value: 'Fully Functional Rolling Wheels' }, { key: 'Wood', value: 'Country Teakwood with Brass Inlays' }],
      tags: ['temple chariot', 'wooden ther', 'miniature craft']
    }
  ],
  Murukku: [
    {
      name: 'Authentic Manapparai Crunchy Double-Fried Rice Flour Murukku (500g)',
      price: 299,
      discountPrice: 179,
      stock: 75,
      characteristics: [{ key: 'Weight', value: '500 Grams Pack' }, { key: 'Origin', value: 'Manapparai Special, Tamil Nadu' }, { key: 'Oil', value: '100% Pure Refined Groundnut Oil' }],
      tags: ['murukku', 'manapparai', 'snacks', 'south indian food']
    },
    {
      name: 'Kai Murukku Traditional Hand-Twisted Butter Snack (400g)',
      price: 349,
      discountPrice: 199,
      stock: 60,
      characteristics: [{ key: 'Preparation', value: '100% Hand-Twisted Artisanal' }, { key: 'Key Ingredient', value: 'Pure Butter & White Sesame' }, { key: 'Texture', value: 'Crispy Melt-in-Mouth' }],
      tags: ['kai murukku', 'butter murukku', 'traditional snacks']
    },
    {
      name: 'Spicy Ribbon Pakoda Crispy Tea-Time Besan Snack (500g)',
      price: 279,
      discountPrice: 169,
      stock: 70,
      characteristics: [{ key: 'Spiciness', value: 'Mild Red Chilli & Hing Spiced' }, { key: 'Texture', value: 'Feather-Crisp Thin Strips' }, { key: 'Preservatives', value: 'Zero Artificial Preservatives' }],
      tags: ['ribbon pakoda', 'snacks', 'tea time', 'crispy']
    },
    {
      name: 'Sesame Seed Butter Murukku Round Spiral Snack (400g)',
      price: 299,
      discountPrice: 189,
      stock: 65,
      characteristics: [{ key: 'Flavor', value: 'Rich Fresh Creamery Butter' }, { key: 'Aroma', value: 'Toasted Black & White Sesame' }, { key: 'Packaging', value: 'Nitrogen Flushed Airtight Pouch' }],
      tags: ['butter murukku', 'sesame', 'spiral snack']
    },
    {
      name: 'Mullu Murukku Spiced Star Fluted Festival Snack (500g)',
      price: 289,
      discountPrice: 169,
      stock: 70,
      characteristics: [{ key: 'Shape', value: 'Star Die Fluted Crunchy Rings' }, { key: 'Spices', value: 'Cumin (Jeera) & Asafoetida' }, { key: 'Shelf Life', value: '90 Days from Packing' }],
      tags: ['mullu murukku', 'diwali snack', 'crunchy']
    }
  ],
  Mixture: [
    {
      name: 'Madras Special Spicy Royal Mixture with Cashews & Peanuts (500g)',
      price: 329,
      discountPrice: 199,
      stock: 70,
      characteristics: [{ key: 'Includes', value: 'Boondi, Sev, Omapodi, Roasted Cashews, Curry Leaves' }, { key: 'Taste', value: 'Signature Spicy South Indian Blend' }, { key: 'Oil', value: 'Zero Trans Fat Groundnut Oil' }],
      tags: ['madras mixture', 'royal mixture', 'snacks', 'cashews']
    },
    {
      name: 'Crispy Kara Boondi with Fried Curry Leaves & Garlic (400g)',
      price: 249,
      discountPrice: 149,
      stock: 80,
      characteristics: [{ key: 'Main Ingredient', value: 'Gram Flour (Besan) Droplets' }, { key: 'Seasoning', value: 'Crushed Fried Garlic & Curry Leaves' }, { key: 'Use', value: 'Snack or Dahi Boondi Raita' }],
      tags: ['kara boondi', 'boondi', 'garlic snack']
    },
    {
      name: 'Cornflakes Sweet & Spicy Crunchy Light Mixture (400g)',
      price: 269,
      discountPrice: 159,
      stock: 60,
      characteristics: [{ key: 'Base', value: 'Crispy Fried Cornflakes & Dry Fruits' }, { key: 'Profile', value: 'Tangy, Sweet & Mild Spicy' }, { key: 'Kid Friendly', value: 'Mild Heat Level' }],
      tags: ['cornflakes mixture', 'sweet spicy', 'khatta meetha']
    },
    {
      name: 'Omapodi Delicate Ajwain Flavored Thin Sev Snack (400g)',
      price: 239,
      discountPrice: 139,
      stock: 65,
      characteristics: [{ key: 'Flavor', value: 'Digestive Carom Seeds (Omam)' }, { key: 'Texture', value: 'Ultra-Fine Crispy Yellow Sev' }, { key: 'Traditional', value: 'Festival Essential' }],
      tags: ['omapodi', 'sev', 'ajwain snack']
    },
    {
      name: 'South Indian Garlic Infused Crunchy Evening Mixture (500g)',
      price: 299,
      discountPrice: 179,
      stock: 55,
      characteristics: [{ key: 'Aroma', value: 'Rich Roasted Garlic Flakes' }, { key: 'Crunch', value: 'Roasted Chana Dal & Peanuts' }, { key: 'Freshness', value: 'Freshly Prepared Small Batches' }],
      tags: ['garlic mixture', 'spicy snack', 'evening tea']
    }
  ],
  Pickles: [
    {
      name: 'Chettinad Spicy Cut Mango Pickle in Pure Gingelly Oil (500g)',
      price: 349,
      discountPrice: 219,
      stock: 60,
      characteristics: [{ key: 'Oil', value: 'Cold-Pressed Chettinad Sesame Oil' }, { key: 'Mangoes', value: 'Hand-Picked Raw Sour Country Mangoes' }, { key: 'Preservatives', value: 'Zero Vinegar or Chemicals' }],
      tags: ['mango pickle', 'chettinad pickle', 'avakkai', 'spicy']
    },
    {
      name: 'Tangy Sun-Dried Lemon Pickle Traditional Home Style (400g)',
      price: 299,
      discountPrice: 179,
      stock: 50,
      characteristics: [{ key: 'Fermentation', value: 'Natural Sun-Cured for 45 Days' }, { key: 'Oil-Free', value: 'Zero Oil Fat-Free Recipe' }, { key: 'Digestion', value: 'Ayurvedic Digestive Aid' }],
      tags: ['lemon pickle', 'oil free pickle', 'sun dried', 'tangy']
    },
    {
      name: 'Authentic Gongura Red Sorrel Leaf Andhra Style Thokku Pickle (400g)',
      price: 329,
      discountPrice: 199,
      stock: 45,
      characteristics: [{ key: 'Leaves', value: 'Tangy Red Stemmed Gongura Leaves' }, { key: 'Spicing', value: 'Guntur Red Chillies & Fenugreek' }, { key: 'Serving', value: 'Best with Steaming Hot Rice & Ghee' }],
      tags: ['gongura pickle', 'andhra pickle', 'thokku']
    },
    {
      name: 'Village Style Whole Garlic & Red Chilli Thokku Pickle (500g)',
      price: 379,
      discountPrice: 229,
      stock: 40,
      characteristics: [{ key: 'Garlic', value: 'Peeled Hill Garlic Cloves (Poondu)' }, { key: 'Health', value: 'Heart Healthy & Immunity Booster' }, { key: 'Gravy', value: 'Thick Spiced Tamarind Gravy' }],
      tags: ['garlic pickle', 'poondu thokku', 'immunity']
    },
    {
      name: 'Traditional Puliyodharai Tamarind Rice Paste Concentrate (400g)',
      price: 299,
      discountPrice: 189,
      stock: 55,
      characteristics: [{ key: 'Usage', value: 'Mix 2 Spoons with Hot Cooked Rice' }, { key: 'Flavor', value: 'Temple Prasadam Style Tamarind Mix' }, { key: 'Ingredients', value: 'Tamarind, Groundnuts, Chana Dal, Spices' }],
      tags: ['puliyodharai', 'tamarind rice paste', 'temple style']
    }
  ],
  Podi: [
    {
      name: 'Classic Gunpowder Idli Dosa Milagai Podi with Ghee Roast (300g)',
      price: 249,
      discountPrice: 149,
      stock: 70,
      characteristics: [{ key: 'Usage', value: 'Serve with Idli, Dosa & Gingelly Oil' }, { key: 'Dal Mix', value: 'Slow Roasted Urad & Chana Dal' }, { key: 'Texture', value: 'Coarse Crunchy Gunpowder' }],
      tags: ['idli podi', 'gunpowder', 'milagai podi', 'south indian']
    },
    {
      name: 'Traditional Paruppu Podi Roasted Toor Dal Rice Mix (250g)',
      price: 229,
      discountPrice: 139,
      stock: 65,
      characteristics: [{ key: 'Pairing', value: 'Mix with Hot Steamed Rice & Pure Ghee' }, { key: 'Ingredients', value: 'Roasted Toor Dal, Moong Dal, Pepper, Cumin' }, { key: 'Kid Friendly', value: 'Mild Non-Spicy Protein Powder' }],
      tags: ['paruppu podi', 'dal powder', 'rice mix', 'healthy']
    },
    {
      name: 'Curry Leaf Karuveppilai Podi for Iron & Hair Growth (250g)',
      price: 269,
      discountPrice: 159,
      stock: 60,
      characteristics: [{ key: 'Leaves', value: 'Fresh Farm Curry Leaves Sun-Dried' }, { key: 'Nutrition', value: 'High Plant Iron & Vitamin A' }, { key: 'Serving', value: 'Rice, Chutneys or Salad Seasoning' }],
      tags: ['karuveppilai podi', 'curry leaf powder', 'iron rich']
    },
    {
      name: 'Spicy Garlic Poondu Podi Roasted Spices Rice Seasoning (250g)',
      price: 259,
      discountPrice: 159,
      stock: 55,
      characteristics: [{ key: 'Flavor', value: 'Bold Roasted Garlic & Dry Chillies' }, { key: 'Versatile', value: 'Sprinkle on Dosa, Utthapam or Curd Rice' }, { key: 'Shelf Life', value: '6 Months Dry Storage' }],
      tags: ['garlic podi', 'poondu podi', 'spicy rice mix']
    },
    {
      name: 'Kothamalli Fresh Coriander Herbal Digestive Rice Powder (250g)',
      price: 239,
      discountPrice: 149,
      stock: 50,
      characteristics: [{ key: 'Benefits', value: 'Aids Digestion & Relieves Acidity' }, { key: 'Herbs', value: 'Roasted Coriander Seeds, Leaves & Hing' }, { key: 'Taste', value: 'Aromatic Citrusy Herbal Notes' }],
      tags: ['kothamalli podi', 'coriander powder', 'digestive']
    }
  ],
  Sweets: [
    {
      name: 'Authentic Tirunelveli Iruttu Kadai Style Ghee Wheat Halwa (500g)',
      price: 399,
      discountPrice: 249,
      stock: 50,
      characteristics: [{ key: 'Milk', value: 'Extracted Fermented Whole Wheat Milk' }, { key: 'Fat', value: '100% Pure Cow Ghee' }, { key: 'Texture', value: 'Glossy Jelly-Like Melt in Mouth' }],
      tags: ['tirunelveli halwa', 'wheat halwa', 'ghee halwa', 'sweets']
    },
    {
      name: 'Srivilliputhur Authentic Rich Milk Palkova Sweet (400g)',
      price: 379,
      discountPrice: 229,
      stock: 45,
      characteristics: [{ key: 'Origin', value: 'Srivilliputhur GI-Tagged Style' }, { key: 'Ingredients', value: 'Pure Full Cream Buffalo Milk & Sugar' }, { key: 'Slow Cooked', value: 'Simmered in Heavy Bottom Vats for 4 Hours' }],
      tags: ['palkova', 'milk sweet', 'srivilliputhur', 'traditional sweet']
    },
    {
      name: 'Ghee Mysore Pak Soft Melt-in-Mouth Traditional Sweet (500g)',
      price: 429,
      discountPrice: 269,
      stock: 40,
      characteristics: [{ key: 'Texture', value: 'Ultra-Soft Silky Non-Hard Mysore Pak' }, { key: 'Ghee', value: 'Loaded with Aromatic Pure Desi Ghee' }, { key: 'Occasion', value: 'Festival & Celebrations' }],
      tags: ['mysore pak', 'ghee mysore pak', 'south indian sweet']
    },
    {
      name: 'Nattu Sakkarai Groundnut Kadalai Mittai Chikki Bar (Pack of 20)',
      price: 299,
      discountPrice: 169,
      stock: 80,
      characteristics: [{ key: 'Sweetener', value: '100% Organic Country Jaggery (Zero White Sugar)' }, { key: 'Nuts', value: 'Roasted Crunchy Bharuch Peanuts' }, { key: 'Health', value: 'Healthy Protein & Energy Snack' }],
      tags: ['kadalai mittai', 'peanut chikki', 'jaggery snack', 'healthy sweet']
    },
    {
      name: 'Traditional Athirasam Soft Jaggery & Rice Flour Festival Sweet (500g)',
      price: 349,
      discountPrice: 219,
      stock: 45,
      characteristics: [{ key: 'Dough', value: 'Fermented Raw Rice Flour & Filtered Jaggery' }, { key: 'Spiced', value: 'Cardamom & Dry Ginger Powder' }, { key: 'Shape', value: 'Golden Brown Fried Disc' }],
      tags: ['athirasam', 'jaggery sweet', 'diwali sweet', 'traditional']
    }
  ],
  'Wall décor': [
    {
      name: 'Geometric Modern Metal Wall Art Panel with Warm Gold Finish (36x18)',
      price: 3499,
      discountPrice: 1899,
      stock: 20,
      characteristics: [{ key: 'Material', value: 'Rust-Proof Laser Cut Steel' }, { key: 'Finish', value: 'Electrostatic Warm Champagne Gold' }, { key: 'Mounting', value: 'Concealed Wall Mounting Brackets' }],
      tags: ['wall art', 'metal wall decor', 'living room decor', 'gold decor']
    },
    {
      name: 'Handcrafted Boho Macrame Wall Hanging Tapestry with Fringe (45x70cm)',
      price: 1299,
      discountPrice: 699,
      stock: 35,
      characteristics: [{ key: 'Thread', value: '100% Organic Unbleached Cotton Cord' }, { key: 'Rod', value: 'Natural Pine Wood Dowel' }, { key: 'Vibe', value: 'Bohemian Chic Living & Bedroom' }],
      tags: ['macrame', 'wall hanging', 'boho decor', 'handmade']
    },
    {
      name: 'Minimalist Botanical Leaves Framed Canvas Prints (Set of 6)',
      price: 1799,
      discountPrice: 999,
      stock: 30,
      characteristics: [{ key: 'Count', value: '6 Coordinated Art Prints (A4 Size)' }, { key: 'Paper', value: '300 GSM Textured Canvas Paper' }, { key: 'Frames', value: 'Sleek Synthetic Black Frames' }],
      tags: ['framed prints', 'botanical art', 'gallery wall', 'minimalist']
    },
    {
      name: 'Rustic Solid Wood Floating Wall Shelf with Jute Rope Suspension',
      price: 999,
      discountPrice: 549,
      stock: 40,
      characteristics: [{ key: 'Wood', value: 'Natural Grain Reclaimed Mango Wood' }, { key: 'Load', value: 'Holds up to 6 kg Plants & Books' }, { key: 'Aesthetic', value: 'Cottage Farmhouse Decor' }],
      tags: ['floating shelf', 'wall shelf', 'rope shelf', 'rustic']
    },
    {
      name: 'Antique Sunburst Mirror Decorative Accent for Living Room (20 Inch)',
      price: 2499,
      discountPrice: 1399,
      stock: 22,
      characteristics: [{ key: 'Frame', value: 'Golden Spoke Sunburst Metal Rim' }, { key: 'Mirror', value: 'Beveled Edge Float Glass Mirror' }, { key: 'Placement', value: 'Foyer, Vanity or Accent Wall' }],
      tags: ['sunburst mirror', 'decorative mirror', 'accent mirror']
    }
  ],
  'Artificial plants': [
    {
      name: 'Realistic Potted Fiddle Leaf Fig Tree (90cm) with Ceramic Planter',
      price: 2999,
      discountPrice: 1699,
      stock: 25,
      characteristics: [{ key: 'Height', value: '90 cm (3 Feet)' }, { key: 'Leaves', value: 'Natural Vein Embossed Polyester Silk' }, { key: 'Pot', value: 'Weighted Minimalist White Matte Pot' }],
      tags: ['artificial plant', 'fiddle leaf', 'indoor plant', 'faux greenery']
    },
    {
      name: 'Hanging String of Pearls Faux Succulent Vine in Terracotta Pot',
      price: 899,
      discountPrice: 449,
      stock: 45,
      characteristics: [{ key: 'Length', value: '60 cm Cascading Vines' }, { key: 'Material', value: 'Soft Touch UV Resistant Polymer' }, { key: 'Hanger', value: 'Braided Jute Macrame Hanger Included' }],
      tags: ['hanging plant', 'string of pearls', 'succulent', 'faux plant']
    },
    {
      name: 'Lush Green Japanese Artificial Bonsai Tree in Zen Ceramic Tray',
      price: 1499,
      discountPrice: 799,
      stock: 35,
      characteristics: [{ key: 'Style', value: 'Zen Pine Miniature Bonsai' }, { key: 'Base', value: 'Glazed Ceramic Tray with Real Pebbles' }, { key: 'Maintenance', value: 'Zero Water or Sunlight Required' }],
      tags: ['bonsai tree', 'zen decor', 'tabletop plant']
    },
    {
      name: 'Faux Monstera Deliciosa Swiss Cheese Tabletop Plant with Pot (45cm)',
      price: 1299,
      discountPrice: 699,
      stock: 40,
      characteristics: [{ key: 'Leaves', value: '12 Detailed Cut-Out Foliage Fronds' }, { key: 'Stem', value: 'Pliable Wire Cores for Custom Shaping' }, { key: 'Height', value: '45 cm Compact Desk Size' }],
      tags: ['monstera', 'swiss cheese plant', 'desk plant']
    },
    {
      name: 'Artificial Purple Lavender Flowers in Vintage Galvanized Metal Pot',
      price: 799,
      discountPrice: 399,
      stock: 50,
      characteristics: [{ key: 'Flowers', value: 'Flocked Lavender Sprigs' }, { key: 'Container', value: 'Rustic Farmhouse Galvanized Tin' }, { key: 'Use', value: 'Dining Table & Balcony Decor' }],
      tags: ['lavender', 'artificial flowers', 'vintage pot']
    }
  ],
  Lamps: [
    {
      name: 'Nordic Wooden Tripod Standing Floor Lamp with Linen Fabric Drum Shade',
      price: 3999,
      discountPrice: 2299,
      stock: 20,
      characteristics: [{ key: 'Height', value: '145 cm Adjustable Height' }, { key: 'Legs', value: 'Solid Rubberwood Natural Tripod' }, { key: 'Switch', value: 'Convenient Foot Step Button' }],
      tags: ['floor lamp', 'tripod lamp', 'nordic lamp', 'lighting']
    },
    {
      name: 'Handcrafted Turkish Mosaic Glass Bedside Night Table Lamp (Warm Amber)',
      price: 1899,
      discountPrice: 1099,
      stock: 30,
      characteristics: [{ key: 'Globe', value: 'Hand-Cut Moroccan Stained Glass' }, { key: 'Base', value: 'Antique Bronze Swan Neck Stem' }, { key: 'Lighting', value: 'Warm Romantic Ambient Glow' }],
      tags: ['turkish lamp', 'mosaic lamp', 'bedside lamp', 'night light']
    },
    {
      name: 'Warm Amber Cordless Rechargeable LED Mushroom Table Lamp',
      price: 1499,
      discountPrice: 799,
      stock: 40,
      characteristics: [{ key: 'Battery', value: '2500mAh USB-C Rechargeable' }, { key: 'Dimming', value: '3-Level Touch Stepless Dimming' }, { key: 'Runtime', value: 'Up to 14 Hours Wireless Play' }],
      tags: ['mushroom lamp', 'rechargeable lamp', 'touch lamp', 'cordless']
    },
    {
      name: 'Geometric Matte Black Metal Cage Pendant Hanging Ceiling Light',
      price: 1299,
      discountPrice: 699,
      stock: 35,
      characteristics: [{ key: 'Design', value: 'Diamond Faceted Industrial Cage' }, { key: 'Cord', value: '1 Meter Adjustable Braided Fabric Wire' }, { key: 'Holder', value: 'Standard E27 Brass Screw Holder' }],
      tags: ['pendant light', 'hanging lamp', 'industrial lamp', 'ceiling light']
    },
    {
      name: 'Sunset Projection Lamp 16 Colors Atmosphere Light with Remote',
      price: 999,
      discountPrice: 499,
      stock: 55,
      characteristics: [{ key: 'Modes', value: '16 Color RGB + 4 Dynamic Light Shows' }, { key: 'Head', value: '180 Degree Swivel Optical Glass Lens' }, { key: 'Power', value: 'USB 5V Powered with Remote' }],
      tags: ['sunset lamp', 'rgb lamp', 'aesthetic lamp', 'mood lighting']
    }
  ],
  Toys: [
    {
      name: 'Wooden Educational Geometric Shape Sorter & Stacking Peg Block Toy',
      price: 899,
      discountPrice: 499,
      stock: 45,
      characteristics: [{ key: 'Material', value: 'Natural Rubberwood Non-Toxic Water Paint' }, { key: 'Skills', value: 'Hand-Eye Coordination & Color Recognition' }, { key: 'Age Group', value: '1 to 5 Years' }],
      tags: ['wooden toys', 'montessori', 'educational toy', 'shape sorter']
    },
    {
      name: 'High-Speed 4WD Remote Control Stunt Car with 360 Double-Sided Flip',
      price: 1699,
      discountPrice: 899,
      stock: 30,
      characteristics: [{ key: 'Features', value: '360 Spinning Flips, LED Headlights' }, { key: 'Battery', value: 'Dual Modular Rechargeable Battery Packs' }, { key: 'Control', value: '2.4 GHz Anti-Interference Controller' }],
      tags: ['rc car', 'remote control toy', 'stunt car', 'kids toy']
    },
    {
      name: 'Interactive Audio Talking Flash Cards Early Language Learning Toy (224 Words)',
      price: 999,
      discountPrice: 549,
      stock: 50,
      characteristics: [{ key: 'Cards', value: '112 Double-Sided Flash Cards (224 Words)' }, { key: 'Audio', value: 'Clear Pronunciation with Animal Sounds' }, { key: 'Screen-Free', value: 'Zero Eye Strain Montessori Learning' }],
      tags: ['talking flash cards', 'speech toy', 'learning toy', 'vocabulary']
    },
    {
      name: 'Non-Toxic Dough Modeling Clay Fun Tub Set with 12 Cutters & Rollers',
      price: 699,
      discountPrice: 349,
      stock: 60,
      characteristics: [{ key: 'Tubs', value: '6 Vibrant Dough Tubs (100% Wheat Based)' }, { key: 'Accessories', value: 'Extruder, Animal Cutters & Roller' }, { key: 'Safety', value: 'Non-Greasy & Odor Free' }],
      tags: ['play dough', 'clay toy', 'creative play', 'kids craft']
    },
    {
      name: 'Magnetic Building Tiles 3D Construction STEM Play Set (60 Pieces)',
      price: 2199,
      discountPrice: 1199,
      stock: 25,
      characteristics: [{ key: 'Pieces', value: '60 Translucent Magnetic Geometric Tiles' }, { key: 'Magnets', value: 'Ultrasonic Welded Strong Rare-Earth Magnets' }, { key: 'STEM', value: 'Architecture & Spatial Intelligence' }],
      tags: ['magnetic tiles', 'stem toys', 'building blocks', '3d tiles']
    }
  ],
  Stationery: [
    {
      name: 'Multi-Compartment Magnetic Pop-Out Pencil Box with Dual Sharpener',
      price: 599,
      discountPrice: 299,
      stock: 65,
      characteristics: [{ key: 'Buttons', value: 'Pop-Out Sharpener, Eraser Tray, Scissor Slot' }, { key: 'Material', value: 'Impact Resistant ABS Plastic' }, { key: 'Theme', value: 'Space Astronaut Theme' }],
      tags: ['pencil box', 'magnetic box', 'school stationery', 'kids box']
    },
    {
      name: 'Dual-Tip Watercolor Brush Markers & Fine Liner Pens Set (24 Shades)',
      price: 899,
      discountPrice: 449,
      stock: 45,
      characteristics: [{ key: 'Tips', value: '0.4mm Fine Tip + 1-2mm Flexible Brush Tip' }, { key: 'Ink', value: 'Water-Based Odorless Non-Bleeding Ink' }, { key: 'Case', value: 'Durable Travel Organizer Box' }],
      tags: ['brush pens', 'markers', 'art supplies', 'calligraphy']
    },
    {
      name: 'Pastel Retractable Erasable Gel Ink Pens with Thermo-Sensitive Ink (8 Pcs)',
      price: 499,
      discountPrice: 249,
      stock: 70,
      characteristics: [{ key: 'Feature', value: 'Write, Erase & Rewrite without Smudging' }, { key: 'Nib', value: '0.5mm Smooth Precision Needle Point' }, { key: 'Shades', value: '8 Aesthetic Macaron Pastel Colors' }],
      tags: ['erasable pens', 'gel pens', 'pastel stationery', 'pens']
    },
    {
      name: 'Cute Animal Theme Sticky Notes & Index Page Flags Book (Set of 600 Sheets)',
      price: 399,
      discountPrice: 199,
      stock: 80,
      characteristics: [{ key: 'Sheets', value: '600 Self-Adhesive Sticky Strips' }, { key: 'Use', value: 'Book Annotations, Bookmark Flags & Notes' }, { key: 'Adhesive', value: 'Leaves Zero Sticky Residue on Pages' }],
      tags: ['sticky notes', 'page flags', 'index tabs', 'stationery']
    },
    {
      name: 'Spiral Bound Hardcover Artist Sketchbook Heavyweight 160 GSM (100 Pages)',
      price: 699,
      discountPrice: 379,
      stock: 50,
      characteristics: [{ key: 'Paper', value: '160 GSM Acid-Free Textured Cartridge Paper' }, { key: 'Media', value: 'Pencil, Charcoal, Ink, Pastels & Light Wash' }, { key: 'Binding', value: 'Twin-Wire 360 Lay-Flat Spine' }],
      tags: ['sketchbook', 'drawing book', 'art book', '160 gsm']
    }
  ],
  'School accessories': [
    {
      name: 'Ergonomic Water-Resistant Multi-Pocket School Backpack for Kids',
      price: 1899,
      discountPrice: 999,
      stock: 35,
      characteristics: [{ key: 'Capacity', value: '25 Liters with Laptop / Tablet Sleeve' }, { key: 'Straps', value: 'Padded Honeycomb S-Curve Shoulder Straps' }, { key: 'Pockets', value: '4 Zipper Compartments + 2 Bottle Mesh' }],
      tags: ['school bag', 'backpack', 'waterproof bag', 'kids bag']
    },
    {
      name: 'Insulated Stainless Steel Bento Lunch Box with Leak-Proof Dip Container',
      price: 1299,
      discountPrice: 699,
      stock: 45,
      characteristics: [{ key: 'Interior', value: 'Food-Grade SUS304 Stainless Steel' }, { key: 'Compartments', value: '3 Portion Controlled Sections' }, { key: 'Insulation', value: 'Keeps Food Warm for up to 4 Hours' }],
      tags: ['lunch box', 'bento box', 'steel lunch box', 'tiffin']
    },
    {
      name: 'BPA-Free Motivational Time Marker Sipper Water Bottle (750ml)',
      price: 599,
      discountPrice: 299,
      stock: 60,
      characteristics: [{ key: 'Capacity', value: '750ml Gradient Frost Body' }, { key: 'Cap', value: 'One-Click Flip Top with Straw' }, { key: 'Safety', value: '100% BPA & Toxic Free Tritan' }],
      tags: ['water bottle', 'sipper', 'school bottle', 'bpa free']
    },
    {
      name: 'Waterproof Silicone Cartoon Luggage & School Bag ID Tags (Pack of 4)',
      price: 349,
      discountPrice: 179,
      stock: 75,
      characteristics: [{ key: 'Material', value: 'Durable Washable Soft Silicone' }, { key: 'Card', value: 'Name, Phone & Address Information Card' }, { key: 'Loop', value: 'Reinforced Snap Loop Strap' }],
      tags: ['bag tags', 'name tags', 'luggage tags', 'school accessories']
    },
    {
      name: 'Lightweight Foldable Rain Poncho with Expandable Backpack Pocket',
      price: 699,
      discountPrice: 349,
      stock: 50,
      characteristics: [{ key: 'Feature', value: 'Back Gusset Expands to Cover School Bag' }, { key: 'Hood', value: 'Transparent Peak Brim Visor' }, { key: 'Pouch', value: 'Folds Into Compact Waterproof Zipper Pouch' }],
      tags: ['raincoat', 'rain poncho', 'school raincoat', 'waterproof']
    }
  ],
  'Resistance bands': [
    {
      name: 'Set of 5 Stackable Tube Resistance Bands with Door Anchor & Ankle Straps (150 LBS)',
      price: 1499,
      discountPrice: 799,
      stock: 40,
      characteristics: [{ key: 'Tension', value: '10 lbs to 50 lbs (Total 150 lbs)' }, { key: 'Material', value: '100% Natural Malaysian Latex' }, { key: 'Accessories', value: '2 Cushioned Handles, 2 Ankle Straps, 1 Door Anchor' }],
      tags: ['resistance bands', 'home workout', 'gym bands', 'fitness']
    },
    {
      name: 'Fabric Non-Slip Booty Hip Circle Resistance Bands (Set of 3 Strengths)',
      price: 999,
      discountPrice: 499,
      stock: 50,
      characteristics: [{ key: 'Levels', value: 'Light, Medium, Heavy' }, { key: 'Grip', value: 'Inner Rubberized Grip Stripes (No Rolling)' }, { key: 'Material', value: 'Soft Cotton Polyester Blend' }],
      tags: ['booty bands', 'fabric resistance bands', 'glute bands', 'squats']
    },
    {
      name: 'Heavy Duty Pull-Up Assist Elastic Loop Power Resistance Band',
      price: 899,
      discountPrice: 449,
      stock: 45,
      characteristics: [{ key: 'Assistance', value: '35 to 85 lbs Elastic Resistance' }, { key: 'Length', value: '208cm Continuous Seamless Loop' }, { key: 'Use', value: 'Pull-Up Training, Stretching & Calisthenics' }],
      tags: ['pull up band', 'power band', 'calisthenics', 'exercise']
    },
    {
      name: 'Figure-8 Ergonomic Arm & Chest Expander Workout Resistance Band',
      price: 499,
      discountPrice: 249,
      stock: 60,
      characteristics: [{ key: 'Shape', value: 'Figure 8 Soft Foam Grip Tubes' }, { key: 'Target', value: 'Biceps, Triceps, Shoulders & Chest' }, { key: 'Portability', value: 'Featherlight 120g' }],
      tags: ['figure 8 band', 'chest expander', 'arm workout']
    },
    {
      name: 'Portable Home Workout Pilates Resistance Bar Kit with Dual Foot Loops',
      price: 1399,
      discountPrice: 749,
      stock: 35,
      characteristics: [{ key: 'Bar', value: 'Steel Rod with Thick Anti-Slip Foam' }, { key: 'Detachable', value: '3-Piece Push Button Quick Assembly' }, { key: 'Exercise', value: 'Pilates, Squats, Yoga & Full Body Toning' }],
      tags: ['pilates bar', 'toning bar', 'home gym', 'resistance kit']
    }
  ],
  'Yoga accessories': [
    {
      name: '6mm Extra Thick Eco-Friendly Anti-Skid TPE Yoga Mat with Carry Strap',
      price: 1899,
      discountPrice: 999,
      stock: 40,
      characteristics: [{ key: 'Thickness', value: '6mm High-Density Joint Cushioning' }, { key: 'Material', value: 'Non-Toxic Recyclable TPE Rubber' }, { key: 'Grip', value: 'Dual Sided Wave & Diamond Anti-Skid Texture' }],
      tags: ['yoga mat', 'tpe mat', 'anti skid mat', 'fitness mat']
    },
    {
      name: 'High-Density EVA Foam Yoga Blocks & Cotton Stretching Strap Combo Set',
      price: 899,
      discountPrice: 449,
      stock: 50,
      characteristics: [{ key: 'Set Includes', value: '2 Beveled Yoga Blocks + 1 D-Ring Cotton Strap' }, { key: 'Block Weight', value: '180g Ultra-Dense Support' }, { key: 'Benefits', value: 'Deepens Poses & Alignment Stability' }],
      tags: ['yoga block', 'stretching strap', 'yoga accessories', 'props']
    },
    {
      name: 'Deep Tissue Muscle Trigger Point Foam Roller for Post-Workout Recovery (45cm)',
      price: 1199,
      discountPrice: 599,
      stock: 35,
      characteristics: [{ key: 'Pattern', value: 'Multi-Density 3D Grid Knobs' }, { key: 'Core', value: 'Rigid PVC Inner Tube (Holds up to 150 kg)' }, { key: 'Therapy', value: 'Relieves Muscle Soreness & Back Stiffness' }],
      tags: ['foam roller', 'muscle roller', 'recovery', 'physiotherapy']
    },
    {
      name: 'Non-Slip Breathable Grip Yoga Socks with Silicone Dots (Pack of 2 Pairs)',
      price: 499,
      discountPrice: 249,
      stock: 65,
      characteristics: [{ key: 'Grip', value: '100% Anti-Slip Silicone Bottom Dots' }, { key: 'Fabric', value: 'Combed Breathable Terry Cotton' }, { key: 'Use', value: 'Pilates, Barre, Yoga & Hospital Wear' }],
      tags: ['yoga socks', 'grip socks', 'anti slip socks', 'pilates']
    },
    {
      name: 'Microfiber Super Absorbent Hot Yoga Towel with Non-Slip Silicone Backing',
      price: 999,
      discountPrice: 499,
      stock: 45,
      characteristics: [{ key: 'Absorption', value: 'Absorbs 7X its Weight in Sweat' }, { key: 'Size', value: 'Full Mat Cover (183cm x 61cm)' }, { key: 'Drying', value: 'Quick Dry Antibacterial Microfiber' }],
      tags: ['yoga towel', 'sweat absorbent', 'hot yoga', 'mat towel']
    }
  ],
  Bottles: [
    {
      name: '1 Liter Vacuum Insulated Stainless Steel Cold & Hot Thermos Flask (24H Cold)',
      price: 1499,
      discountPrice: 799,
      stock: 45,
      characteristics: [{ key: 'Insulation', value: 'Double Wall Vacuum Copper Plating' }, { key: 'Performance', value: '24 Hours Chilled, 12 Hours Steaming Hot' }, { key: 'Steel Grade', value: 'Pro-Grade 18/8 (SUS 304) Stainless Steel' }],
      tags: ['thermos flask', 'steel bottle', 'insulated bottle', 'water bottle']
    },
    {
      name: '2 Liter Large Motivational Time Marker Gym Water Bottle with Straw & Handle',
      price: 999,
      discountPrice: 499,
      stock: 55,
      characteristics: [{ key: 'Capacity', value: '2000ml (64 Oz) Daily Water Goal' }, { key: 'Markers', value: 'Motivational Quotes & Hourly Time Ticks' }, { key: 'Straw', value: 'Removable Silicone Pop-Up Straw' }],
      tags: ['gym bottle', '2 liter bottle', 'motivational bottle', 'gallon jug']
    },
    {
      name: 'Leakproof Protein Shaker Bottle with Stainless Wire Whisk Ball (700ml)',
      price: 599,
      discountPrice: 299,
      stock: 65,
      characteristics: [{ key: 'Mixer', value: '316 Surgical Grade Wire Whisk Ball' }, { key: 'Lid', value: 'Screw-On Top with Flip Cap & StayOpen Loop' }, { key: 'Markings', value: 'Embossed Milliliter & Ounce Scales' }],
      tags: ['shaker bottle', 'protein shaker', 'gym bottle', 'leakproof']
    },
    {
      name: 'Collapsible Food-Grade Silicone Travel Water Bottle with Carabiner (600ml)',
      price: 699,
      discountPrice: 349,
      stock: 50,
      characteristics: [{ key: 'Foldable', value: 'Rolls Down to 1/3rd Size When Empty' }, { key: 'Material', value: '100% Platinum Cured Silicone (BPA Free)' }, { key: 'Carabiner', value: 'Clip to Backpack for Hiking & Flights' }],
      tags: ['collapsible bottle', 'travel bottle', 'silicone bottle', 'hiking']
    },
    {
      name: 'Fruit Infuser Detox Sports Water Bottle with Full Length Infusion Rod (800ml)',
      price: 799,
      discountPrice: 399,
      stock: 40,
      characteristics: [{ key: 'Infuser Rod', value: 'Extra Long Chamber for Lemons, Mints & Berries' }, { key: 'Material', value: 'Shatter-Resistant Crystal Clear Eastman Tritan' }, { key: 'Grip', value: 'Rubberized Dual Side Finger Grips' }],
      tags: ['infuser bottle', 'detox bottle', 'fruit water', 'sports bottle']
    }
  ]
};

// Map of slug / SKU prefixes
const SKU_PREFIXES = {
  Sarees: 'SAR',
  Kurtis: 'KUR',
  Leggings: 'LEG',
  Nightwear: 'NGT',
  Dupattas: 'DUP',
  'Storage boxes': 'BOX',
  Choppers: 'CHP',
  Organizers: 'ORG',
  Cookware: 'CKW',
  Earrings: 'EAR',
  Chains: 'CHN',
  Bangles: 'BGL',
  'Necklace sets': 'NCK',
  'Hair accessories': 'HAR',
  Skincare: 'SKN',
  'Herbal products': 'HRB',
  Cases: 'CAS',
  Chargers: 'CHG',
  Cables: 'CBL',
  Stands: 'STN',
  Earbuds: 'EBD',
  'Sungudi sarees': 'SNG',
  'Brass items': 'BRS',
  'Tanjore crafts': 'TNJ',
  Murukku: 'MRK',
  Mixture: 'MIX',
  Pickles: 'PCK',
  Podi: 'POD',
  Sweets: 'SWT',
  'Wall décor': 'WAL',
  'Artificial plants': 'PLN',
  Lamps: 'LMP',
  Toys: 'TOY',
  Stationery: 'STN',
  'School accessories': 'SCH',
  'Resistance bands': 'RST',
  'Yoga accessories': 'YOG',
  Bottles: 'BTL',
};

// Helper: Slug generator
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 6);
}

// Memory cache for uploaded photo URLs to avoid redundant S3 uploads
const uploadedPhotoCache = new Map();

async function getOrUploadS3Image(sourceUrl, subCategoryName) {
  if (uploadedPhotoCache.has(sourceUrl)) {
    return uploadedPhotoCache.get(sourceUrl);
  }

  try {
    const resp = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const folder = 'products/' + subCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const uploaded = await s3Service.uploadImage(buffer, folder, 'image/webp');
    if (uploaded && uploaded.url) {
      uploadedPhotoCache.set(sourceUrl, uploaded.url);
      return uploaded.url;
    }
  } catch (err) {
    console.warn(`[S3 WARN] Failed to upload ${sourceUrl}: ${err.message}. Using source fallback.`);
  }

  return sourceUrl;
}

async function seedAllProducts() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB Atlas');

  const categories = await Category.find({}).lean();
  const subCategories = await SubCategory.find({}).populate('categoryId').lean();

  console.log(`Found ${categories.length} Categories and ${subCategories.length} Sub-Categories in Database.\n`);

  let totalProductsCreated = 0;
  let totalInventoriesCreated = 0;

  for (let sIdx = 0; sIdx < subCategories.length; sIdx++) {
    const subCat = subCategories[sIdx];
    const category = subCat.categoryId;
    const subName = subCat.name;

    console.log(`\n--------------------------------------------------------------`);
    console.log(`[${sIdx + 1}/${subCategories.length}] SubCategory: "${subName}" (Category: "${category?.name}")`);

    // Look up product definitions
    let prodDefs = PRODUCTS_CATALOG[subName];
    if (!prodDefs) {
      // Fallback generator if exact match not defined
      prodDefs = Array.from({ length: 5 }).map((_, i) => ({
        name: `Premium ${subName} Product ${i + 1}`,
        price: 999 + (i * 200),
        discountPrice: 599 + (i * 150),
        stock: 25 + (i * 5),
        characteristics: [{ key: 'Type', value: subName }, { key: 'Quality', value: 'Export Standard' }],
        tags: [subName.toLowerCase(), 'premium', 'authentic'],
      }));
    }

    const photoPool = PHOTO_POOLS[subName] || PHOTO_POOLS['Storage boxes'];
    const prefix = SKU_PREFIXES[subName] || 'PRD';

    for (let pIdx = 0; pIdx < prodDefs.length; pIdx++) {
      const def = prodDefs[pIdx];
      const photoUrl = photoPool[pIdx % photoPool.length];

      // 1. Upload primary image to S3
      console.log(`  -> [${pIdx + 1}/5] Uploading image & creating product: "${def.name.slice(0, 45)}..."`);
      const s3ImageUrl = await getOrUploadS3Image(photoUrl, subName);

      const sku = `${prefix}-${String(pIdx + 1).padStart(3, '0')}`;
      const slug = generateSlug(def.name);

      // 2. Create Product Document
      const product = await Product.create({
        name: def.name,
        slug,
        description: `${def.name} - Handcrafted with premium grade materials ensuring supreme durability, authentic style, and outstanding performance. A top-rated essential for your collection.`,
        shortDescription: `Premium quality ${subName} offering exceptional value, durability, and customer satisfaction.`,
        category: category._id,
        subCategory: subName,
        sku,
        images: [s3ImageUrl],
        price: def.price,
        discountPrice: def.discountPrice,
        stock: def.stock,
        characteristics: def.characteristics,
        variants: {
          type: ['Sarees', 'Kurtis', 'Leggings', 'Nightwear'].includes(subName) ? 'size' : 'none',
          options: ['Sarees', 'Kurtis', 'Leggings', 'Nightwear'].includes(subName) ? ['S', 'M', 'L', 'XL'] : [],
          default: ['Sarees', 'Kurtis', 'Leggings', 'Nightwear'].includes(subName) ? 'M' : '',
        },
        tags: def.tags,
        isActive: true,
        isFeatured: pIdx === 0, // Mark first of each subcategory as featured!
        sortOrder: pIdx,
      });
      totalProductsCreated++;

      // 3. Create Corresponding Inventory Document
      await Inventory.create({
        product: product._id,
        sku: product.sku,
        quantity: product.stock,
        reserved: 0,
        sold: 0,
        lowStockThreshold: 5,
      });
      totalInventoriesCreated++;
    }
  }

  console.log(`\n==============================================================`);
  console.log(`🎉 ALL 39 SUBCATEGORIES SEEDED SUCCESSFULLY!`);
  console.log(`Total Products Created:    ${totalProductsCreated}`);
  console.log(`Total Inventories Created: ${totalInventoriesCreated}`);
  console.log(`Images Uploaded to AWS S3: ${uploadedPhotoCache.size} unique S3 assets`);
  console.log(`==============================================================`);

  await mongoose.disconnect();
}

seedAllProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error seeding products:', err);
    process.exit(1);
  });

const DEFAULT_TAMIL_NADU_PINCODES = [
  // Chennai & Suburban (600xxx)
  '600001', '600002', '600003', '600004', '600005', '600006', '600018', '600028', '600034', '600040', '600096', '600100',
  // Thanjavur / Pattukkottai / Peravurani / Kumbakonam (612xxx - 614xxx)
  '614602', '614804', '614601', '614612', '614701', '613001', '613007', '612001', '612002',
  // Tiruchirappalli / Trichy (620xxx - 621xxx)
  '620001', '620002', '620017', '620020', '621212', '621704',
  // Madurai (625xxx)
  '625001', '625002', '625016', '625020', '625531',
  // Coimbatore & Tirupur (641xxx)
  '641001', '641002', '641012', '641018', '641601', '641604',
  // Salem & Erode (636xxx - 638xxx)
  '636001', '636007', '638001', '638009', '638012',
  // Tirunelveli & Thoothukudi (627xxx - 628xxx)
  '627001', '627002', '627811', '628001', '628002',
  // Kanyakumari / Nagercoil (629xxx)
  '629001', '629002', '629165',
  // Vellore & Ranipet (632xxx)
  '632001', '632004', '632401', '635601',
  // Kanchipuram & Chengalpattu (603xxx - 631xxx)
  '603001', '603103', '631501', '631502',
  // Cuddalore, Villupuram, Tiruvannamalai (605xxx - 607xxx)
  '605602', '606202', '606601', '607001',
  // Pudukkottai, Sivaganga, Ramanathapuram (622xxx - 630xxx)
  '622001', '623501', '630561',
  // Dindigul, Theni, Virudhunagar (624xxx - 626xxx)
  '624001', '626001',
  // Dharmapuri & Krishnagiri / Hosur (635xxx - 636xxx)
  '635001', '635109', '636701',
  // Nilgiris / Ooty (643xxx)
  '643001', '643002',
  // Karur, Namakkal, Mayiladuthurai, Tiruvarur, Nagapattinam (609xxx - 639xxx)
  '609001', '610001', '611001', '637001', '639001'
];

const DEFAULT_INDIA_STATES = [
  {
    id: 'karnataka',
    stateName: 'Karnataka',
    shippingFee: 70,
    estimatedDays: '3-5 Business Days',
    pincodes: ['560001', '560002', '560025', '560034', '560037', '560068', '560095', '560100', '570001', '575001', '580020', '590001'],
  },
  {
    id: 'kerala',
    stateName: 'Kerala',
    shippingFee: 70,
    estimatedDays: '3-5 Business Days',
    pincodes: ['682001', '682016', '682030', '695001', '695004', '673001', '680001', '670001', '686001', '688001'],
  },
  {
    id: 'andhra_telangana',
    stateName: 'Andhra Pradesh & Telangana',
    shippingFee: 75,
    estimatedDays: '3-5 Business Days',
    pincodes: ['500001', '500003', '500018', '500034', '500081', '530001', '520001', '522001', '517501', '506001'],
  },
  {
    id: 'maharashtra',
    stateName: 'Maharashtra',
    shippingFee: 90,
    estimatedDays: '4-6 Business Days',
    pincodes: ['400001', '400050', '400076', '400092', '411001', '411014', '411038', '411057', '440001', '422001', '431001'],
  },
  {
    id: 'delhi_ncr',
    stateName: 'Delhi & NCR',
    shippingFee: 95,
    estimatedDays: '4-6 Business Days',
    pincodes: ['110001', '110016', '110020', '110092', '110085', '201301', '122001', '121001'],
  },
  {
    id: 'gujarat',
    stateName: 'Gujarat',
    shippingFee: 95,
    estimatedDays: '4-6 Business Days',
    pincodes: ['380001', '380015', '395001', '390001', '360001', '361001'],
  },
  {
    id: 'rest_of_india',
    stateName: 'Rest of India',
    shippingFee: 110,
    estimatedDays: '5-7 Business Days',
    pincodes: ['700001', '700019', '302001', '141001', '226001', '800001', '751001', '781001'],
  },
];

module.exports = {
  DEFAULT_TAMIL_NADU_PINCODES,
  DEFAULT_INDIA_STATES,
};

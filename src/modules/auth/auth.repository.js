const User = require('../../models/user.model');

const AuthRepository = {
  findByPhone: (phone) => User.findOne({ phone }).lean(),
  findById: (id) => User.findById(id).lean(),
  createUser: (phone) => User.create({ phone }),
  updateUser: (id, data) => User.findByIdAndUpdate(id, data, { new: true }).lean(),
};

module.exports = AuthRepository;

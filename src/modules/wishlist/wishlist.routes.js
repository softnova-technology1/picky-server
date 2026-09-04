const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { toggleWishlistSchema, mergeWishlistSchema } = require('./wishlist.schema');

router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/toggle', validate(toggleWishlistSchema), wishlistController.toggleItem);
router.post('/merge', validate(mergeWishlistSchema), wishlistController.mergeWishlist);
router.delete('/items/:productId', wishlistController.removeItem);

module.exports = router;

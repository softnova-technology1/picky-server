const Customization = require('../../models/customization.model');
const { ApiResponse } = require('../../utils/apiResponse');
const customizationSse = require('../../utils/customizationSse');

const { deleteImage } = require('../../services/s3.service');

const getAllCustomizations = async (req, res, next) => {
  try {
    const customizations = await Customization.find();
    
    // Transform array into a record keyed by pageId
    const pageSections = {};
    customizations.forEach((c) => {
      pageSections[c.pageId] = c.sections;
    });

    return res.json(ApiResponse.success(pageSections));
  } catch (err) {
    next(err);
  }
};

const updateCustomization = async (req, res, next) => {
  try {
    const { pageId, sections } = req.body;
    
    if (!pageId || !sections) {
      return res.status(400).json(ApiResponse.error('pageId and sections are required', 400));
    }

    // Detect removed S3 images from previous document and delete them from S3
    try {
      const existing = await Customization.findOne({ pageId });
      if (existing && Array.isArray(existing.sections)) {
        const collectImages = (list) => {
          const urls = new Set();
          for (const s of list || []) {
            if (!s?.settings) continue;
            for (const [k, v] of Object.entries(s.settings)) {
              if (typeof v === 'string' && (v.includes('http') || v.includes('/uploads/'))) {
                urls.add(v);
              }
              if (k === 'slides' && Array.isArray(v)) {
                for (const sl of v) {
                  if (typeof sl?.leftImage === 'string' && (sl.leftImage.includes('http') || sl.leftImage.includes('/uploads/'))) {
                    urls.add(sl.leftImage);
                  }
                  if (typeof sl?.rightImage === 'string' && (sl.rightImage.includes('http') || sl.rightImage.includes('/uploads/'))) {
                    urls.add(sl.rightImage);
                  }
                }
              }
            }
          }
          return urls;
        };

        const oldUrls = collectImages(existing.sections);
        const newUrls = collectImages(sections);

        for (const oldUrl of oldUrls) {
          if (!newUrls.has(oldUrl)) {
            deleteImage(oldUrl).catch(() => {});
          }
        }
      }
    } catch (_) {}

    const customization = await Customization.findOneAndUpdate(
      { pageId },
      { $set: { sections } },
      { new: true, upsert: true }
    );

    // Instant Real-Time Push to all connected storefront clients & devices
    customizationSse.broadcastCustomization(pageId, sections);

    return res.json(ApiResponse.success(customization, 'Customization updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * Explicitly clear an image in MongoDB customization and delete it from AWS S3
 */
const clearCustomizationImage = async (req, res, next) => {
  try {
    const { pageId, sectionId, slideIndex, slideId, imageField, imageUrl } = req.body;

    if (!pageId || !sectionId || !imageField) {
      return res.status(400).json(ApiResponse.error('pageId, sectionId and imageField are required', 400));
    }

    // 1. Delete image from AWS S3 bucket and local disk fallback if URL exists
    if (imageUrl) {
      try {
        await deleteImage(imageUrl);
      } catch (s3Err) {
        console.warn(`[S3 Delete Warning] Failed to delete image from S3: ${s3Err.message}`);
      }
    }

    // 2. Clear image in MongoDB Customization document
    let updatedSections = null;
    const customization = await Customization.findOne({ pageId });
    if (customization && Array.isArray(customization.sections)) {
      const sectionIndex = customization.sections.findIndex((s) => s.id === sectionId || s.key === sectionId);
      if (sectionIndex !== -1) {
        const sec = customization.sections[sectionIndex];
        sec.settings = sec.settings || {};

        if (slideIndex !== undefined || slideId) {
          sec.settings.slides = sec.settings.slides || [];
          const sIdx = slideIndex !== undefined && slideIndex >= 0
            ? Number(slideIndex)
            : sec.settings.slides.findIndex((sl) => sl.id === slideId);

          if (sIdx !== -1 && sec.settings.slides[sIdx]) {
            const existingSlideImg = sec.settings.slides[sIdx][imageField];
            if (existingSlideImg && existingSlideImg !== imageUrl) {
              await deleteImage(existingSlideImg).catch(() => {});
            }
            sec.settings.slides[sIdx][imageField] = '';

            // If slide 1 leftImage is cleared, also clear top-level imageUrl legacy field
            if (sIdx === 0 && imageField === 'leftImage') {
              sec.settings.imageUrl = '';
            }
          }
        } else {
          const existingImg = sec.settings[imageField];
          if (existingImg && existingImg !== imageUrl) {
            await deleteImage(existingImg).catch(() => {});
          }
          sec.settings[imageField] = '';
        }

        customization.markModified('sections');
        await customization.save();
        updatedSections = customization.sections;

        // Broadcast real-time update
        customizationSse.broadcastCustomization(pageId, customization.sections);
      }
    }

    return res.json(
      ApiResponse.success(
        { pageId, sectionId, imageField, cleared: true, sections: updatedSections },
        'Image deleted from S3 bucket and cleared in database'
      )
    );
  } catch (err) {
    next(err);
  }
};

// SSE Stream Handler for real-time live synchronization
const streamCustomizationUpdates = (req, res) => {
  customizationSse.addClient(req, res);
};

module.exports = {
  getAllCustomizations,
  updateCustomization,
  clearCustomizationImage,
  streamCustomizationUpdates,
};


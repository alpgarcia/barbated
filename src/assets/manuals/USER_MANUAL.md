# Barbated User Manual

## Table of Contents
- [Customizing Your Card Image](#customizing-your-card-image)

## Customizing Your Card Image

This section explains how to use your own images on the card and how they are displayed.

### Image Upload and Processing

You can upload a custom image to personalize your card.

*   **Local Processing**: Your image is processed directly in your web browser. It is not uploaded to any external server, ensuring your privacy and quick processing.
*   **Recommended Format**: For the best visual quality and sharpness, especially when scaling, using SVG (Scalable Vector Graphics) images is highly recommended. PNG and JPG formats are also supported.

### Image Scaling and Cropping

The image area on the card has a fixed aspect ratio of 80:37 (width:height). To ensure your custom image fits this area correctly, the application uses a specific scaling and cropping mechanism, technically known as `preserveAspectRatio="xMidYMid slice"` in SVG terminology. Here’s what that means for your image:

1.  **Aspect Ratio Preservation**: The original aspect ratio (the proportional relationship between its width and height) of your uploaded image is always maintained. The image will not be stretched or squashed.
2.  **Scale to Cover**: The image is scaled uniformly (maintaining its aspect ratio) until it is large enough to completely cover the 80mm wide by 37mm high image area on the card. This means either the width or the height of your image will match the corresponding dimension of the card's image area, and the other dimension will be equal to or larger than what's needed to cover the area.
3.  **Centering**: After scaling, the image is centered horizontally and vertically within the 80x37 image area.
4.  **Cropping**: Any parts of the image that extend beyond the boundaries of the 80x37 image area are cropped (not visible). This ensures that the image area is always fully filled by your image, but it might mean some parts of your original image are cut off if its aspect ratio is different from 80:37.

### Achieving the Best Fit

*   **Optimal Aspect Ratio**: To ensure your image appears exactly as you intend without any cropping, it's best to use an image with an aspect ratio of **80:37**. For example, an image that is 800 pixels wide and 370 pixels high (or any other dimensions maintaining this ratio, like 1600x740px) would fit perfectly.
*   **High Resolution**: If using raster formats like PNG or JPG, provide a high-resolution image (e.g., 300 DPI is good for printing) to maintain clarity, especially if the image needs to be scaled up.

By understanding these points, you can better prepare your custom images for the card.

---
[Back to Top](#barbated-user-manual)

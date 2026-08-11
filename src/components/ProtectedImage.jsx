import React from 'react';
import './ProtectedImage.css';

const ProtectedImage = ({
  src,
  alt,
  className = '',
  imageStyle,
  containerStyle,
  watermarkText = 'LAZEO STORE',
  watermark = true,
  loading = 'lazy'
}) => {
  if (!src) {
    return null;
  }

  return (
    <div className="protected-image-wrapper" style={containerStyle}>
      <img
        src={src}
        alt={alt}
        className={`protected-image ${className}`.trim()}
        style={imageStyle}
        loading={loading}
        draggable={false}
        data-protected-image="true"
      />
      {watermark ? (
        <div className="protected-image-watermark" aria-hidden="true">
          {watermarkText}
        </div>
      ) : null}
    </div>
  );
};

export default ProtectedImage;
import React from 'react';

const toneMap = {
  success: {
    background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12), rgba(34, 197, 94, 0.08))',
    border: '1px solid rgba(22, 163, 74, 0.2)',
    color: '#166534',
  },
  error: {
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(248, 113, 113, 0.08))',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#991b1b',
  },
  info: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(96, 165, 250, 0.08))',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    color: '#1d4ed8',
  },
};

const ActionBanner = ({ type = 'info', title, message, onClose }) => {
  if (!message) return null;

  const tone = toneMap[type] || toneMap.info;

  return (
    <div
      style={{
        marginBottom: '18px',
        padding: '14px 16px',
        borderRadius: '12px',
        background: tone.background,
        border: tone.border,
        color: tone.color,
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <div>
        {title && <strong style={{ display: 'block', marginBottom: '4px' }}>{title}</strong>}
        <span style={{ lineHeight: 1.6 }}>{message}</span>
      </div>
      {onClose && (
        <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '6px 12px' }}>
          إغلاق
        </button>
      )}
    </div>
  );
};

export default ActionBanner;

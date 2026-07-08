import React from 'react';

const Modal = ({ open, title, children, onClose, actions }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: '18px',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="btn-secondary" onClick={onClose}>إغلاق</button>
        </div>
        <div style={{ lineHeight: 1.8, color: '#334155', overflowY: 'auto', paddingRight: '4px' }}>{children}</div>
        {actions && <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </div>
  );
};

export default Modal;

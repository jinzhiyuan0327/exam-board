import React from 'react';

/**
 * 统一水印（左下角，不阻挡交互）。仅用于登录页与管理页。
 */
export default function Watermark() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 14,
        bottom: 10,
        zIndex: 9999,
        fontSize: 12,
        lineHeight: 1,
        letterSpacing: 0.4,
        color: 'rgba(130,140,155,0.42)',
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: '"Microsoft YaHei","PingFang SC","Noto Sans SC",system-ui,sans-serif',
      }}
    >
      Created By PikaNova 2026
    </div>
  );
}

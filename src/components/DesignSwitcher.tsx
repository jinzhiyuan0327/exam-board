import React, { useEffect } from 'react';
import { DESIGNS } from '../designs/registry';
import '../styles/design-switcher.css';

interface Props {
  open: boolean;
  onClose: () => void;
  currentId: string;
  onSelect: (id: string) => void;
}

/**
 * 展示设计切换窗：受控的居中弹窗。由各大屏设计顶栏的“▣ 切换设计”按钮触发，
 * 不再使用悬浮按钮，避免遮挡大屏元素。切换不影响底层数据链接。
 */
export default function DesignSwitcher({ open, onClose, currentId, onSelect }: Props) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dsw-overlay" role="dialog" aria-modal="true" aria-label="展示设计切换" onClick={onClose}>
      <div className="dsw-window" onClick={e => e.stopPropagation()}>
        <div className="dsw-window__bar">
          <span className="dsw-window__title">选择展示设计</span>
          <button className="dsw-window__close" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <div className="dsw-window__body">
          {DESIGNS.map(d => {
            const active = d.id === currentId;
            return (
              <button
                key={d.id}
                className={`dsw-card ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(d.id)}
                aria-pressed={active}
              >
                <span className="dsw-card__thumb">
                  <img src={d.thumb} alt={`${d.name} 样例`} loading="lazy" draggable={false} />
                  {active && <span className="dsw-card__check" aria-hidden="true">✓</span>}
                </span>
                <span className="dsw-card__meta">
                  <span className="dsw-card__name">{d.name}{active && <span className="dsw-card__badge">当前</span>}</span>
                  <span className="dsw-card__desc">{d.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="dsw-window__foot">
          <span className="dsw-window__hint">选中后即时生效</span>
          <button className="dsw-done" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}

import type { DesignMeta } from './types';
import CommandDeck from './CommandDeck';
import CleanFocus from './CleanFocus';
import Blackboard from './Blackboard';
import Emergency from './Emergency';
import Editorial from './Editorial';
import { DESIGN_THUMBS } from './previews';

/**
 * 多版设计注册表。所有方案只消费统一的 ExamViewModel（保留 Neon 数据链接 / 校时 / 通知）。
 * 后续接入新设计时，只需新增一个组件文件、在 previews.ts 补一张缩略图，并在此数组里追加一项即可，
 * 切换窗会自动列出。
 */
export const DESIGNS: DesignMeta[] = [
  { id: 'command-deck', name: '深色指挥舱', description: '深蓝黑、高信息密度，适合长时间运行的大屏。', component: CommandDeck, thumb: DESIGN_THUMBS['command-deck'] },
  { id: 'clean-focus', name: '清爽聚焦', description: '白底考试蓝、低压力，适合明亮教室与投影。', component: CleanFocus, thumb: DESIGN_THUMBS['clean-focus'] },
  { id: 'blackboard', name: '校园黑板', description: '黑板绿 + 暖白、圆形进度环，传统庄重氛围。', component: Blackboard, thumb: DESIGN_THUMBS['blackboard'] },
  { id: 'emergency', name: '高对比应急', description: '高亮 LED、顶部状态条，远距离极速辨识。', component: Emergency, thumb: DESIGN_THUMBS['emergency'] },
  { id: 'editorial', name: '编辑排版', description: '三栏版式、朱红秒数，适合大厅与展板。', component: Editorial, thumb: DESIGN_THUMBS['editorial'] },
];

export const DEFAULT_DESIGN_ID = DESIGNS[0].id;

export function getDesign(id: string | null | undefined): DesignMeta {
  return DESIGNS.find(d => d.id === id) ?? DESIGNS[0];
}

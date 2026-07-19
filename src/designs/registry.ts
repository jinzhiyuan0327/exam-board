import type { DesignMeta } from './types';
import CommandDeck from './CommandDeck'; import CleanFocus from './CleanFocus'; import Blackboard from './Blackboard'; import Emergency from './Emergency'; import Editorial from './Editorial';
import { SunriseSchedule, PaletteDashboard, OrbitFocus, PeachTaskBoard, PosterGrid, IceColumns } from './LightDesigns';
import { DESIGN_THUMBS } from './previews';
export const DESIGNS: DesignMeta[] = [
 {id:'command-deck',name:'深色指挥舱',description:'深蓝黑、高信息密度，适合长时间运行的大屏。',theme:'dark',component:CommandDeck,thumb:DESIGN_THUMBS['command-deck']},
 {id:'blackboard',name:'校园黑板',description:'黑板绿 + 暖白、圆形进度环，传统庄重氛围。',theme:'dark',component:Blackboard,thumb:DESIGN_THUMBS['blackboard']},
 {id:'emergency',name:'高对比应急',description:'高亮 LED、顶部状态条，远距离极速辨识。',theme:'dark',component:Emergency,thumb:DESIGN_THUMBS['emergency']},
 {id:'clean-focus',name:'清爽聚焦',description:'白底考试蓝、低压力，适合明亮教室与投影。',theme:'light',component:CleanFocus,thumb:DESIGN_THUMBS['clean-focus']},
 {id:'editorial',name:'编辑排版',description:'三栏版式、朱红秒数，适合大厅与展板。',theme:'light',component:Editorial,thumb:DESIGN_THUMBS['editorial']},
 {id:'sunrise-schedule',name:'晨光日程',description:'浅天蓝与晨光黄，主时钟配右侧进度卡。',theme:'light',component:SunriseSchedule,thumb:DESIGN_THUMBS['sunrise-schedule']},
 {id:'palette-dashboard',name:'色卡仪表盘',description:'暖白大面板与四象限色卡，信息清晰有序。',theme:'light',component:PaletteDashboard,thumb:DESIGN_THUMBS['palette-dashboard']},
 {id:'orbit-focus',name:'圆环聚焦',description:'薄荷留白与中心进度环，突出专注与节奏。',theme:'light',component:OrbitFocus,thumb:DESIGN_THUMBS['orbit-focus']},
 {id:'peach-task-board',name:'蜜桃任务板',description:'当前场次与后续队列，适合一日多场考试。',theme:'light',component:PeachTaskBoard,thumb:DESIGN_THUMBS['peach-task-board']},
 {id:'poster-grid',name:'海报网格',description:'深蓝、明黄与暖白的强识别海报布局。',theme:'light',component:PosterGrid,thumb:DESIGN_THUMBS['poster-grid']},
 {id:'ice-columns',name:'冰蓝分栏',description:'日期、主时钟、倒计时三栏秩序，正式易扫读。',theme:'light',component:IceColumns,thumb:DESIGN_THUMBS['ice-columns']},
];
export const DEFAULT_DESIGN_ID=DESIGNS[0].id; export function getDesign(id:string|null|undefined):DesignMeta{return DESIGNS.find(d=>d.id===id)??DESIGNS[0];}

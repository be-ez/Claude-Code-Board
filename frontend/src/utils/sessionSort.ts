import { Session, SessionStatus } from '../types/session.types';
import i18n from '../i18n';

export type SortType = 
  | 'created_desc'  // 最新創建優先
  | 'created_asc'   // 最舊創建優先
  | 'updated_desc'  // 最近更新優先
  | 'updated_asc'   // 最久未更新優先
  | 'name_asc'      // 名稱 A-Z
  | 'name_desc'     // 名稱 Z-A
  | 'status'        // 狀態分組（進行中優先）
  | 'messages_desc' // 訊息數量多優先
  | 'messages_asc'; // 訊息數量少優先

export const sortSessions = (sessions: Session[], sortType: SortType): Session[] => {
  const sorted = [...sessions];
  
  switch (sortType) {
    case 'created_desc':
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
    case 'created_asc':
      return sorted.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
    case 'updated_desc':
      return sorted.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
    case 'updated_asc':
      return sorted.sort((a, b) => 
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );
      
    case 'name_asc':
      return sorted.sort((a, b) => 
        a.name.localeCompare(b.name, 'zh-TW')
      );
      
    case 'name_desc':
      return sorted.sort((a, b) => 
        b.name.localeCompare(a.name, 'zh-TW')
      );
      
    case 'status':
      // 狀態優先級：processing > idle > completed > error > interrupted
      const statusPriority: Record<SessionStatus, number> = {
        [SessionStatus.PROCESSING]: 1,
        [SessionStatus.IDLE]: 2,
        [SessionStatus.COMPLETED]: 3,
        [SessionStatus.ERROR]: 4,
        [SessionStatus.INTERRUPTED]: 5
      };
      
      return sorted.sort((a, b) => {
        const priorityA = statusPriority[a.status] || 999;
        const priorityB = statusPriority[b.status] || 999;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // 如果狀態相同，按更新時間排序
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
    case 'messages_desc':
      return sorted.sort((a, b) => 
        (b.messageCount || 0) - (a.messageCount || 0)
      );
      
    case 'messages_asc':
      return sorted.sort((a, b) => 
        (a.messageCount || 0) - (b.messageCount || 0)
      );
      
    default:
      return sorted;
  }
};

export const getSortOptions = () => [
  { value: 'updated_desc', label: i18n.t('sort.recentlyUpdated') },
  { value: 'created_desc', label: i18n.t('sort.newestCreated') },
  { value: 'created_asc', label: i18n.t('sort.oldestCreated') },
  { value: 'name_asc', label: i18n.t('sort.nameAsc') },
  { value: 'name_desc', label: i18n.t('sort.nameDesc') },
  { value: 'status', label: i18n.t('sort.byStatus') },
  { value: 'messages_desc', label: i18n.t('sort.mostMessages') },
  { value: 'messages_asc', label: i18n.t('sort.fewestMessages') }
];